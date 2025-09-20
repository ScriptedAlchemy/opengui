import { promises as fs } from "node:fs"
import { existsSync } from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

import type {
  GitHubIssue,
  GitHubIssueComment,
  GitHubPullRequest,
  GitHubRateLimit,
  GitHubRepoRef,
  GitHubReviewComment,
  PullRequestStatusSummary,
} from "@/shared/github-types"
import { Log } from "@/util/log"
import {
  createServerGitHubClient,
  GhCliError,
  GhNotAuthenticatedError,
  GhNotInstalledError,
} from "./client"

const cacheLog = Log.create({ service: "github-cache" })
const warmLog = Log.create({ service: "github-cache-warm" })

const CACHE_SCHEMA_VERSION = 2

const DEFAULT_TTL_MS = {
  issue: 15 * 60 * 1000,
  pull: 10 * 60 * 1000,
  issueComments: 5 * 60 * 1000,
  pullComments: 4 * 60 * 1000,
  reviewComments: 4 * 60 * 1000,
  pullStatus: 5 * 60 * 1000,
  issueList: 15 * 60 * 1000,
  pullList: 8 * 60 * 1000,
} as const

const DEFAULT_ISSUE_PARAMS = {
  state: "open" as const,
  perPage: 50,
}

const DEFAULT_PULL_PARAMS = {
  state: "open" as const,
  perPage: 30,
}

const MEMORY_CACHE_MAX_ENTRIES = 500
const LIST_MEMORY_CACHE_MAX_ENTRIES = 64
const ERROR_CACHE_MAX_ENTRIES = 128
const MEMORY_CACHE_ENTRY_TTL_MS = 60 * 60 * 1000
const LIST_MEMORY_CACHE_ENTRY_TTL_MS = 30 * 60 * 1000
const ERROR_CACHE_TTL_MS = 5 * 60 * 1000
const MIN_MEMORY_CACHE_TTL_MS = 60 * 1000

const WARM_INTERVAL_MS = 60 * 1000
const WARM_THRESHOLD_MS = 90 * 1000
const WARM_RECENCY_WINDOW_MS = 10 * 60 * 1000
const WARM_MIN_HITS = 2
const WARM_MAX_ITEMS = 25

export type GitHubContentType = "issue" | "pull"

export interface GitHubIssuesListParams {
  state?: "open" | "closed" | "all"
  labels?: string[]
  sort?: "created" | "updated" | "comments"
  direction?: "asc" | "desc"
  perPage?: number
  assignee?: string
}

export interface GitHubPullsListParams {
  state?: "open" | "closed" | "all"
  sort?: "created" | "updated" | "popularity" | "long-running"
  direction?: "asc" | "desc"
  perPage?: number
  head?: string
  base?: string
}

export interface GitHubContentRequestItem {
  type: GitHubContentType
  number: number
  updatedAt?: string
}

export interface GitHubContentSuccess {
  type: GitHubContentType
  number: number
  updatedAt: string
  fetchedAt: string
  cached: boolean
  stale: boolean
  item: GitHubIssue | GitHubPullRequest
  comments: GitHubIssueComment[]
  reviewComments?: GitHubReviewComment[]
  status?: PullRequestStatusSummary | null
  warning?: string
}

export interface GitHubContentError {
  type: GitHubContentType
  number: number
  message: string
  status?: number
  cached?: boolean
}

export interface GitHubCacheTtlOverrides {
  issue?: number
  pull?: number
  issueComments?: number
  pullComments?: number
  reviewComments?: number
  pullStatus?: number
  issueList?: number
  pullList?: number
}

export interface GitHubContentBatchOptions {
  repo: GitHubRepoRef
  items?: GitHubContentRequestItem[]
  token?: string
  cacheTtlMs?: number | GitHubCacheTtlOverrides
  includeIssues?: GitHubIssuesListParams | null
  includePulls?: GitHubPullsListParams | null
  includeStatuses?: boolean
  mode?: "normal" | "warmup"
}

export interface GitHubContentBatchResult {
  items: GitHubContentSuccess[]
  errors: GitHubContentError[]
  issues: GitHubIssue[]
  pulls: GitHubPullRequest[]
  statuses: Record<number, PullRequestStatusSummary | null>
  meta: {
    cacheHits: number
    cacheMisses: number
    refreshed: number
    staleHits: number
    warmed: number
    errorHits: number
  }
  rateLimit?: GitHubRateLimit | null
}

interface CacheMetrics {
  cacheHits: number
  cacheMisses: number
  refreshed: number
  staleHits: number
  warmed: number
  errorHits: number
}

interface CacheFileSchema {
  version: number
  type: GitHubContentType
  number: number
  repo: GitHubRepoRef
  updatedAt: string
  itemFetchedAt: string
  commentsFetchedAt: string
  reviewCommentsFetchedAt?: string
  statusFetchedAt?: string
  item: GitHubIssue | GitHubPullRequest
  comments: GitHubIssueComment[]
  reviewComments?: GitHubReviewComment[]
  statusSummary?: PullRequestStatusSummary | null
}

interface ListCacheFileSchema<T> {
  version: number
  type: "issue-list" | "pull-list"
  repo: GitHubRepoRef
  paramsHash: string
  fetchedAt: string
  items: T[]
}

interface MemoryEntry<T> {
  value: T
  expiresAt: number
}

const memoryCache = new Map<string, MemoryEntry<CacheFileSchema>>()
const listMemoryCache = new Map<string, MemoryEntry<ListCacheFileSchema<GitHubIssue | GitHubPullRequest>>>()
const errorMemoryCache = new Map<string, MemoryEntry<GitHubContentError>>()

interface WarmRecord {
  repo: GitHubRepoRef
  items: GitHubContentRequestItem[]
  lastAccess: number
  hits: number
  inFlight: boolean
}

const warmRecords = new Map<string, WarmRecord>()
let warmTimer: NodeJS.Timeout | null = null

const cacheRoot = () =>
  process.env["OPENCODE_GITHUB_CACHE_DIR"] ?? path.resolve(process.cwd(), "data/github-cache")

const ensureDirectory = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true })
}

const sanitizeSegment = (value: string) => value.replace(/[^a-z0-9._-]+/gi, "-")

const getCacheFilePath = (repo: GitHubRepoRef, type: GitHubContentType, number: number) => {
  const root = cacheRoot()
  const owner = sanitizeSegment(repo.owner)
  const repoName = sanitizeSegment(repo.repo)
  return path.join(root, owner, repoName, `${type}-${number}.json`)
}

const getListCacheFilePath = (
  repo: GitHubRepoRef,
  type: "issue-list" | "pull-list",
  paramsHash: string
) => {
  const root = cacheRoot()
  const owner = sanitizeSegment(repo.owner)
  const repoName = sanitizeSegment(repo.repo)
  return path.join(root, owner, repoName, "_lists", `${type}-${paramsHash}.json`)
}

const parseTimestamp = (value?: string | null): number | null => {
  if (!value) return null
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? null : ts
}

const formatTimestamp = (value?: string | null, fallback?: () => string) => {
  const ts = parseTimestamp(value)
  if (ts === null) {
    return fallback ? fallback() : new Date(0).toISOString()
  }
  return new Date(ts).toISOString()
}

const normalizeTtlOverrides = (ttl?: number | GitHubCacheTtlOverrides): GitHubCacheTtlOverrides => {
  if (typeof ttl === "number") {
    const map: GitHubCacheTtlOverrides = {}
    for (const key of Object.keys(DEFAULT_TTL_MS) as (keyof typeof DEFAULT_TTL_MS)[]) {
      map[key] = Math.max(0, ttl)
    }
    return map
  }
  if (ttl && typeof ttl === "object") {
    const map: GitHubCacheTtlOverrides = {}
    for (const key of Object.keys(DEFAULT_TTL_MS) as (keyof typeof DEFAULT_TTL_MS)[]) {
      const value = ttl[key]
      if (typeof value === "number" && value >= 0) {
        map[key] = value
      }
    }
    return map
  }
  return {}
}

const getTtl = (
  overrides: GitHubCacheTtlOverrides,
  key: keyof typeof DEFAULT_TTL_MS
): number => {
  const override = overrides[key]
  if (typeof override === "number" && override >= 0) {
    return override
  }
  return DEFAULT_TTL_MS[key]
}

const hashParams = (value: unknown): string => {
  try {
    const serialized = JSON.stringify(value ?? {})
    return createHash("sha1").update(serialized).digest("hex")
  } catch {
    return "default"
  }
}

const clampTtl = (ttlMs: number, fallback: number): number => {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    return fallback
  }
  return Math.max(MIN_MEMORY_CACHE_TTL_MS, ttlMs)
}

const getMemoryEntry = <T>(
  map: Map<string, MemoryEntry<T>>,
  key: string
): T | null => {
  const entry = map.get(key)
  if (!entry) {
    return null
  }
  if (entry.expiresAt <= Date.now()) {
    map.delete(key)
    return null
  }
  // Refresh LRU order by reinserting
  map.delete(key)
  map.set(key, entry)
  return entry.value
}

const setMemoryEntry = <T>(
  map: Map<string, MemoryEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
  maxEntries: number
) => {
  const expiresAt = Date.now() + clampTtl(ttlMs, MIN_MEMORY_CACHE_TTL_MS)
  map.delete(key)
  map.set(key, { value, expiresAt })
  if (map.size > maxEntries) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) {
      map.delete(oldest)
    }
  }
}

const deleteMemoryEntry = <T>(map: Map<string, MemoryEntry<T>>, key: string) => {
  map.delete(key)
}

const readCacheFile = async (filePath: string): Promise<CacheFileSchema | null> => {
  const memoryHit = getMemoryEntry(memoryCache, filePath)
  if (memoryHit) {
    cacheLog.debug("GitHub cache memory hit", { filePath })
    return memoryHit
  }

  if (!existsSync(filePath)) {
    return null
  }

  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as CacheFileSchema
    if (!parsed || parsed.version !== CACHE_SCHEMA_VERSION) {
      return null
    }
    setMemoryEntry(memoryCache, filePath, parsed, MEMORY_CACHE_ENTRY_TTL_MS, MEMORY_CACHE_MAX_ENTRIES)
    return parsed
  } catch (error) {
    cacheLog.warn("Failed to read GitHub cache", { filePath, error })
    return null
  }
}

const writeCacheFile = async (filePath: string, payload: CacheFileSchema) => {
  const dir = path.dirname(filePath)
  await ensureDirectory(dir)
  const serialized = JSON.stringify(payload, null, 2)
  await fs.writeFile(filePath, serialized, "utf-8")
  setMemoryEntry(memoryCache, filePath, payload, MEMORY_CACHE_ENTRY_TTL_MS, MEMORY_CACHE_MAX_ENTRIES)
}

const readListCacheFile = async <T>(filePath: string): Promise<ListCacheFileSchema<T> | null> => {
  const memoryHit = getMemoryEntry(listMemoryCache, filePath)
  if (memoryHit) {
    cacheLog.debug("GitHub list cache memory hit", { filePath })
    return memoryHit as ListCacheFileSchema<T>
  }

  if (!existsSync(filePath)) {
    return null
  }

  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as ListCacheFileSchema<T>
    if (!parsed || parsed.version !== CACHE_SCHEMA_VERSION) {
      return null
    }
    setMemoryEntry(
      listMemoryCache,
      filePath,
      parsed as ListCacheFileSchema<GitHubIssue | GitHubPullRequest>,
      LIST_MEMORY_CACHE_ENTRY_TTL_MS,
      LIST_MEMORY_CACHE_MAX_ENTRIES
    )
    return parsed
  } catch (error) {
    cacheLog.warn("Failed to read GitHub list cache", { filePath, error })
    return null
  }
}

const writeListCacheFile = async <T>(filePath: string, payload: ListCacheFileSchema<T>) => {
  const dir = path.dirname(filePath)
  await ensureDirectory(dir)
  const serialized = JSON.stringify(payload, null, 2)
  await fs.writeFile(filePath, serialized, "utf-8")
  setMemoryEntry(
    listMemoryCache,
    filePath,
    payload as ListCacheFileSchema<GitHubIssue | GitHubPullRequest>,
    LIST_MEMORY_CACHE_ENTRY_TTL_MS,
    LIST_MEMORY_CACHE_MAX_ENTRIES
  )
}

const getCachedError = (filePath: string): GitHubContentError | null => {
  return getMemoryEntry(errorMemoryCache, filePath)
}

const setCachedError = (filePath: string, error: GitHubContentError, ttlMs = ERROR_CACHE_TTL_MS) => {
  setMemoryEntry(errorMemoryCache, filePath, error, ttlMs, ERROR_CACHE_MAX_ENTRIES)
}

const clearCachedError = (filePath: string) => {
  deleteMemoryEntry(errorMemoryCache, filePath)
}

const serializeGenericError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return "Unknown error"
  }
}

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof GhNotInstalledError) {
    return "GitHub CLI (gh) is not installed on this system. Install GitHub CLI to enable GitHub integration."
  }

  if (error instanceof GhNotAuthenticatedError) {
    return "GitHub CLI is not authenticated. Run `gh auth login` or provide a valid token."
  }

  if (error instanceof GhCliError) {
    return error.message
  }

  return serializeGenericError(error)
}

const isNotFoundError = (error: unknown): boolean => {
  if (!(error instanceof GhCliError)) {
    return false
  }

  const stderr = typeof error.stderr === "string" ? error.stderr : ""
  const haystack = `${error.message ?? ""} ${stderr}`.toLowerCase()

  if (!haystack.trim()) {
    return false
  }

  return (
    haystack.includes("http 404") ||
    haystack.includes("404:") ||
    haystack.includes("404 not found") ||
    haystack.includes("not found") ||
    haystack.includes("could not resolve") ||
    haystack.includes("no issue matches") ||
    haystack.includes("could not resolve to an issue") ||
    haystack.includes("could not resolve to a pullrequest")
  )
}

const dedupeRequestItems = (items: GitHubContentRequestItem[]): GitHubContentRequestItem[] => {
  const map = new Map<string, GitHubContentRequestItem>()
  for (const item of items) {
    const key = `${item.type}:${item.number}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, item)
      continue
    }
    const existingTs = parseTimestamp(existing.updatedAt)
    const incomingTs = parseTimestamp(item.updatedAt)
    if (incomingTs !== null && (existingTs === null || incomingTs > existingTs)) {
      map.set(key, item)
    }
  }
  return Array.from(map.values())
}

const mergeItems = (
  base: GitHubContentRequestItem[],
  extras: GitHubContentRequestItem[]
): GitHubContentRequestItem[] => {
  return dedupeRequestItems([...base, ...extras])
}

const shouldRefreshTimestamp = (lastFetchedAt: string | undefined, ttlMs: number, now: number) => {
  if (ttlMs === 0) {
    return true
  }
  const fetchedTs = parseTimestamp(lastFetchedAt)
  if (fetchedTs === null) {
    return true
  }
  return now - fetchedTs > ttlMs
}

const determineIssueRefresh = (
  cache: CacheFileSchema | null,
  request: GitHubContentRequestItem,
  ttl: GitHubCacheTtlOverrides,
  now: number
) => {
  const itemTtl = getTtl(ttl, "issue")
  const commentTtl = getTtl(ttl, "issueComments")
  const knownUpdatedTs = parseTimestamp(request.updatedAt)
  const cachedUpdatedTs = parseTimestamp(cache?.updatedAt)

  const hasCache = Boolean(cache)
  const isUpdated =
    knownUpdatedTs !== null && cachedUpdatedTs !== null && knownUpdatedTs > cachedUpdatedTs

  const refreshItem = !hasCache || isUpdated || shouldRefreshTimestamp(cache?.itemFetchedAt, itemTtl, now)
  const refreshComments =
    !hasCache || refreshItem || shouldRefreshTimestamp(cache?.commentsFetchedAt, commentTtl, now)

  return {
    refreshItem,
    refreshComments,
    needsFetch: refreshItem || refreshComments,
  }
}

const determinePullRefresh = (
  cache: CacheFileSchema | null,
  request: GitHubContentRequestItem,
  ttl: GitHubCacheTtlOverrides,
  now: number,
  includeStatus: boolean
) => {
  const pullTtl = getTtl(ttl, "pull")
  const commentTtl = getTtl(ttl, "pullComments")
  const reviewTtl = getTtl(ttl, "reviewComments")
  const statusTtl = getTtl(ttl, "pullStatus")
  const knownUpdatedTs = parseTimestamp(request.updatedAt)
  const cachedUpdatedTs = parseTimestamp(cache?.updatedAt)

  const hasCache = Boolean(cache)
  const isUpdated =
    knownUpdatedTs !== null && cachedUpdatedTs !== null && knownUpdatedTs > cachedUpdatedTs

  const refreshItem = !hasCache || isUpdated || shouldRefreshTimestamp(cache?.itemFetchedAt, pullTtl, now)
  const refreshComments =
    !hasCache || refreshItem || shouldRefreshTimestamp(cache?.commentsFetchedAt, commentTtl, now)
  const refreshReviewComments =
    !hasCache || refreshItem || shouldRefreshTimestamp(cache?.reviewCommentsFetchedAt, reviewTtl, now)
  const refreshStatus =
    includeStatus &&
    (!hasCache || refreshItem || shouldRefreshTimestamp(cache?.statusFetchedAt, statusTtl, now))

  return {
    refreshItem,
    refreshComments,
    refreshReviewComments,
    refreshStatus,
    needsFetch: refreshItem || refreshComments || refreshReviewComments || refreshStatus,
  }
}

const ensureWarmScheduler = () => {
  if (!warmTimer) {
    warmTimer = setInterval(() => {
      void warmTick().catch((error) => warmLog.warn("Warm cache tick failed", { error }))
    }, WARM_INTERVAL_MS)
    warmTimer.unref?.()
  }
}

const trackWarmRecord = (repo: GitHubRepoRef, items: GitHubContentRequestItem[]) => {
  if (!items.length) {
    return
  }
  ensureWarmScheduler()
  const key = `${repo.owner}/${repo.repo}`
  const existing = warmRecords.get(key)
  if (existing) {
    existing.items = mergeItems(existing.items, items).slice(0, WARM_MAX_ITEMS)
    existing.lastAccess = Date.now()
    existing.hits += 1
    warmRecords.set(key, existing)
  } else {
    warmRecords.set(key, {
      repo,
      items: items.slice(0, WARM_MAX_ITEMS),
      lastAccess: Date.now(),
      hits: 1,
      inFlight: false,
    })
  }
}

const collectWarmItems = async (
  repo: GitHubRepoRef,
  items: GitHubContentRequestItem[]
): Promise<GitHubContentRequestItem[]> => {
  const ttlOverrides = {} as GitHubCacheTtlOverrides
  const now = Date.now()
  const toWarm: GitHubContentRequestItem[] = []

  for (const request of items.slice(0, WARM_MAX_ITEMS)) {
    const cachePath = getCacheFilePath(repo, request.type, request.number)
    const cache = await readCacheFile(cachePath)
    if (!cache) {
      continue
    }
    const plan =
      request.type === "issue"
        ? determineIssueRefresh(cache, request, ttlOverrides, now)
        : determinePullRefresh(cache, request, ttlOverrides, now, true)

    if (!plan.needsFetch) {
      // Warm if cache is close to expiry
      const ttlKey = request.type === "issue" ? "issue" : "pull"
      const ttlMs = getTtl(ttlOverrides, ttlKey)
      const fetchedTs = parseTimestamp(cache.itemFetchedAt)
      if (fetchedTs !== null && now - fetchedTs > Math.max(0, ttlMs - WARM_THRESHOLD_MS)) {
        toWarm.push({
          type: request.type,
          number: request.number,
          updatedAt: cache.updatedAt,
        })
      }
      continue
    }

    toWarm.push({
      type: request.type,
      number: request.number,
      updatedAt: cache.updatedAt,
    })
  }

  return toWarm
}

const warmTick = async () => {
  const now = Date.now()
  for (const [key, record] of warmRecords.entries()) {
    if (record.inFlight) {
      continue
    }
    if (now - record.lastAccess > WARM_RECENCY_WINDOW_MS) {
      warmRecords.delete(key)
      continue
    }
    if (record.hits < WARM_MIN_HITS) {
      continue
    }

    const warmItems = await collectWarmItems(record.repo, record.items)
    if (!warmItems.length) {
      continue
    }

    record.inFlight = true
    try {
      const result = await fetchGitHubContentBatch({
        repo: record.repo,
        items: warmItems,
        includeStatuses: false,
        mode: "warmup",
      })
      warmLog.debug("Warmed GitHub cache", {
        repo: `${record.repo.owner}/${record.repo.repo}`,
        warmed: warmItems.length,
        hits: result.meta.cacheHits,
        misses: result.meta.cacheMisses,
      })
    } catch (error) {
      warmLog.warn("Failed to warm GitHub cache", { repo: record.repo, error })
    } finally {
      record.inFlight = false
      record.hits = WARM_MIN_HITS
    }
  }
}

const loadIssueList = async (
  repo: GitHubRepoRef,
  params: GitHubIssuesListParams,
  ttl: GitHubCacheTtlOverrides,
  client: ReturnType<typeof createServerGitHubClient>
): Promise<GitHubIssue[]> => {
  const paramsHash = hashParams(params)
  const cachePath = getListCacheFilePath(repo, "issue-list", paramsHash)
  const ttlMs = getTtl(ttl, "issueList")
  const now = Date.now()
  const cached = await readListCacheFile<GitHubIssue>(cachePath)

  if (cached && !shouldRefreshTimestamp(cached.fetchedAt, ttlMs, now)) {
    return cached.items
  }

  const items = await client.listIssues(repo, params)
  const payload: ListCacheFileSchema<GitHubIssue> = {
    version: CACHE_SCHEMA_VERSION,
    type: "issue-list",
    repo,
    paramsHash,
    fetchedAt: new Date(now).toISOString(),
    items,
  }
  await writeListCacheFile(cachePath, payload)
  return items
}

const loadPullList = async (
  repo: GitHubRepoRef,
  params: GitHubPullsListParams,
  ttl: GitHubCacheTtlOverrides,
  client: ReturnType<typeof createServerGitHubClient>
): Promise<GitHubPullRequest[]> => {
  const paramsHash = hashParams(params)
  const cachePath = getListCacheFilePath(repo, "pull-list", paramsHash)
  const ttlMs = getTtl(ttl, "pullList")
  const now = Date.now()
  const cached = await readListCacheFile<GitHubPullRequest>(cachePath)

  if (cached && !shouldRefreshTimestamp(cached.fetchedAt, ttlMs, now)) {
    return cached.items
  }

  const items = await client.listPullRequests(repo, params)
  const payload: ListCacheFileSchema<GitHubPullRequest> = {
    version: CACHE_SCHEMA_VERSION,
    type: "pull-list",
    repo,
    paramsHash,
    fetchedAt: new Date(now).toISOString(),
    items,
  }
  await writeListCacheFile(cachePath, payload)
  return items
}

export async function fetchGitHubContentBatch(
  options: GitHubContentBatchOptions
): Promise<GitHubContentBatchResult> {
  const {
    repo,
    token,
    includeIssues,
    includePulls,
    includeStatuses = true,
    mode = "normal",
  } = options

  const ttlOverrides = normalizeTtlOverrides(options.cacheTtlMs)
  const metrics: CacheMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    refreshed: 0,
    staleHits: 0,
    warmed: mode === "warmup" ? (options.items?.length ?? 0) : 0,
    errorHits: 0,
  }

  const client = createServerGitHubClient(token)
  let requestedItems = dedupeRequestItems(options.items ?? [])

  const shouldAutoIncludeIssues = !includeIssues && requestedItems.length === 0
  const shouldAutoIncludePulls = !includePulls && requestedItems.length === 0

  const effectiveIssueParams = includeIssues ?? (shouldAutoIncludeIssues ? DEFAULT_ISSUE_PARAMS : null)
  const effectivePullParams = includePulls ?? (shouldAutoIncludePulls ? DEFAULT_PULL_PARAMS : null)

  let issuesList: GitHubIssue[] = []
  let pullsList: GitHubPullRequest[] = []

  if (effectiveIssueParams) {
    issuesList = await loadIssueList(repo, effectiveIssueParams, ttlOverrides, client)
    requestedItems = mergeItems(
      requestedItems,
      issuesList.map((issue) => ({ type: "issue" as const, number: issue.number, updatedAt: issue.updated_at }))
    )
  }

  if (effectivePullParams) {
    pullsList = await loadPullList(repo, effectivePullParams, ttlOverrides, client)
    requestedItems = mergeItems(
      requestedItems,
      pullsList.map((pull) => ({ type: "pull" as const, number: pull.number, updatedAt: pull.updated_at }))
    )
  }

  if (!requestedItems.length) {
    return {
      items: [],
      errors: [],
      issues: issuesList,
      pulls: pullsList,
      statuses: {},
      meta: metrics,
    }
  }

  const results: GitHubContentSuccess[] = []
  const errors: GitHubContentError[] = []
  const statuses: Record<number, PullRequestStatusSummary | null> = {}
  const now = Date.now()
  const statusOnlyRequests: {
    request: GitHubContentRequestItem
    cached: CacheFileSchema
    cachePath: string
  }[] = []
  const statusOnlyNumbers: number[] = []

  for (const request of requestedItems) {
    const cachePath = getCacheFilePath(repo, request.type, request.number)
    const cached = await readCacheFile(cachePath)

    if (request.type === "issue") {
      const plan = determineIssueRefresh(cached, request, ttlOverrides, now)

      if (!plan.needsFetch && cached) {
        metrics.cacheHits += 1
        results.push({
          type: "issue",
          number: request.number,
          updatedAt: cached.updatedAt,
          fetchedAt: cached.itemFetchedAt,
          cached: true,
          stale: false,
          item: cached.item,
          comments: cached.comments,
        })
        continue
      }

      if (!cached && plan.needsFetch) {
        const cachedError = getCachedError(cachePath)
        if (cachedError) {
          metrics.errorHits += 1
          errors.push({ ...cachedError, cached: true })
          continue
        }
      }

      metrics.cacheMisses += 1
      try {
        const refreshedAt = new Date().toISOString()
        let issue = cached?.item as GitHubIssue | undefined
        let updatedAt = cached?.updatedAt ?? request.updatedAt ?? refreshedAt
        let comments = cached?.comments ?? []

        if (plan.refreshItem) {
          issue = await client.getIssue(repo, request.number)
          updatedAt = issue.updated_at
        }

        if (plan.refreshComments || !issue) {
          comments = await client.fetchIssueComments(repo, request.number)
        }

        if (!issue) {
          throw new Error("Failed to load GitHub issue content")
        }

        const cachePayload: CacheFileSchema = {
          version: CACHE_SCHEMA_VERSION,
          type: "issue",
          number: request.number,
          repo,
          updatedAt,
          itemFetchedAt: plan.refreshItem ? refreshedAt : formatTimestamp(cached?.itemFetchedAt, () => refreshedAt),
          commentsFetchedAt: plan.refreshComments
            ? refreshedAt
            : formatTimestamp(cached?.commentsFetchedAt, () => refreshedAt),
          item: issue,
          comments,
        }

        await writeCacheFile(cachePath, cachePayload)
        clearCachedError(cachePath)

        results.push({
          type: "issue",
          number: request.number,
          updatedAt,
          fetchedAt: cachePayload.itemFetchedAt,
          cached: false,
          stale: false,
          item: issue,
          comments,
        })

        metrics.refreshed += 1
      } catch (error) {
        const message = formatErrorMessage(error)
        if (cached) {
          metrics.staleHits += 1
          results.push({
            type: "issue",
            number: request.number,
            updatedAt: cached.updatedAt,
            fetchedAt: cached.itemFetchedAt,
            cached: true,
            stale: true,
            item: cached.item,
            comments: cached.comments,
            warning: message,
          })
          continue
        }

        const status = isNotFoundError(error) ? 404 : undefined
        const errorPayload: GitHubContentError = {
          type: "issue",
          number: request.number,
          message,
          status,
          cached: false,
        }
        errors.push(errorPayload)
        if (status === 404) {
          setCachedError(cachePath, { ...errorPayload, cached: false })
        }
      }
      continue
    }

    const plan = determinePullRefresh(cached, request, ttlOverrides, now, includeStatuses)

    if (!plan.needsFetch && cached) {
      metrics.cacheHits += 1
      const status = includeStatuses ? cached.statusSummary ?? null : undefined
      if (includeStatuses) {
        statuses[request.number] = status ?? null
      }
      results.push({
        type: "pull",
        number: request.number,
        updatedAt: cached.updatedAt,
        fetchedAt: cached.itemFetchedAt,
        cached: true,
        stale: false,
        item: cached.item,
        comments: cached.comments,
        reviewComments: cached.reviewComments,
        status,
      })
      continue
    }

    if (!cached && plan.needsFetch) {
      const cachedError = getCachedError(cachePath)
      if (cachedError) {
        metrics.errorHits += 1
        if (includeStatuses) {
          statuses[request.number] = null
        }
        errors.push({ ...cachedError, cached: true })
        continue
      }
    }

    if (
      includeStatuses &&
      cached &&
      plan.refreshStatus &&
      !plan.refreshItem &&
      !plan.refreshComments &&
      !plan.refreshReviewComments
    ) {
      metrics.cacheMisses += 1
      statusOnlyRequests.push({ request, cached, cachePath })
      statusOnlyNumbers.push(request.number)
      continue
    }

    metrics.cacheMisses += 1
    try {
      const refreshedAt = new Date().toISOString()
      let pull = cached?.item as GitHubPullRequest | undefined
      let updatedAt = cached?.updatedAt ?? request.updatedAt ?? refreshedAt
      let comments = cached?.comments ?? []
      let reviewComments = cached?.reviewComments ?? []
      let status: PullRequestStatusSummary | null | undefined = cached?.statusSummary

      if (plan.refreshItem) {
        pull = await client.getPullRequest(repo, request.number)
        updatedAt = pull.updated_at
      }

      if (plan.refreshComments || !pull) {
        comments = await client.fetchPullRequestComments(repo, request.number)
      }

      if (plan.refreshReviewComments || !pull) {
        reviewComments = await client.fetchPullRequestReviewComments(repo, request.number)
      }

      if (includeStatuses && (plan.refreshStatus || status === undefined)) {
        status = await client.getPullRequestStatus(repo, request.number)
      }

      if (!pull) {
        throw new Error("Failed to load GitHub pull request content")
      }

      const cachePayload: CacheFileSchema = {
        version: CACHE_SCHEMA_VERSION,
        type: "pull",
        number: request.number,
        repo,
        updatedAt,
        itemFetchedAt: plan.refreshItem ? refreshedAt : formatTimestamp(cached?.itemFetchedAt, () => refreshedAt),
        commentsFetchedAt: plan.refreshComments
          ? refreshedAt
          : formatTimestamp(cached?.commentsFetchedAt, () => refreshedAt),
        reviewCommentsFetchedAt: plan.refreshReviewComments
          ? refreshedAt
          : cached?.reviewCommentsFetchedAt
            ? formatTimestamp(cached.reviewCommentsFetchedAt)
            : undefined,
        statusFetchedAt:
          includeStatuses && (plan.refreshStatus || status !== undefined)
            ? refreshedAt
            : cached?.statusFetchedAt,
        item: pull,
        comments,
        reviewComments,
        statusSummary: includeStatuses ? status ?? null : undefined,
      }

      await writeCacheFile(cachePath, cachePayload)
      clearCachedError(cachePath)

      if (includeStatuses) {
        statuses[request.number] = cachePayload.statusSummary ?? null
      }

      results.push({
        type: "pull",
        number: request.number,
        updatedAt,
        fetchedAt: cachePayload.itemFetchedAt,
        cached: false,
        stale: false,
        item: pull,
        comments,
        reviewComments,
        status: includeStatuses ? cachePayload.statusSummary ?? null : undefined,
      })

      metrics.refreshed += 1
    } catch (error) {
      const message = formatErrorMessage(error)
      if (cached) {
        metrics.staleHits += 1
        if (includeStatuses) {
          statuses[request.number] = cached.statusSummary ?? null
        }
        results.push({
          type: "pull",
          number: request.number,
          updatedAt: cached.updatedAt,
          fetchedAt: cached.itemFetchedAt,
          cached: true,
          stale: true,
          item: cached.item,
          comments: cached.comments,
          reviewComments: cached.reviewComments,
          status: includeStatuses ? cached.statusSummary ?? null : undefined,
          warning: message,
        })
        continue
      }

      const statusCode = isNotFoundError(error) ? 404 : undefined
      const errorPayload: GitHubContentError = {
        type: "pull",
        number: request.number,
        message,
        status: statusCode,
        cached: false,
      }
      errors.push(errorPayload)
      if (includeStatuses) {
        statuses[request.number] = null
      }
      if (statusCode === 404) {
        setCachedError(cachePath, { ...errorPayload, cached: false })
      }
    }
  }

  if (mode === "normal") {
    trackWarmRecord(repo, requestedItems)
  }

  if (statusOnlyRequests.length > 0) {
    let statusMap: Map<number, PullRequestStatusSummary> | null = null
    try {
      statusMap = await client.getPullRequestStatusesBatch(repo, statusOnlyNumbers)
    } catch (error) {
      cacheLog.warn("Failed to refresh pull request statuses in batch", {
        repo: `${repo.owner}/${repo.repo}`,
        count: statusOnlyNumbers.length,
        error,
      })
    }

    const fetchedAt = new Date().toISOString()

    for (const pending of statusOnlyRequests) {
      const latestStatus = statusMap?.get(pending.request.number) ?? null
      if (latestStatus) {
        const payload: CacheFileSchema = {
          ...pending.cached,
          statusSummary: latestStatus,
          statusFetchedAt: fetchedAt,
        }
        await writeCacheFile(pending.cachePath, payload)
        if (includeStatuses) {
          statuses[pending.request.number] = latestStatus
        }
        results.push({
          type: "pull",
          number: pending.request.number,
          updatedAt: pending.cached.updatedAt,
          fetchedAt: pending.cached.itemFetchedAt,
          cached: false,
          stale: false,
          item: pending.cached.item,
          comments: pending.cached.comments,
          reviewComments: pending.cached.reviewComments,
          status: includeStatuses ? latestStatus : undefined,
        })
        metrics.refreshed += 1
      } else {
        metrics.staleHits += 1
        if (includeStatuses) {
          statuses[pending.request.number] = pending.cached.statusSummary ?? null
        }
        results.push({
          type: "pull",
          number: pending.request.number,
          updatedAt: pending.cached.updatedAt,
          fetchedAt: pending.cached.itemFetchedAt,
          cached: true,
          stale: true,
          item: pending.cached.item,
          comments: pending.cached.comments,
          reviewComments: pending.cached.reviewComments,
          status: includeStatuses ? pending.cached.statusSummary ?? null : undefined,
          warning: "Unable to refresh pull request status",
        })
      }
    }
  }

  const issueContentMap = new Map<number, GitHubIssue>()
  const pullContentMap = new Map<number, GitHubPullRequest>()

  for (const item of results) {
    if (item.type === "issue") {
      issueContentMap.set(item.number, item.item as GitHubIssue)
    } else {
      pullContentMap.set(item.number, item.item as GitHubPullRequest)
    }
  }

  if (!issuesList.length) {
    issuesList = Array.from(issueContentMap.values())
  } else {
    issuesList = issuesList.map((issue) => issueContentMap.get(issue.number) ?? issue)
  }

  if (!pullsList.length) {
    pullsList = Array.from(pullContentMap.values())
  } else {
    pullsList = pullsList.map((pull) => pullContentMap.get(pull.number) ?? pull)
  }

  if (includeStatuses) {
    for (const item of results) {
      if (item.type === "pull") {
        statuses[item.number] = item.status ?? null
      }
    }
  }

  const rateLimit = client.getRateLimit()

  if (metrics.cacheMisses > 0 || metrics.staleHits > 0) {
    cacheLog.info("GitHub cache batch", {
      repo: `${repo.owner}/${repo.repo}`,
      itemsRequested: requestedItems.length,
      cacheHits: metrics.cacheHits,
      cacheMisses: metrics.cacheMisses,
      refreshed: metrics.refreshed,
      staleHits: metrics.staleHits,
      errorHits: metrics.errorHits,
      mode,
      remaining: rateLimit.core?.remaining,
    })
  }

  return {
    items: results,
    errors,
    issues: issuesList,
    pulls: pullsList,
    statuses,
    meta: metrics,
    rateLimit,
  }
}

export function __resetGitHubCacheForTesting() {
  memoryCache.clear()
  listMemoryCache.clear()
  errorMemoryCache.clear()
  warmRecords.clear()
  if (warmTimer) {
    clearInterval(warmTimer)
    warmTimer = null
  }
}

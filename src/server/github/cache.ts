import { promises as fs } from "node:fs"
import { existsSync } from "node:fs"
import path from "node:path"

import type {
  GitHubIssue,
  GitHubIssueComment,
  GitHubPullRequest,
  GitHubRepoRef,
  GitHubReviewComment,
} from "@/shared/github-types"
import {
  createServerGitHubClient,
  GhCliError,
  GhNotAuthenticatedError,
  GhNotInstalledError,
} from "./client"

const CACHE_SCHEMA_VERSION = 1
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export type GitHubContentType = "issue" | "pull"

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
  warning?: string
}

export interface GitHubContentError {
  type: GitHubContentType
  number: number
  message: string
  status?: number
}

export interface GitHubContentBatchOptions {
  repo: GitHubRepoRef
  items: GitHubContentRequestItem[]
  token?: string
  cacheTtlMs?: number
}

export interface GitHubContentBatchResult {
  items: GitHubContentSuccess[]
  errors: GitHubContentError[]
}

interface CacheFileSchema {
  version: number
  type: GitHubContentType
  number: number
  repo: GitHubRepoRef
  updatedAt: string
  fetchedAt: string
  item: GitHubIssue | GitHubPullRequest
  comments: GitHubIssueComment[]
  reviewComments?: GitHubReviewComment[]
}

const memoryCache = new Map<string, CacheFileSchema>()

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

const parseTimestamp = (value?: string | null): number | null => {
  if (!value) return null
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? null : ts
}

const shouldRefresh = (
  cache: CacheFileSchema | null,
  knownUpdatedAt: string | undefined,
  ttlMs: number
) => {
  if (!cache) {
    return true
  }

  if (knownUpdatedAt) {
    const knownTs = parseTimestamp(knownUpdatedAt)
    const cachedTs = parseTimestamp(cache.updatedAt)
    if (knownTs !== null && cachedTs !== null && knownTs > cachedTs) {
      return true
    }
  }

  if (ttlMs > 0) {
    const fetchedTs = parseTimestamp(cache.fetchedAt)
    if (fetchedTs === null) {
      return true
    }
    if (Date.now() - fetchedTs > ttlMs) {
      return true
    }
  }

  return false
}

const readCacheFile = async (filePath: string): Promise<CacheFileSchema | null> => {
  if (memoryCache.has(filePath)) {
    return memoryCache.get(filePath) ?? null
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
    memoryCache.set(filePath, parsed)
    return parsed
  } catch (error) {
    console.warn("Failed to read GitHub cache", { filePath, error })
    return null
  }
}

const writeCacheFile = async (filePath: string, payload: CacheFileSchema) => {
  const dir = path.dirname(filePath)
  await ensureDirectory(dir)
  const serialized = JSON.stringify(payload, null, 2)
  await fs.writeFile(filePath, serialized, "utf-8")
  memoryCache.set(filePath, payload)
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

const fetchIssueContent = async (
  client: ReturnType<typeof createServerGitHubClient>,
  repo: GitHubRepoRef,
  item: GitHubContentRequestItem
): Promise<{ issue: GitHubIssue; comments: GitHubIssueComment[] }> => {
  const issue = await client.getIssue(repo, item.number)
  const comments = await client.fetchIssueComments(repo, item.number)
  return { issue, comments }
}

const fetchPullRequestContent = async (
  client: ReturnType<typeof createServerGitHubClient>,
  repo: GitHubRepoRef,
  item: GitHubContentRequestItem
): Promise<{
  pullRequest: GitHubPullRequest
  comments: GitHubIssueComment[]
  reviewComments: GitHubReviewComment[]
}> => {
  const pullRequest = await client.getPullRequest(repo, item.number)
  const comments = await client.fetchPullRequestComments(repo, item.number)
  const reviewComments = await client.fetchPullRequestReviewComments(repo, item.number)
  return { pullRequest, comments, reviewComments }
}

export async function fetchGitHubContentBatch(
  options: GitHubContentBatchOptions
): Promise<GitHubContentBatchResult> {
  const { repo, items, token, cacheTtlMs } = options
  const ttlMs = cacheTtlMs ?? DEFAULT_CACHE_TTL_MS

  const results: GitHubContentSuccess[] = []
  const errors: GitHubContentError[] = []
  const client = createServerGitHubClient(token)

  for (const request of items) {
    const cachePath = getCacheFilePath(repo, request.type, request.number)
    const cached = await readCacheFile(cachePath)
    const needsRefresh = shouldRefresh(cached, request.updatedAt, ttlMs)

    if (!needsRefresh && cached) {
      results.push({
        type: request.type,
        number: request.number,
        updatedAt: cached.updatedAt,
        fetchedAt: cached.fetchedAt,
        cached: true,
        stale: false,
        item: cached.item,
        comments: cached.comments,
        reviewComments: cached.reviewComments,
      })
      continue
    }

    try {
      if (request.type === "issue") {
        const { issue, comments } = await fetchIssueContent(client, repo, request)
        const now = new Date().toISOString()
        const cachePayload: CacheFileSchema = {
          version: CACHE_SCHEMA_VERSION,
          type: "issue",
          number: request.number,
          repo,
          updatedAt: issue.updated_at,
          fetchedAt: now,
          item: issue,
          comments,
        }
        await writeCacheFile(cachePath, cachePayload)
        results.push({
          type: "issue",
          number: request.number,
          updatedAt: issue.updated_at,
          fetchedAt: now,
          cached: false,
          stale: false,
          item: issue,
          comments,
        })
      } else {
        const { pullRequest, comments, reviewComments } = await fetchPullRequestContent(client, repo, request)
        const now = new Date().toISOString()
        const cachePayload: CacheFileSchema = {
          version: CACHE_SCHEMA_VERSION,
          type: "pull",
          number: request.number,
          repo,
          updatedAt: pullRequest.updated_at,
          fetchedAt: now,
          item: pullRequest,
          comments,
          reviewComments,
        }
        await writeCacheFile(cachePath, cachePayload)
        results.push({
          type: "pull",
          number: request.number,
          updatedAt: pullRequest.updated_at,
          fetchedAt: now,
          cached: false,
          stale: false,
          item: pullRequest,
          comments,
          reviewComments,
        })
      }
    } catch (error) {
      const message = formatErrorMessage(error)
      if (cached) {
        results.push({
          type: request.type,
          number: request.number,
          updatedAt: cached.updatedAt,
          fetchedAt: cached.fetchedAt,
          cached: true,
          stale: true,
          item: cached.item,
          comments: cached.comments,
          reviewComments: cached.reviewComments,
          warning: message,
        })
        continue
      }

      errors.push({
        type: request.type,
        number: request.number,
        message,
      })
    }
  }

  return { items: results, errors }
}

export function __resetGitHubCacheForTesting() {
  memoryCache.clear()
}

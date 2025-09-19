import { randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

import type {
  GitHubIssue,
  GitHubIssueComment,
  GitHubLabel,
  GitHubPullRequest,
  GitHubRepoRef,
  GitHubReviewComment,
  GitHubUser,
  PullRequestStatusSummary,
  GitHubRateLimit,
} from "@/shared/github-types"
import { Log } from "@/util/log"

const execFileAsync = promisify(execFile)

const GH_BINARY = process.env.OPENCODE_GH_PATH || "gh"
const MAX_BUFFER = 20 * 1024 * 1024 // 20MB safeguard for large responses
const RATE_LIMIT_MAX_RETRIES = 3
const log = Log.create({ service: "github-cli" })

const BASE_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GH_PROMPT_DISABLED: "1",
  GH_CLI_VERSION_CHECK: "never",
  GH_PAGER: "",
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class GhCliError extends Error {
  exitCode?: number
  stderr?: string

  constructor(message: string, options: { exitCode?: number; stderr?: string } = {}) {
    super(message)
    this.name = "GhCliError"
    this.exitCode = options.exitCode
    this.stderr = options.stderr
  }
}

export class GhNotInstalledError extends GhCliError {
  constructor() {
    super("GitHub CLI (gh) is not installed or not found in PATH")
    this.name = "GhNotInstalledError"
  }
}

export class GhNotAuthenticatedError extends GhCliError {
  constructor(message = "GitHub CLI is not authenticated. Run `gh auth login` or provide a token.") {
    super(message)
    this.name = "GhNotAuthenticatedError"
  }
}

interface ExecGhOptions {
  token?: string
}

interface ExecGhResult {
  stdout: string
  stderr: string
}

export interface RateLimitSnapshot {
  limit: number
  remaining: number
  resetAt: number
  fetchedAt: number
}

const authCache = new Map<string, Promise<void>>()
let availabilityPromise: Promise<void> | null = null

const buildEnv = (token?: string): NodeJS.ProcessEnv => {
  if (!token) {
    return { ...BASE_ENV }
  }

  return {
    ...BASE_ENV,
    GH_TOKEN: token,
    GITHUB_TOKEN: token,
  }
}

const getExitCode = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined
  const maybe = error as { code?: number | string; exitCode?: number }
  if (typeof maybe.exitCode === "number") return maybe.exitCode
  if (typeof maybe.code === "number") return maybe.code
  if (typeof maybe.code === "string" && /^\d+$/.test(maybe.code)) {
    return Number(maybe.code)
  }
  return undefined
}

const toString = (value: unknown): string => {
  if (typeof value === "string") return value
  if (value instanceof Buffer) return value.toString("utf-8")
  return ""
}

const extractStderr = (error: unknown): string => {
  if (!error || typeof error !== "object") return ""
  const maybe = error as { stderr?: unknown }
  return toString(maybe.stderr)
}

const isAuthErrorMessage = (value: string): boolean => {
  if (!value) return false
  const lower = value.toLowerCase()
  return (
    lower.includes("gh auth login") ||
    lower.includes("no authentication token") ||
    lower.includes("bad credentials") ||
    lower.includes("http 401") ||
    lower.includes("requires authentication") ||
    lower.includes("must authenticate")
  )
}

const isRateLimitErrorMessage = (value: string): boolean => {
  if (!value) return false
  const lower = value.toLowerCase()
  return (
    lower.includes("rate limit") ||
    lower.includes("secondary rate limit") ||
    lower.includes("abuse detection") ||
    lower.includes("slow down") ||
    lower.includes("retry later")
  )
}

const execGhCommand = async (args: string[], env: NodeJS.ProcessEnv): Promise<ExecGhResult> => {
  try {
    const { stdout, stderr } = await execFileAsync(GH_BINARY, args, {
      env,
      maxBuffer: MAX_BUFFER,
    })
    return { stdout, stderr }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new GhNotInstalledError()
    }

    const stderr = extractStderr(error)
    const exitCode = getExitCode(error)

    if (isAuthErrorMessage(stderr)) {
      throw new GhNotAuthenticatedError(stderr.trim() || undefined)
    }

    throw new GhCliError(
      stderr.trim() || `Failed to execute gh command: ${args.join(" ")}`,
      {
        exitCode,
        stderr,
      }
    )
  }
}

const ensureGhAvailable = async () => {
  if (!availabilityPromise) {
    availabilityPromise = execGhCommand(["--version"], buildEnv()).then(
      () => {},
      (error) => {
        availabilityPromise = null
        throw error
      }
    )
  }
  return availabilityPromise
}

const ensureGhAuthenticated = async (token?: string) => {
  const cacheKey = token ? "provided-token" : "default"
  if (authCache.has(cacheKey)) {
    return authCache.get(cacheKey)!
  }

  const env = buildEnv(token)
  const promise = (async () => {
    if (token) {
      // Skip explicit auth checks when a token is provided; requests will fail if invalid.
      return
    }

    try {
      await execGhCommand(["auth", "token"], env)
    } catch (error) {
      if (error instanceof GhNotAuthenticatedError) {
        throw error
      }
      if (error instanceof GhCliError) {
        throw new GhNotAuthenticatedError(error.message)
      }
      throw error
    }
  })().catch((error) => {
    authCache.delete(cacheKey)
    throw error
  })

  authCache.set(cacheKey, promise)
  return promise
}

const fetchRateLimitSnapshot = async (token?: string): Promise<RateLimitSnapshot | null> => {
  try {
    await ensureGhAvailable()
    await ensureGhAuthenticated(token)
    const env = buildEnv(token)
    const { stdout } = await execGhCommand(["api", "rate_limit", "--method", "GET"], env)
    const parsed = JSON.parse(stdout) as {
      resources?: {
        core?: { limit?: number; remaining?: number; reset?: number }
      }
      rate?: { limit?: number; remaining?: number; reset?: number }
    }

    const core = parsed?.resources?.core ?? parsed?.rate
    if (!core) {
      return null
    }

    const now = Date.now()
    const limit = typeof core.limit === "number" ? core.limit : 5000
    const remaining = typeof core.remaining === "number" ? core.remaining : limit
    const resetAtRaw = typeof core.reset === "number" ? core.reset * 1000 : now + 60 * 1000

    return {
      limit,
      remaining,
      resetAt: resetAtRaw,
      fetchedAt: now,
    }
  } catch (error) {
    log.debug("Failed to refresh GitHub rate limit snapshot", { error })
    return null
  }
}

interface RateLimitState {
  snapshot: RateLimitSnapshot
  consecutiveHits: number
  lastFetch: number
}

class RateLimitTracker {
  private states = new Map<string, RateLimitState>()

  private getKey(token?: string) {
    return token ? "provided" : "default"
  }

  private createDefaultState(): RateLimitState {
    const now = Date.now()
    return {
      snapshot: {
        limit: 5000,
        remaining: 5000,
        resetAt: now + 60 * 60 * 1000,
        fetchedAt: now,
      },
      consecutiveHits: 0,
      lastFetch: 0,
    }
  }

  private getState(token?: string): RateLimitState {
    const key = this.getKey(token)
    if (!this.states.has(key)) {
      this.states.set(key, this.createDefaultState())
    }
    return this.states.get(key)!
  }

  async beforeRequest(token?: string) {
    const state = this.getState(token)
    await this.ensureFresh(token, state)
    if (state.snapshot.remaining > 0) {
      state.snapshot.remaining -= 1
    }
  }

  afterSuccess(token?: string) {
    const state = this.getState(token)
    state.consecutiveHits = 0
  }

  async onRateLimitError(token?: string) {
    const state = this.getState(token)
    state.consecutiveHits += 1
    const delayMs = Math.min(2 ** state.consecutiveHits * 1000, 60_000)
    log.warn("GitHub rate limit hit; backing off", {
      delayMs,
      tokenType: this.getKey(token),
    })
    await sleep(delayMs)
    await this.refresh(token, state, true)
  }

  isRateLimitError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false
    }

    if (error instanceof GhCliError) {
      if (error.stderr && isRateLimitErrorMessage(error.stderr)) {
        return true
      }
      return isRateLimitErrorMessage(error.message)
    }

    const maybe = error as { message?: unknown; stderr?: unknown }
    if (typeof maybe.stderr === "string" && isRateLimitErrorMessage(maybe.stderr)) {
      return true
    }
    if (typeof maybe.message === "string" && isRateLimitErrorMessage(maybe.message)) {
      return true
    }
    return false
  }

  getSnapshot(token?: string): RateLimitSnapshot {
    const state = this.getState(token)
    return { ...state.snapshot }
  }

  private async ensureFresh(token: string | undefined, state: RateLimitState) {
    const now = Date.now()
    if (now >= state.snapshot.resetAt) {
      await this.refresh(token, state, true)
      return
    }

    if (now - state.lastFetch > 60_000) {
      await this.refresh(token, state)
    }

    if (state.snapshot.remaining <= 1 && now < state.snapshot.resetAt) {
      const waitMs = state.snapshot.resetAt - now
      log.warn("GitHub rate limit near exhaustion; waiting", {
        waitMs,
        tokenType: this.getKey(token),
      })
      await sleep(waitMs)
      await this.refresh(token, state, true)
    }
  }

  private async refresh(token: string | undefined, state: RateLimitState, force = false) {
    const now = Date.now()
    if (!force && now - state.lastFetch < 15_000) {
      return
    }
    const snapshot = await fetchRateLimitSnapshot(token)
    if (snapshot) {
      state.snapshot = snapshot
      state.lastFetch = now
      state.consecutiveHits = 0
    } else {
      state.lastFetch = now
    }
  }
}

const rateLimitTracker = new RateLimitTracker()

const runGhJsonCommand = async <T>(
  args: string[],
  options: ExecGhOptions = {},
  attempt = 0
): Promise<T> => {
  await ensureGhAvailable()
  await ensureGhAuthenticated(options.token)
  await rateLimitTracker.beforeRequest(options.token)

  const env = buildEnv(options.token)
  let stdout: string

  try {
    const result = await execGhCommand(args, env)
    stdout = result.stdout
    rateLimitTracker.afterSuccess(options.token)
  } catch (error) {
    if (rateLimitTracker.isRateLimitError(error) && attempt < RATE_LIMIT_MAX_RETRIES) {
      await rateLimitTracker.onRateLimitError(options.token)
      return runGhJsonCommand<T>(args, options, attempt + 1)
    }
    throw error
  }

  try {
    return JSON.parse(stdout) as T
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new GhCliError(
      `Unable to parse JSON output from gh for command '${args.join(" ")}'${
        detail ? `: ${detail}` : ""
      }`,
      {
        stderr: stdout,
      }
    )
  }
}

const repoSlug = (repo: GitHubRepoRef) => `${repo.owner}/${repo.repo}`

const coerceId = (value: unknown, fallback: string | number): string | number => {
  if (value === null || value === undefined) {
    return fallback
  }

  if (typeof value === "number" || typeof value === "string") {
    return value
  }

  return fallback
}

const nodesToArray = <T>(value: unknown): T[] => {
  if (!value) return []
  if (Array.isArray(value)) return value as T[]
  if (typeof value === "object") {
    const maybe = value as { nodes?: unknown; edges?: unknown }
    if (Array.isArray(maybe.nodes)) {
      return maybe.nodes as T[]
    }
    if (Array.isArray(maybe.edges)) {
      return (maybe.edges as { node?: T }[]).map((edge) => edge.node).filter(Boolean) as T[]
    }
  }
  return []
}

interface GhActor {
  login: string
  url?: string | null
  avatarUrl?: string | null
  id?: string | null
}

interface GhLabel {
  id?: string | null
  name: string
  color?: string | null
  description?: string | null
}

interface GhIssueListItem {
  id?: string | null
  number: number
  title: string
  body?: string | null
  state: string
  createdAt: string
  updatedAt: string
  closedAt?: string | null
  url: string
  author?: GhActor | null
  assignees?: GhActor[] | { nodes?: GhActor[] } | null
  labels?: GhLabel[] | { nodes?: GhLabel[] } | null
}

interface GhIssueCommentNode {
  id?: string | null
  body?: string | null
  url?: string | null
  createdAt: string
  updatedAt: string
  author?: GhActor | null
}

interface GhIssueView extends GhIssueListItem {
  comments?: { nodes?: GhIssueCommentNode[] } | GhIssueCommentNode[] | null
}

interface GhPullRequestListItem {
  id?: string | null
  number: number
  title: string
  body?: string | null
  state: string
  isDraft?: boolean
  createdAt: string
  updatedAt: string
  closedAt?: string | null
  mergedAt?: string | null
  url: string
  author?: GhActor | null
  labels?: GhLabel[] | { nodes?: GhLabel[] } | null
  headRefName?: string | null
  headRefOid?: string | null
  baseRefName?: string | null
  baseRefOid?: string | null
}

interface GhReviewCommentNode {
  id?: string | null
  body?: string | null
  diffHunk?: string | null
  path?: string | null
  commit?: { oid?: string | null } | null
  originalCommit?: { oid?: string | null } | null
  createdAt: string
  updatedAt: string
  author?: GhActor | null
  url?: string | null
  originalLine?: number | null
  originalPosition?: number | null
  inReplyTo?: { id?: string | null } | null
}

interface GhPullRequestView extends GhPullRequestListItem {
  comments?: { nodes?: GhIssueCommentNode[] } | GhIssueCommentNode[] | null
  reviews?: { nodes?: { comments?: { nodes?: GhReviewCommentNode[] } | GhReviewCommentNode[] | null }[] } | null
  commits?: { nodes?: { oid: string }[] } | null
  statusCheckRollup?: { state?: string | null } | null
}

const toGitHubUser = (actor?: GhActor | null): GitHubUser => {
  if (!actor) {
    return {
      id: "anonymous",
      login: "ghost",
      avatar_url: null,
      html_url: null,
    }
  }
  return {
    id: coerceId(actor.id ?? actor.login, actor.login),
    login: actor.login,
    avatar_url: actor.avatarUrl ?? null,
    html_url: actor.url ?? null,
  }
}

const toGitHubLabel = (label: GhLabel): GitHubLabel => ({
  id: coerceId(label.id ?? label.name, label.name),
  name: label.name,
  color: label.color ?? null,
  description: label.description ?? null,
})

const toGitHubIssue = (issue: GhIssueListItem): GitHubIssue => ({
  id: coerceId(issue.id ?? issue.number, issue.number),
  number: issue.number,
  title: issue.title,
  state: issue.state.toLowerCase() === "open" ? "open" : "closed",
  html_url: issue.url,
  body: issue.body ?? null,
  created_at: issue.createdAt,
  updated_at: issue.updatedAt,
  closed_at: issue.closedAt ?? null,
  labels: nodesToArray<GhLabel>(issue.labels).map(toGitHubLabel),
  assignees: nodesToArray<GhActor>(issue.assignees).map(toGitHubUser),
  user: toGitHubUser(issue.author),
})

const toGitHubPullRequest = (
  repo: GitHubRepoRef,
  pull: GhPullRequestListItem
): GitHubPullRequest => ({
  id: coerceId(pull.id ?? pull.number, pull.number),
  number: pull.number,
  title: pull.title,
  state: pull.state.toLowerCase() === "open" ? "open" : "closed",
  draft: Boolean(pull.isDraft),
  html_url: pull.url,
  body: pull.body ?? null,
  created_at: pull.createdAt,
  updated_at: pull.updatedAt,
  closed_at: pull.closedAt ?? null,
  merged_at: pull.mergedAt ?? null,
  user: toGitHubUser(pull.author),
  labels: nodesToArray<GhLabel>(pull.labels).map(toGitHubLabel),
  head: {
    sha: pull.headRefOid ?? "",
    ref: pull.headRefName ?? "",
    label: pull.headRefName ? `${pull.author?.login ?? repo.owner}:${pull.headRefName}` : pull.headRefName ?? "",
  },
  base: {
    sha: pull.baseRefOid ?? "",
    ref: pull.baseRefName ?? "",
    label: pull.baseRefName ? `${repo.owner}:${pull.baseRefName}` : pull.baseRefName ?? "",
  },
})

const toIssueComment = (node: GhIssueCommentNode): GitHubIssueComment => ({
  id: coerceId(node.id ?? node.url ?? randomUUID(), node.url ?? "comment"),
  body: node.body ?? "",
  html_url: node.url ?? "",
  created_at: node.createdAt,
  updated_at: node.updatedAt,
  user: toGitHubUser(node.author),
})

const toReviewComment = (node: GhReviewCommentNode): GitHubReviewComment => ({
  id: coerceId(node.id ?? node.url ?? randomUUID(), node.url ?? "review-comment"),
  body: node.body ?? "",
  html_url: node.url ?? "",
  diff_hunk: node.diffHunk ?? "",
  path: node.path ?? "",
  commit_id: node.commit?.oid ?? "",
  original_commit_id: node.originalCommit?.oid ?? node.commit?.oid ?? "",
  created_at: node.createdAt,
  updated_at: node.updatedAt,
  user: toGitHubUser(node.author),
  original_line: node.originalLine ?? null,
  original_position: node.originalPosition ?? null,
  in_reply_to_id: (() => {
    const raw = node.inReplyTo?.id
    if (raw === null || raw === undefined) return null
    if (typeof raw === "number" && Number.isFinite(raw)) return raw
    if (typeof raw === "string") {
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  })(),
})

const toStatusSummary = (pull: GhPullRequestView): PullRequestStatusSummary => {
  const commits = nodesToArray<{ oid: string }>(pull.commits)
  const headSha = pull.headRefOid ?? commits.at(-1)?.oid ?? ""
  const state = (pull.statusCheckRollup?.state ?? "PENDING").toLowerCase()

  const overallState: PullRequestStatusSummary["overallState"] = (() => {
    switch (state) {
      case "success":
        return "success"
      case "failure":
      case "failed":
        return "failure"
      case "error":
        return "error"
      default:
        return "pending"
    }
  })()

  return {
    sha: headSha,
    overallState,
  }
}

const toGitHubRateLimit = (snapshot: RateLimitSnapshot): GitHubRateLimit => {
  const limit = Math.max(0, snapshot.limit)
  const remaining = Math.max(0, Math.min(limit, snapshot.remaining))
  const used = Math.max(0, limit - remaining)

  return {
    fetchedAt: new Date(snapshot.fetchedAt).toISOString(),
    core: {
      limit,
      remaining,
      used,
      resetAt: new Date(snapshot.resetAt).toISOString(),
    },
  }
}

export interface GitHubCliClientOptions {
  token?: string
}

export class GitHubCliClient {
  private token?: string
  private issueViewCache = new Map<string, GhIssueView>()
  private pullViewCache = new Map<string, GhPullRequestView>()

  constructor(options: GitHubCliClientOptions = {}) {
    this.token = options.token
  }

  setToken(token?: string) {
    this.token = token
  }

  getRateLimit(): GitHubRateLimit {
    const snapshot = rateLimitTracker.getSnapshot(this.token)
    return toGitHubRateLimit(snapshot)
  }

  getRateLimitSnapshot(): RateLimitSnapshot {
    return rateLimitTracker.getSnapshot(this.token)
  }

  async listIssues(repo: GitHubRepoRef, params: {
    state?: "open" | "closed" | "all"
    labels?: string[]
    sort?: "created" | "updated" | "comments"
    direction?: "asc" | "desc"
    perPage?: number
    assignee?: string
  } = {}): Promise<GitHubIssue[]> {
    const fields = [
      "id",
      "number",
      "title",
      "body",
      "state",
      "createdAt",
      "updatedAt",
      "closedAt",
      "url",
      "labels",
      "assignees",
      "author",
    ]

    const args = [
      "issue",
      "list",
      "--repo",
      repoSlug(repo),
      "--json",
      fields.join(","),
      "--limit",
      String(params.perPage ?? 50),
    ]

    if (params.state) {
      args.push("--state", params.state)
    }

    if (params.sort) {
      args.push("--sort", params.sort)
    }

    if (params.direction) {
      args.push("--direction", params.direction)
    }

    if (params.assignee) {
      args.push("--assignee", params.assignee)
    }

    if (params.labels?.length) {
      for (const label of params.labels) {
        args.push("--label", label)
      }
    }

    const payload = await runGhJsonCommand<GhIssueListItem[]>(args, { token: this.token })
    return payload.map(toGitHubIssue)
  }

  private async loadIssue(repo: GitHubRepoRef, issueNumber: number): Promise<GhIssueView> {
    const cacheKey = `${repo.owner}/${repo.repo}#${issueNumber}`
    if (this.issueViewCache.has(cacheKey)) {
      return this.issueViewCache.get(cacheKey)!
    }

    const fields = [
      "id",
      "number",
      "title",
      "body",
      "state",
      "url",
      "createdAt",
      "updatedAt",
      "closedAt",
      "author",
      "assignees",
      "labels",
      "comments",
    ]

    const args = [
      "issue",
      "view",
      String(issueNumber),
      "--repo",
      repoSlug(repo),
      "--json",
      fields.join(","),
    ]

    const payload = await runGhJsonCommand<GhIssueView>(args, { token: this.token })
    this.issueViewCache.set(cacheKey, payload)
    return payload
  }

  async getIssue(repo: GitHubRepoRef, issueNumber: number): Promise<GitHubIssue> {
    const issue = await this.loadIssue(repo, issueNumber)
    return toGitHubIssue(issue)
  }

  async fetchIssueComments(repo: GitHubRepoRef, issueNumber: number): Promise<GitHubIssueComment[]> {
    const issue = await this.loadIssue(repo, issueNumber)
    return nodesToArray<GhIssueCommentNode>(issue.comments).map(toIssueComment)
  }

  async listPullRequests(
    repo: GitHubRepoRef,
    params: {
      state?: "open" | "closed" | "all"
      sort?: "created" | "updated" | "popularity" | "long-running"
      direction?: "asc" | "desc"
      perPage?: number
      head?: string
      base?: string
    } = {}
  ): Promise<GitHubPullRequest[]> {
    const fields = [
      "id",
      "number",
      "title",
      "body",
      "state",
      "isDraft",
      "createdAt",
      "updatedAt",
      "closedAt",
      "mergedAt",
      "url",
      "labels",
      "author",
      "headRefName",
      "headRefOid",
      "baseRefName",
      "baseRefOid",
    ]

    const args = [
      "pr",
      "list",
      "--repo",
      repoSlug(repo),
      "--json",
      fields.join(","),
      "--limit",
      String(params.perPage ?? 30),
    ]

    if (params.state) {
      args.push("--state", params.state)
    }

    if (params.sort) {
      args.push("--sort", params.sort)
    }

    if (params.direction) {
      args.push("--direction", params.direction)
    }

    if (params.head) {
      args.push("--head", params.head)
    }

    if (params.base) {
      args.push("--base", params.base)
    }

    const payload = await runGhJsonCommand<GhPullRequestListItem[]>(args, { token: this.token })
    return payload.map((pull) => toGitHubPullRequest(repo, pull))
  }

  private async loadPullRequest(repo: GitHubRepoRef, pullNumber: number): Promise<GhPullRequestView> {
    const cacheKey = `${repo.owner}/${repo.repo}#pr-${pullNumber}`
    if (this.pullViewCache.has(cacheKey)) {
      return this.pullViewCache.get(cacheKey)!
    }

    const fields = [
      "id",
      "number",
      "title",
      "body",
      "state",
      "isDraft",
      "url",
      "createdAt",
      "updatedAt",
      "closedAt",
      "mergedAt",
      "author",
      "labels",
      "headRefName",
      "headRefOid",
      "baseRefName",
      "baseRefOid",
      "comments",
      "reviews",
      "commits",
      "statusCheckRollup",
    ]

    const args = [
      "pr",
      "view",
      String(pullNumber),
      "--repo",
      repoSlug(repo),
      "--json",
      fields.join(","),
    ]

    const payload = await runGhJsonCommand<GhPullRequestView>(args, { token: this.token })
    this.pullViewCache.set(cacheKey, payload)
    return payload
  }

  async getPullRequest(repo: GitHubRepoRef, pullNumber: number): Promise<GitHubPullRequest> {
    const pull = await this.loadPullRequest(repo, pullNumber)
    return toGitHubPullRequest(repo, pull)
  }

  async fetchPullRequestComments(repo: GitHubRepoRef, pullNumber: number): Promise<GitHubIssueComment[]> {
    const pull = await this.loadPullRequest(repo, pullNumber)
    return nodesToArray<GhIssueCommentNode>(pull.comments).map(toIssueComment)
  }

  async fetchPullRequestReviewComments(
    repo: GitHubRepoRef,
    pullNumber: number
  ): Promise<GitHubReviewComment[]> {
    const pull = await this.loadPullRequest(repo, pullNumber)
    const reviewNodes = nodesToArray<{ comments?: { nodes?: GhReviewCommentNode[] } | GhReviewCommentNode[] | null }>(
      pull.reviews
    )
    const comments: GitHubReviewComment[] = []
    for (const review of reviewNodes) {
      comments.push(...nodesToArray<GhReviewCommentNode>(review.comments).map(toReviewComment))
    }
    return comments
  }

  async getPullRequestStatus(
    repo: GitHubRepoRef,
    pullNumber: number
  ): Promise<PullRequestStatusSummary> {
    const pull = await this.loadPullRequest(repo, pullNumber)
    return toStatusSummary(pull)
  }

  async getPullRequestStatusesBatch(
    repo: GitHubRepoRef,
    pullNumbers: number[]
  ): Promise<Map<number, PullRequestStatusSummary>> {
    const uniqueNumbers = Array.from(new Set(pullNumbers)).filter((number) => Number.isInteger(number))
    if (!uniqueNumbers.length) {
      return new Map()
    }

    const segments = uniqueNumbers.map((number) => {
      const alias = `pr_${number}`
      return `${alias}: pullRequest(number: ${number}) { headRefOid statusCheckRollup { state } commits(last: 1) { nodes { oid } } }`
    })

    const query = `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${segments.join(
      " "
    )} } }`

    const args = [
      "api",
      "graphql",
      "-F",
      `owner=${repo.owner}`,
      "-F",
      `name=${repo.repo}`,
      "-f",
      `query=${query}`,
    ]

    const payload = await runGhJsonCommand<{ repository?: Record<string, unknown> }>(args, {
      token: this.token,
    })

    const repoData = (payload?.repository ?? {}) as Record<string, unknown>
    const summaries = new Map<number, PullRequestStatusSummary>()

    for (const number of uniqueNumbers) {
      const alias = `pr_${number}`
      const node = repoData[alias]
      if (!node || typeof node !== "object") {
        continue
      }
      const graphNode = node as {
        headRefOid?: string | null
        statusCheckRollup?: { state?: string | null } | null
        commits?: { nodes?: { oid?: string }[] } | null
      }
      const summary = toStatusSummary({
        headRefOid: graphNode.headRefOid ?? null,
        statusCheckRollup: graphNode.statusCheckRollup ?? null,
        commits: graphNode.commits ?? { nodes: [] },
      } as unknown as GhPullRequestView)
      summaries.set(number, summary)
    }

    return summaries
  }
}

export const __private__ = {
  buildEnv,
  execGhCommand,
  ensureGhAvailable,
  ensureGhAuthenticated,
  runGhJsonCommand,
}

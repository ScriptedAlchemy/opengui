/**
 * GitHub API Client
 *
 * Provides common helpers for working with GitHub repositories from the web UI.
 */

import type {
  GitHubIssue,
  GitHubIssueComment,
  GitHubPullRequest,
  GitHubRepoRef,
  GitHubReviewComment,
} from "@/shared/github-types"

export type {
  GitHubIssue,
  GitHubIssueComment,
  GitHubPullRequest,
  GitHubRepoRef,
  GitHubReviewComment,
} from "@/shared/github-types"

const GITHUB_BASE_URL = "https://api.github.com/"
const DEFAULT_USER_AGENT = "OpenCode-GitHub-Client"

type HeadersInitLike = Headers | Iterable<[string, string]> | Record<string, string>

export interface GitHubCommitStatus {
  id: number
  state: "error" | "failure" | "pending" | "success"
  context: string
  description: string | null
  target_url: string | null
  created_at: string
  updated_at: string
}

export interface GitHubCombinedStatus {
  state: "failure" | "pending" | "success" | "error"
  sha: string
  total_count: number
  statuses: GitHubCommitStatus[]
}

export interface GitHubCheckRun {
  id: number
  name: string
  html_url: string | null
  status: "queued" | "in_progress" | "completed"
  conclusion: "success" | "failure" | "neutral" | "cancelled" | "timed_out" | "action_required" | "stale" | null
  started_at: string | null
  completed_at: string | null
}

export interface GitHubCheckSuite {
  id: number
  status: "queued" | "in_progress" | "completed"
  conclusion: "success" | "failure" | "neutral" | "cancelled" | "timed_out" | "action_required" | "stale" | null
  html_url: string | null
  app?: {
    id: number
    name: string
    slug: string
  }
  latest_check_runs_count: number
}

export interface PullRequestStatusSummary {
  sha: string
  overallState: "success" | "pending" | "failure" | "error"
  combinedStatus?: GitHubCombinedStatus
  checkRuns?: GitHubCheckRun[]
  checkSuites?: GitHubCheckSuite[]
}

export interface FetchIssuesParams {
  state?: "open" | "closed" | "all"
  labels?: string[]
  sort?: "created" | "updated" | "comments"
  direction?: "asc" | "desc"
  page?: number
  perPage?: number
  assignee?: string
}

export interface FetchPullRequestsParams {
  state?: "open" | "closed" | "all"
  sort?: "created" | "updated" | "popularity" | "long-running"
  direction?: "asc" | "desc"
  page?: number
  perPage?: number
  head?: string
  base?: string
}

export interface GitHubClientOptions {
  token?: string
  baseUrl?: string
  userAgent?: string
}

function sanitizeRemote(remoteUrl: string): string {
  const trimmed = remoteUrl
    .trim()
    .replace(/\s+\(fetch\)$/i, "")
    .replace(/\s+\(push\)$/i, "")

  // Drop the remote name when parsing output from `git remote -v`
  const parts = trimmed.split(/\s+/)
  if (parts.length > 1) {
    return parts[parts.length - 1]
  }

  return trimmed
}

/**
 * Attempts to extract {owner, repo} information from a git remote URL.
 */
export function parseGitHubRemote(remoteUrl: string): GitHubRepoRef | null {
  const sanitized = sanitizeRemote(remoteUrl)

  if (!sanitized) {
    return null
  }

  // Handle SSH style remotes: git@github.com:owner/repo.git
  const sshMatch = sanitized.match(/^git@([^:]+):(.+?)$/)
  if (sshMatch) {
    const host = sshMatch[1].toLowerCase()
    if (!host.endsWith("github.com")) {
      return null
    }
    const pathPart = sshMatch[2].replace(/\.git$/, "")
    const segments = pathPart.split("/").filter(Boolean)
    if (segments.length >= 2) {
      return { owner: segments[0], repo: segments[1] }
    }
    return null
  }

  // Handle SSH URLs with explicit protocol: ssh://git@github.com/owner/repo.git
  if (sanitized.startsWith("ssh://") || sanitized.startsWith("git://")) {
    try {
      const url = new URL(sanitized)
      if (!url.hostname.toLowerCase().endsWith("github.com")) {
        return null
      }
      const segments = url.pathname.replace(/^\/+|\.git$/g, "").split("/").filter(Boolean)
      if (segments.length >= 2) {
        return { owner: segments[0], repo: segments[1] }
      }
    } catch {
      return null
    }
    return null
  }

  // Handle HTTPS (and HTTP) remotes
  const httpCandidate = sanitized.includes("://") ? sanitized : `https://${sanitized}`
  try {
    const url = new URL(httpCandidate)
    if (!url.hostname.toLowerCase().endsWith("github.com")) {
      return null
    }
    const segments = url.pathname.replace(/^\/+|\.git$/g, "").split("/").filter(Boolean)
    if (segments.length >= 2) {
      return { owner: segments[0], repo: segments[1] }
    }
  } catch {
    return null
  }

  return null
}

export class GitHubApiClient {
  private token?: string
  private baseUrl: string
  private userAgent: string

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token
    this.baseUrl = options.baseUrl ? ensureTrailingSlash(options.baseUrl) : GITHUB_BASE_URL
    this.userAgent = options.userAgent || DEFAULT_USER_AGENT
  }

  setToken(token?: string) {
    this.token = token
  }

  private buildHeaders(additional?: HeadersInit): HeadersInit {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": this.userAgent,
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    if (additional) {
      const additionalEntries = new Headers(additional)
      additionalEntries.forEach((value, key) => {
        headers[key] = value
      })
    }

    return headers
  }

  private buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
    const fullUrl = new URL(path.replace(/^\/+/, ""), this.baseUrl)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          fullUrl.searchParams.set(key, String(value))
        }
      })
    }

    return fullUrl.toString()
  }

  private async request<T>(
    path: string,
    options?: RequestInit,
    params?: Record<string, string | number | undefined>
  ): Promise<T> {
    const url = this.buildUrl(path, params)

    const response = await fetch(url, {
      ...options,
      headers: this.buildHeaders(options?.headers),
    })

    if (!response.ok) {
      const responseText = await response.text().catch(() => "Unable to read response body")
      const responseHeaders = Object.fromEntries(response.headers.entries())
      console.error("GitHub API request failed", {
        method: options?.method || "GET",
        url,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseText,
      })

      const errorMessage = (() => {
        try {
          const data = JSON.parse(responseText) as { message?: string }
          if (data?.message) {
            return data.message
          }
        } catch {
          // Ignore JSON parse failures
        }
        return response.statusText || "GitHub API request failed"
      })()

      throw new Error(`${errorMessage} (${options?.method || "GET"} ${url})`)
    }

    return response.json() as Promise<T>
  }

  private async requestPaginated<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
    perPage = 100
  ): Promise<T[]> {
    const results: T[] = []
    let page = 1

    // Clone params to avoid mutating caller-provided object
    const baseParams = { ...(params ?? {}) }

    while (true) {
      const pageParams = {
        ...baseParams,
        page,
        per_page: perPage,
      }
      const pageItems = await this.request<T[]>(path, undefined, pageParams)
      results.push(...pageItems)
      if (pageItems.length < perPage) {
        break
      }
      page += 1
    }

    return results
  }

  async getRepository(remoteUrl: string): Promise<GitHubRepoRef | null> {
    return parseGitHubRemote(remoteUrl)
  }

  async fetchIssues(repo: GitHubRepoRef, params: FetchIssuesParams = {}): Promise<GitHubIssue[]> {
    return this.request<GitHubIssue[]>(
      `/repos/${repo.owner}/${repo.repo}/issues`,
      undefined,
      {
        state: params.state,
        labels: params.labels?.join(","),
        sort: params.sort,
        direction: params.direction,
        page: params.page,
        per_page: params.perPage,
        assignee: params.assignee,
      }
    )
  }

  async fetchPullRequests(repo: GitHubRepoRef, params: FetchPullRequestsParams = {}): Promise<GitHubPullRequest[]> {
    return this.request<GitHubPullRequest[]>(
      `/repos/${repo.owner}/${repo.repo}/pulls`,
      undefined,
      {
        state: params.state,
        sort: params.sort,
        direction: params.direction,
        page: params.page,
        per_page: params.perPage,
        head: params.head,
        base: params.base,
      }
    )
  }

  async getIssue(repo: GitHubRepoRef, issueNumber: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}`)
  }

  async getPullRequest(repo: GitHubRepoRef, pullNumber: number): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(`/repos/${repo.owner}/${repo.repo}/pulls/${pullNumber}`)
  }

  async fetchIssueComments(repo: GitHubRepoRef, issueNumber: number): Promise<GitHubIssueComment[]> {
    return this.requestPaginated<GitHubIssueComment>(
      `/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}/comments`
    )
  }

  async fetchPullRequestComments(repo: GitHubRepoRef, pullNumber: number): Promise<GitHubIssueComment[]> {
    return this.fetchIssueComments(repo, pullNumber)
  }

  async fetchPullRequestReviewComments(
    repo: GitHubRepoRef,
    pullNumber: number
  ): Promise<GitHubReviewComment[]> {
    return this.requestPaginated<GitHubReviewComment>(
      `/repos/${repo.owner}/${repo.repo}/pulls/${pullNumber}/comments`
    )
  }

  async getCombinedStatus(repo: GitHubRepoRef, sha: string): Promise<GitHubCombinedStatus> {
    return this.request<GitHubCombinedStatus>(`/repos/${repo.owner}/${repo.repo}/commits/${sha}/status`)
  }

  async getCheckRuns(repo: GitHubRepoRef, sha: string): Promise<GitHubCheckRun[]> {
    const response = await this.request<{ total_count: number; check_runs: GitHubCheckRun[] }>(
      `/repos/${repo.owner}/${repo.repo}/commits/${sha}/check-runs`
    )
    return response.check_runs
  }

  async getCheckSuites(repo: GitHubRepoRef, sha: string): Promise<GitHubCheckSuite[]> {
    const response = await this.request<{ total_count: number; check_suites: GitHubCheckSuite[] }>(
      `/repos/${repo.owner}/${repo.repo}/commits/${sha}/check-suites`
    )
    return response.check_suites
  }

  async getPullRequestStatus(repo: GitHubRepoRef, pullNumber: number): Promise<PullRequestStatusSummary> {
    const pr = await this.getPullRequest(repo, pullNumber)
    const sha = pr.head.sha

    const [combinedStatus, checkRuns, checkSuites] = await Promise.all([
      this.getCombinedStatus(repo, sha).catch(() => null),
      this.getCheckRuns(repo, sha).catch(() => []),
      this.getCheckSuites(repo, sha).catch(() => []),
    ])

    const overallState = combinedStatus?.state || inferStateFromChecks(checkRuns)

    return {
      sha,
      overallState,
      combinedStatus: combinedStatus ?? undefined,
      checkRuns: checkRuns.length ? checkRuns : undefined,
      checkSuites: checkSuites.length ? checkSuites : undefined,
    }
  }
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`
}

function inferStateFromChecks(checkRuns: GitHubCheckRun[]): PullRequestStatusSummary["overallState"] {
  if (!checkRuns.length) {
    return "pending"
  }

  const conclusions = checkRuns
    .map((run) => run.conclusion)
    .filter((value): value is NonNullable<GitHubCheckRun["conclusion"]> => Boolean(value))

  if (!conclusions.length) {
    return "pending"
  }

  if (conclusions.some((c) => c === "failure" || c === "timed_out" || c === "cancelled" || c === "action_required")) {
    return "failure"
  }

  if (conclusions.every((c) => c === "success" || c === "neutral" || c === "stale")) {
    return conclusions.some((c) => c === "success") ? "success" : "pending"
  }

  return "pending"
}

export const githubApi = new GitHubApiClient()

export default githubApi

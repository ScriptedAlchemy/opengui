import type {
  GitHubIssue,
  GitHubIssueComment,
  GitHubPullRequest,
  GitHubRepoRef,
  GitHubReviewComment,
  GitHubRateLimit,
  PullRequestStatusSummary,
} from "@/shared/github-types"
import type { FetchIssuesParams, FetchPullRequestsParams } from "./github"

export type GitHubContentType = "issue" | "pull"

export interface GitHubContentRequestItem {
  type: GitHubContentType
  number: number
  updatedAt?: string
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

export interface GitHubContentBatchRequest {
  repo: GitHubRepoRef
  items?: GitHubContentRequestItem[]
  cacheTtlMs?: number | GitHubCacheTtlOverrides
  includeIssues?: FetchIssuesParams
  includePulls?: FetchPullRequestsParams
  includeStatuses?: boolean
}

export interface GitHubContentItem {
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

export interface GitHubContentErrorItem {
  type: GitHubContentType
  number: number
  message: string
  status?: number
  cached?: boolean
}

export interface GitHubContentBatchResponse {
  items: GitHubContentItem[]
  errors: GitHubContentErrorItem[]
  issues: GitHubIssue[]
  pulls: GitHubPullRequest[]
  statuses: Record<number, PullRequestStatusSummary | null>
  meta: {
    cacheHits: number
    cacheMisses: number
    staleHits: number
    warmed: number
    refreshed: number
    errorHits: number
  }
  rateLimit?: GitHubRateLimit | null
}

export interface FetchGitHubContentOptions {
  projectId: string
  request: GitHubContentBatchRequest
  signal?: AbortSignal
}

export async function fetchGitHubContent({
  projectId,
  request,
  signal,
}: FetchGitHubContentOptions): Promise<GitHubContentBatchResponse> {
  if (!projectId) {
    throw new Error("Project ID is required to fetch GitHub content")
  }

  const response = await fetch(`/api/projects/${projectId}/github/content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")
    throw new Error(
      `GitHub content request failed (${response.status} ${response.statusText})${errorBody ? `: ${errorBody}` : ""}`
    )
  }

  const payload = (await response.json()) as GitHubContentBatchResponse
  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    errors: Array.isArray(payload.errors) ? payload.errors : [],
    issues: Array.isArray(payload.issues) ? payload.issues : [],
    pulls: Array.isArray(payload.pulls) ? payload.pulls : [],
    statuses: payload.statuses && typeof payload.statuses === "object" ? payload.statuses : {},
    meta:
      payload.meta && typeof payload.meta === "object"
        ? {
            cacheHits: Number(payload.meta.cacheHits) || 0,
            cacheMisses: Number(payload.meta.cacheMisses) || 0,
            staleHits: Number(payload.meta.staleHits) || 0,
            warmed: Number(payload.meta.warmed) || 0,
            refreshed: Number(payload.meta.refreshed) || 0,
            errorHits: Number(payload.meta.errorHits) || 0,
          }
        : { cacheHits: 0, cacheMisses: 0, staleHits: 0, warmed: 0, refreshed: 0, errorHits: 0 },
    rateLimit:
      payload.rateLimit && typeof payload.rateLimit === "object"
        ? {
            fetchedAt: String(payload.rateLimit.fetchedAt ?? new Date().toISOString()),
            core: payload.rateLimit.core ?? null,
            graphql: payload.rateLimit.graphql ?? null,
            search: payload.rateLimit.search ?? null,
          }
        : null,
  }
}

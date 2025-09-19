import type {
  GitHubIssue,
  GitHubIssueComment,
  GitHubPullRequest,
  GitHubRepoRef,
  GitHubReviewComment,
} from "@/shared/github-types"

export type GitHubContentType = "issue" | "pull"

export interface GitHubContentRequestItem {
  type: GitHubContentType
  number: number
  updatedAt?: string
}

export interface GitHubContentBatchRequest {
  repo: GitHubRepoRef
  items: GitHubContentRequestItem[]
  cacheTtlMs?: number
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
  warning?: string
}

export interface GitHubContentErrorItem {
  type: GitHubContentType
  number: number
  message: string
  status?: number
}

export interface GitHubContentBatchResponse {
  items: GitHubContentItem[]
  errors: GitHubContentErrorItem[]
}

export interface FetchGitHubContentOptions {
  projectId: string
  request: GitHubContentBatchRequest
  token?: string
  signal?: AbortSignal
}

export async function fetchGitHubContent({
  projectId,
  request,
  token,
  signal,
}: FetchGitHubContentOptions): Promise<GitHubContentBatchResponse> {
  if (!projectId) {
    throw new Error("Project ID is required to fetch GitHub content")
  }

  if (!request.items.length) {
    throw new Error("At least one GitHub item must be requested")
  }

  const response = await fetch(`/api/projects/${projectId}/github/content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-GitHub-Token": token } : {}),
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
  }
}

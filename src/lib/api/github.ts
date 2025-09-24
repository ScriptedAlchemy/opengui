/**
 * GitHub API Client
 *
 * Provides common helpers for working with GitHub repositories from the web UI.
 */

import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepoRef,
  PullRequestStatusSummary,
} from "@/shared/github-types"

export type {
  GitHubCombinedStatus,
  GitHubCommitStatus,
  GitHubIssue,
  GitHubIssueComment,
  GitHubPullRequest,
  GitHubRepoRef,
  GitHubReviewComment,
  GitHubCheckRun,
  GitHubCheckSuite,
  PullRequestStatusSummary,
} from "@/shared/github-types"

export interface FetchIssuesParams {
  state?: "open" | "closed" | "all"
  labels?: string[]
  sort?: "created" | "updated" | "comments"
  direction?: "asc" | "desc"
  perPage?: number
  assignee?: string
}

export interface FetchPullRequestsParams {
  state?: "open" | "closed" | "all"
  sort?: "created" | "updated" | "popularity" | "long-running"
  direction?: "asc" | "desc"
  perPage?: number
  head?: string
  base?: string
}

interface GitHubListResponse<T> {
  items: T[]
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
      const segments = url.pathname
        .replace(/^\/+|\.git$/g, "")
        .split("/")
        .filter(Boolean)
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
    const segments = url.pathname
      .replace(/^\/+|\.git$/g, "")
      .split("/")
      .filter(Boolean)
    if (segments.length >= 2) {
      return { owner: segments[0], repo: segments[1] }
    }
  } catch {
    return null
  }

  return null
}

async function postProjectJson<T>(
  projectId: string,
  resourcePath: string,
  body: unknown
): Promise<T> {
  if (!projectId) {
    throw new Error("Project ID is required for this request")
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}${resourcePath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => "")
    const suffix = details ? `: ${details}` : ""
    throw new Error(`GitHub request failed (${response.status} ${response.statusText})${suffix}`)
  }

  return (await response.json()) as T
}

export class GitHubApiClient {
  // Token is no longer required; method retained for backwards compatibility.
  setToken(_token?: string) {}

  async fetchIssues(
    projectId: string,
    repo: GitHubRepoRef,
    params: FetchIssuesParams = {}
  ): Promise<GitHubIssue[]> {
    const payload = await postProjectJson<GitHubListResponse<GitHubIssue>>(
      projectId,
      "/github/issues/list",
      {
        repo,
        params,
      }
    )
    return Array.isArray(payload.items) ? payload.items : []
  }

  async fetchPullRequests(
    projectId: string,
    repo: GitHubRepoRef,
    params: FetchPullRequestsParams = {}
  ): Promise<GitHubPullRequest[]> {
    const payload = await postProjectJson<GitHubListResponse<GitHubPullRequest>>(
      projectId,
      "/github/pulls/list",
      {
        repo,
        params,
      }
    )
    return Array.isArray(payload.items) ? payload.items : []
  }

  async getPullRequestStatus(
    projectId: string,
    repo: GitHubRepoRef,
    pullNumber: number
  ): Promise<PullRequestStatusSummary> {
    const payload = await postProjectJson<PullRequestStatusSummary>(
      projectId,
      `/github/pulls/${pullNumber}/status`,
      {
        repo,
      }
    )
    return payload
  }
}

export const githubApi = new GitHubApiClient()

export default githubApi

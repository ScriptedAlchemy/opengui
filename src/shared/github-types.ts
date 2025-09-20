export interface GitHubRepoRef {
  owner: string
  repo: string
}

export interface GitHubUser {
  id: number | string
  login: string
  avatar_url?: string | null
  html_url?: string | null
}

export interface GitHubLabel {
  id: number | string
  name: string
  color?: string | null
  description?: string | null
}

export interface GitHubIssue {
  id: number | string
  number: number
  title: string
  state: "open" | "closed"
  html_url: string
  body?: string | null
  created_at: string
  updated_at: string
  closed_at?: string | null
  labels: GitHubLabel[]
  assignees: GitHubUser[]
  user: GitHubUser
  pull_request?: {
    html_url: string
    url: string
  }
}

export interface GitHubPullRequest {
  id: number | string
  number: number
  title: string
  state: "open" | "closed"
  draft: boolean
  html_url: string
  body?: string | null
  created_at: string
  updated_at: string
  closed_at?: string | null
  merged_at?: string | null
  user: GitHubUser
  labels?: GitHubLabel[]
  head: {
    sha: string
    ref: string
    label: string
  }
  base: {
    sha: string
    ref: string
    label: string
  }
}

export interface GitHubIssueComment {
  id: number | string
  body: string
  html_url: string
  created_at: string
  updated_at: string
  user: GitHubUser
}

export interface GitHubReviewComment {
  id: number | string
  body: string
  html_url: string
  diff_hunk: string
  path: string
  commit_id: string
  original_commit_id: string
  created_at: string
  updated_at: string
  user: GitHubUser
  original_line?: number | null
  original_position?: number | null
  in_reply_to_id?: number | null
}

export interface GitHubCommitStatus {
  id: number | string
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
  id: number | string
  name: string
  html_url: string | null
  status: "queued" | "in_progress" | "completed"
  conclusion:
    | "success"
    | "failure"
    | "neutral"
    | "cancelled"
    | "timed_out"
    | "action_required"
    | "stale"
    | null
  started_at: string | null
  completed_at: string | null
}

export interface GitHubCheckSuite {
  id: number | string
  status: "queued" | "in_progress" | "completed"
  conclusion:
    | "success"
    | "failure"
    | "neutral"
    | "cancelled"
    | "timed_out"
    | "action_required"
    | "stale"
    | null
  html_url: string | null
  app?: {
    id: number | string
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

export interface GitHubRateLimitResource {
  limit: number
  remaining: number
  used: number
  resetAt: string
}

export interface GitHubRateLimit {
  fetchedAt: string
  core?: GitHubRateLimitResource | null
  graphql?: GitHubRateLimitResource | null
  search?: GitHubRateLimitResource | null
}

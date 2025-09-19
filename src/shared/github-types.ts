export interface GitHubRepoRef {
  owner: string
  repo: string
}

export interface GitHubUser {
  id: number
  login: string
  avatar_url: string
  html_url: string
}

export interface GitHubLabel {
  id: number
  name: string
  color: string
  description?: string | null
}

export interface GitHubIssue {
  id: number
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
  id: number
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
  id: number
  body: string
  html_url: string
  created_at: string
  updated_at: string
  user: GitHubUser
}

export interface GitHubReviewComment {
  id: number
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

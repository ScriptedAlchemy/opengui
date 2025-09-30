export interface GitStatusFile {
  path: string
  status: string
  staged: boolean
  additions?: number
  deletions?: number
}

export interface GitStatusResponse {
  branch: string
  ahead: number
  behind: number
  changedFiles: number
  stagedCount: number
  unstagedCount: number
  untrackedCount: number
  staged: GitStatusFile[]
  modified: GitStatusFile[]
  untracked: GitStatusFile[]
  remoteUrl?: string
  lastCommit?: {
    hash: string
    message: string
    author: string
    date: string
  }
  recentCommits?: Array<{
    hash: string
    message: string
    author: string
    date: string
  }>
}

export interface GitSummary {
  branch: string
  changedFiles: number
  ahead: number
  behind: number
  staged: number
  unstaged: number
  untracked: number
  lastCommit?: {
    hash: string
    message: string
    author: string
    date: string
  }
  recentCommits?: Array<{
    hash: string
    message: string
    author: string
    date: string
  }>
}

const DEFAULT_WORKTREE = "default"

const buildGitStatusUrl = (projectId: string, worktreeId?: string) => {
  const params = new URLSearchParams()
  if (worktreeId && worktreeId !== DEFAULT_WORKTREE) {
    params.set("worktree", worktreeId)
  }
  const query = params.toString()
  return `/api/projects/${projectId}/git/status${query ? `?${query}` : ""}`
}

export async function fetchGitStatus(
  projectId: string,
  worktreeId?: string
): Promise<GitStatusResponse> {
  if (!projectId) {
    throw new Error("Project ID is required to fetch git status")
  }

  const response = await fetch(buildGitStatusUrl(projectId, worktreeId))

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "")
    throw new Error(
      `Git status request failed (${response.status} ${response.statusText})${bodyText ? `: ${bodyText}` : ""}`
    )
  }

  const data = (await response.json()) as GitStatusResponse
  return data
}

export async function fetchGitSummary(
  projectId: string,
  worktreeId?: string
): Promise<GitSummary | null> {
  if (!projectId) {
    return null
  }

  try {
    const status = await fetchGitStatus(projectId, worktreeId)
    return {
      branch: status.branch,
      changedFiles: status.changedFiles,
      ahead: status.ahead ?? 0,
      behind: status.behind ?? 0,
      staged: status.stagedCount ?? 0,
      unstaged: status.unstagedCount ?? 0,
      untracked: status.untrackedCount ?? 0,
      lastCommit: status.lastCommit,
      recentCommits: status.recentCommits,
    }
  } catch (error) {
    console.error("Failed to fetch git summary:", error)
    return null
  }
}

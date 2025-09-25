import type { OpencodeClient } from "@opencode-ai/sdk/client"

const DEFAULT_WORKTREE = "default"

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

type ShellClient = Pick<OpencodeClient, "session">

type SessionApi = ShellClient["session"] & {
  create?: (options: { query: { directory: string } }) => Promise<{ data?: { id?: string } }>
  delete?: (options: { path: { id: string }; query: { directory: string } }) => Promise<unknown>
}

type ShellResponse = Awaited<ReturnType<SessionApi["shell"]>>

export async function executeGitCommand(
  client: ShellClient,
  directory: string,
  command: string,
  agent = "git"
): Promise<ShellResponse> {
  if (!directory) {
    throw new Error("A working directory is required for git operations")
  }

  const sessionApi = client.session as SessionApi

  const createSession = typeof sessionApi.create === "function"
  const deleteSession = typeof sessionApi.delete === "function"

  if (!createSession || !deleteSession) {
    return sessionApi.shell({
      path: { id: "temp" },
      body: { command, agent },
      query: { directory },
    })
  }

  const session = await sessionApi.create({ query: { directory } })
  const sessionId = session.data?.id

  if (!sessionId) {
    throw new Error("Failed to create git session")
  }

  try {
    return await sessionApi.shell({
      path: { id: sessionId },
      body: { command, agent },
      query: { directory },
    })
  } finally {
    if (deleteSession) {
      try {
        await sessionApi.delete({ path: { id: sessionId }, query: { directory } })
      } catch (cleanupError) {
        console.warn("Failed to clean up git session", cleanupError)
      }
    }
  }
}

export function extractTextFromMessage(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined
  }

  const parts = (message as { parts?: unknown }).parts
  if (!Array.isArray(parts)) {
    return undefined
  }

  const textParts = parts
    .filter(
      (part): part is { type: "text"; text: string } =>
        part !== null &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
    )
    .map((part) => part.text)

  if (textParts.length === 0) {
    return undefined
  }

  return textParts.join("")
}

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

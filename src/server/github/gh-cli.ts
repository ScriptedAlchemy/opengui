import { execFile } from "node:child_process"
import { promisify } from "node:util"

import type {
  GitHubIssue,
  GitHubIssueComment,
  GitHubPullRequest,
  GitHubRepoRef,
  GitHubReviewComment,
} from "@/shared/github-types"

const execFileAsync = promisify(execFile)

const GH_BINARY = process.env.OPENCODE_GH_PATH || "gh"
const MAX_BUFFER = 20 * 1024 * 1024 // 20MB safeguard for large responses

const BASE_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GH_PROMPT_DISABLED: "1",
  GH_CLI_VERSION_CHECK: "never",
  GH_PAGER: "",
}

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

const normalizePath = (path: string) => path.replace(/^\/+/, "")

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

const runGhJson = async <T>(path: string, options: ExecGhOptions & { query?: Record<string, string | number | undefined> } = {}): Promise<T> => {
  await ensureGhAvailable()
  await ensureGhAuthenticated(options.token)

  const env = buildEnv(options.token)
  const query = options.query
  const queryString = query
    ? Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join("&")
    : ""
  const normalizedPath = normalizePath(path)
  const fullPath = queryString ? `${normalizedPath}?${queryString}` : normalizedPath
  const args = [
    "api",
    fullPath,
    "--header",
    "Accept: application/vnd.github+json",
  ]

  const { stdout } = await execGhCommand(args, env)

  try {
    return JSON.parse(stdout) as T
  } catch (error) {
    throw new GhCliError(
      `Unable to parse JSON output from gh for path '${fullPath}'`,
      {
        stderr: stdout,
      }
    )
  }
}

const runGhJsonPaginated = async <T>(
  path: string,
  options: ExecGhOptions & { query?: Record<string, string | number | undefined>; perPage?: number } = {}
): Promise<T[]> => {
  const results: T[] = []
  let page = 1
  const perPage = options.perPage ?? 100
  // Clone query parameters to avoid mutating caller state
  const baseQuery = { ...(options.query ?? {}) }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pageQuery = {
      ...baseQuery,
      page,
      per_page: perPage,
    }

    const payload = await runGhJson<T[]>(path, { ...options, query: pageQuery })
    results.push(...payload)

    if (payload.length < perPage) {
      break
    }

    page += 1
  }

  return results
}

export interface GitHubCliClientOptions {
  token?: string
}

export class GitHubCliClient {
  private token?: string

  constructor(options: GitHubCliClientOptions = {}) {
    this.token = options.token
  }

  setToken(token?: string) {
    this.token = token
  }

  async getIssue(repo: GitHubRepoRef, issueNumber: number): Promise<GitHubIssue> {
    return runGhJson<GitHubIssue>(`/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}`, {
      token: this.token,
    })
  }

  async getPullRequest(repo: GitHubRepoRef, pullNumber: number): Promise<GitHubPullRequest> {
    return runGhJson<GitHubPullRequest>(`/repos/${repo.owner}/${repo.repo}/pulls/${pullNumber}`, {
      token: this.token,
    })
  }

  async fetchIssueComments(repo: GitHubRepoRef, issueNumber: number): Promise<GitHubIssueComment[]> {
    return runGhJsonPaginated<GitHubIssueComment>(`/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}/comments`, {
      token: this.token,
    })
  }

  async fetchPullRequestComments(repo: GitHubRepoRef, pullNumber: number): Promise<GitHubIssueComment[]> {
    return this.fetchIssueComments(repo, pullNumber)
  }

  async fetchPullRequestReviewComments(
    repo: GitHubRepoRef,
    pullNumber: number
  ): Promise<GitHubReviewComment[]> {
    return runGhJsonPaginated<GitHubReviewComment>(`/repos/${repo.owner}/${repo.repo}/pulls/${pullNumber}/comments`, {
      token: this.token,
    })
  }
}

export const __private__ = {
  buildEnv,
  execGhCommand,
  ensureGhAvailable,
  ensureGhAuthenticated,
  runGhJson,
  runGhJsonPaginated,
}

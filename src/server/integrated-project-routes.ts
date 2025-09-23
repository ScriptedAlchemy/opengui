/**
 * Integrated Project Routes
 *
 * This module provides project management routes for the OpenCode app.
 * The server manages project metadata and provides the backend URL to clients.
 * Clients connect directly to the OpenCode backend using the SDK.
 */

import { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { resolver, validator as zValidator } from "hono-openapi/zod"
import { z } from "zod"
import { projectManager } from "./project-manager"
import {
  ProjectInfoSchema,
  ProjectCreateSchema,
  ProjectUpdateSchema,
  DirectoryListingSchema,
  HomeDirectorySchema,
} from "./project-schemas"
import { ERRORS } from "./shared-schemas"
import { Log } from "../util/log"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import nodePath from "node:path"
import * as nodeFs from "node:fs/promises"
import nodeOs from "node:os"
import { fetchGitHubContentBatch } from "./github/cache"
import {
  createServerGitHubClient,
  GhCliError,
  GhNotAuthenticatedError,
  GhNotInstalledError,
} from "./github/client"

const log = Log.create({ service: "integrated-project-routes" })

// In-memory agent store per project
// This keeps agents ephemeral for each project during server lifetime
// It satisfies Agent Management e2e without persisting to disk
type AgentRecord = {
  id: string
  name: string
  description?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  tools: string[]
  model?: string
  enabled: boolean
  isTemplate?: boolean
  createdAt: number
}

const agentsStore = new Map<string, Map<string, AgentRecord>>()
const execFileAsync = promisify(execFile)

const normalizePath = (value: string) =>
  nodePath.resolve(value).replace(/\\/g, "/").replace(/\/+$/, "")

const HOME_DIRECTORY = normalizePath(process.env["HOME"] || nodeOs.homedir())
const DIRECTORY_ENTRY_LIMIT = 200

const GitHubRepoSchema = z.object({
  owner: z.string().min(1, "Repository owner is required"),
  repo: z.string().min(1, "Repository name is required"),
})

const GitHubContentItemSchema = z.object({
  type: z.enum(["issue", "pull"]),
  number: z.number().int().positive("Item number must be positive"),
  updatedAt: z.string().optional(),
})

const GitHubCacheTtlOverridesSchema = z.object({
  issue: z.number().int().nonnegative().optional(),
  pull: z.number().int().nonnegative().optional(),
  issueComments: z.number().int().nonnegative().optional(),
  pullComments: z.number().int().nonnegative().optional(),
  reviewComments: z.number().int().nonnegative().optional(),
  pullStatus: z.number().int().nonnegative().optional(),
  issueList: z.number().int().nonnegative().optional(),
  pullList: z.number().int().nonnegative().optional(),
})

const GitHubCacheTtlSchema = z.union([
  z.number().int().nonnegative(),
  GitHubCacheTtlOverridesSchema,
])

const GitHubIssuesListParamsSchema = z.object({
  state: z.enum(["open", "closed", "all"]).optional(),
  labels: z.array(z.string()).optional(),
  sort: z.enum(["created", "updated", "comments"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  perPage: z.number().int().min(1).max(100).optional(),
  assignee: z.string().optional(),
})

const GitHubPullsListParamsSchema = z.object({
  state: z.enum(["open", "closed", "all"]).optional(),
  sort: z.enum(["created", "updated", "popularity", "long-running"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  perPage: z.number().int().min(1).max(100).optional(),
  head: z.string().optional(),
  base: z.string().optional(),
})

const GitHubContentRequestSchema = z.object({
  repo: GitHubRepoSchema,
  items: GitHubContentItemSchema.array().max(100).optional(),
  cacheTtlMs: GitHubCacheTtlSchema.optional(),
  includeIssues: GitHubIssuesListParamsSchema.nullable().optional(),
  includePulls: GitHubPullsListParamsSchema.nullable().optional(),
  includeStatuses: z.boolean().optional(),
})

const GitHubIssuesListRequestSchema = z.object({
  repo: GitHubRepoSchema,
  params: GitHubIssuesListParamsSchema.optional(),
})

const GitHubPullsListRequestSchema = z.object({
  repo: GitHubRepoSchema,
  params: GitHubPullsListParamsSchema.optional(),
})

const GitHubPullStatusRequestSchema = z.object({
  repo: GitHubRepoSchema,
})

const PullRequestStatusResponseSchema = z.object({
  sha: z.string(),
  overallState: z.enum(["success", "pending", "failure", "error"]),
  combinedStatus: z.unknown().optional(),
  checkRuns: z.unknown().optional(),
  checkSuites: z.unknown().optional(),
})

const formatGitHubError = (error: unknown): string => {
  if (error instanceof GhNotInstalledError) {
    return "GitHub CLI (gh) is not installed on this system. Install GitHub CLI to enable GitHub integration."
  }

  if (error instanceof GhNotAuthenticatedError) {
    return "GitHub CLI is not authenticated. Run `gh auth login` or provide a valid token."
  }

  if (error instanceof GhCliError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  try {
    return JSON.stringify(error)
  } catch {
    return "Unknown error"
  }
}

const PackageJsonResponseSchema = z.object({
  path: z.string(),
  packageJson: z.record(z.unknown()),
})

/**
 * Resolve a filesystem path to its realpath and ensure it remains within HOME.
 * This prevents symlink escapes (e.g., $HOME/foo -> /etc) and enforces an
 * absolute, normalized path for subsequent operations.
 */
const realpathWithinHome = async (inputPath: string): Promise<string> => {
  const absolute = normalizePath(inputPath)
  const resolved = normalizePath(await nodeFs.realpath(absolute))
  if (!(resolved === HOME_DIRECTORY || resolved.startsWith(`${HOME_DIRECTORY}/`))) {
    throw Object.assign(new Error("Path must be within the home directory"), { status: 400 })
  }
  return resolved
}

const getAgentStoreKey = (projectId: string, worktreePath?: string) => {
  if (!worktreePath) return `${projectId}::default`
  return `${projectId}::${normalizePath(worktreePath)}`
}

const resolveProjectRecord = (id: string) => {
  const direct = projectManager.getProject(id)
  if (direct) {
    return { project: direct, canonicalId: id }
  }

  const all = projectManager.getAllProjects()
  const match = all.find((item) => id.startsWith(item.id) || item.id.startsWith(id))
  if (match) {
    return { project: match, canonicalId: match.id }
  }

  return null
}

const resolveWorktreeMetadata = (projectId: string, worktreeId: string) => {
  const direct = projectManager.findWorktreeById(projectId, worktreeId)
  if (direct) return direct

  const worktrees = projectManager.getWorktrees(projectId)
  return worktrees.find((tree) => worktreeId.startsWith(tree.id) || tree.id.startsWith(worktreeId))
}

type ParsedWorktree = {
  path: string
  branch?: string
  head?: string
  isPrimary: boolean
  isDetached: boolean
  isLocked: boolean
  lockReason?: string
  relativePath: string
}

type GitFileInfo = {
  path: string
  status: string
  staged: boolean
}

type GitStatusPayload = {
  branch: string
  ahead: number
  behind: number
  changedFiles: number
  stagedCount: number
  unstagedCount: number
  untrackedCount: number
  staged: GitFileInfo[]
  modified: GitFileInfo[]
  untracked: GitFileInfo[]
  remoteUrl?: string
  lastCommit?: {
    hash: string
    author: string
    date: string
    message: string
  }
  recentCommits?: Array<{
    hash: string
    author: string
    date: string
    message: string
  }>
}

const createEmptyGitStatus = (): GitStatusPayload => ({
  branch: "unknown",
  ahead: 0,
  behind: 0,
  changedFiles: 0,
  stagedCount: 0,
  unstagedCount: 0,
  untrackedCount: 0,
  staged: [],
  modified: [],
  untracked: [],
  recentCommits: [],
})

const GitFileSchema = z.object({
  path: z.string(),
  status: z.string(),
  staged: z.boolean(),
})

const parseGitStatusOutput = (output: string) => {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)

  let branch = "unknown"
  let ahead = 0
  let behind = 0
  const staged: GitFileInfo[] = []
  const modified: GitFileInfo[] = []
  const untracked: GitFileInfo[] = []

  for (const line of lines) {
    if (line.startsWith("##")) {
      const branchInfo = line.slice(2).trim()
      const aheadMatch = branchInfo.match(/ahead (\d+)/)
      if (aheadMatch) ahead = Number.parseInt(aheadMatch[1], 10)
      const behindMatch = branchInfo.match(/behind (\d+)/)
      if (behindMatch) behind = Number.parseInt(behindMatch[1], 10)

      let branchSection = branchInfo
      const bracketIndex = branchSection.indexOf(" [")
      if (bracketIndex !== -1) {
        branchSection = branchSection.slice(0, bracketIndex)
      }
      const ellipsisIndex = branchSection.indexOf("...")
      if (ellipsisIndex !== -1) {
        branchSection = branchSection.slice(0, ellipsisIndex)
      }
      branchSection = branchSection.trim()

      if (branchSection.startsWith("No commits yet on ")) {
        branch = branchSection.replace("No commits yet on ", "").trim() || "unknown"
      } else if (branchSection.startsWith("HEAD")) {
        branch = "HEAD"
      } else if (branchSection.length > 0) {
        branch = branchSection
      }
      continue
    }

    if (line.startsWith("??")) {
      const filePath = line.slice(3).trim()
      if (filePath) {
        untracked.push({ path: filePath, status: "??", staged: false })
      }
      continue
    }

    if (line.length >= 3) {
      const statusCode = line.slice(0, 2)
      const filePath = line.slice(3).trim()
      if (!filePath) continue

      const trimmedStatus = statusCode.trim() || statusCode
      const isStaged = statusCode[0] !== " " && statusCode[0] !== "?"

      const file: GitFileInfo = {
        path: filePath,
        status: trimmedStatus,
        staged: isStaged,
      }

      if (isStaged) {
        staged.push(file)
      } else {
        modified.push(file)
      }
    }
  }

  const changedFiles = staged.length + modified.length + untracked.length

  return { branch, ahead, behind, staged, modified, untracked, changedFiles }
}

const parseWorktreeOutput = (output: string, projectPath: string): ParsedWorktree[] => {
  if (!output.trim()) return []
  const normalizedProject = normalizePath(projectPath)
  const result: ParsedWorktree[] = []
  let current: Partial<ParsedWorktree> & { path?: string; __prunable__?: boolean } = {}

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith("worktree ")) {
      if (current.path && !current.__prunable__) {
        result.push(current as ParsedWorktree)
      }
      current = { path: normalizePath(line.substring("worktree ".length).trim()) }
      continue
    }
    if (!current.path) continue
    if (line.startsWith("branch ")) {
      current.branch = line.substring("branch ".length).replace(/^refs\/heads\//, "")
      continue
    }
    if (line.startsWith("HEAD ")) {
      current.head = line.substring("HEAD ".length)
      continue
    }
    if (line === "detached") {
      current.isDetached = true
      continue
    }
    if (line.startsWith("locked")) {
      current.isLocked = true
      const reason = line.substring("locked".length).trim()
      if (reason) current.lockReason = reason
      continue
    }
    if (line.startsWith("prunable")) {
      // Mark this block as prunable so we can skip it entirely
      current.__prunable__ = true
      continue
    }
  }

  if (current.path && !current.__prunable__) {
    result.push(current as ParsedWorktree)
  }

  return result.map((item) => {
    const relative = normalizePath(item.path!) === normalizedProject
      ? ""
      : nodePath.relative(normalizedProject, item.path!)
    return {
      path: item.path!,
      branch: item.branch,
      head: item.head,
      isPrimary: item.path === normalizedProject,
      isDetached: item.isDetached ?? false,
      isLocked: item.isLocked ?? false,
      lockReason: item.lockReason,
      relativePath: relative,
    }
  })
}

const resolveWorktreePath = (projectPath: string, worktreePath: string) => {
  if (nodePath.isAbsolute(worktreePath)) return normalizePath(worktreePath)
  return normalizePath(nodePath.join(projectPath, worktreePath))
}

type WorktreeResponse = {
  id: string
  title: string
  path: string
  relativePath: string
  branch?: string
  head?: string
  isPrimary: boolean
  isDetached: boolean
  isLocked: boolean
  lockReason?: string
}

const buildWorktreeResponses = async (projectId: string): Promise<WorktreeResponse[]> => {
  const project = projectManager.getProject(projectId)
  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  // First pass: list worktrees and detect stale entries
  let { stdout } = await execFileAsync("git", ["worktree", "list", "--porcelain"], {
    cwd: project.path,
  })

  // If git reports prunable entries, proactively prune to self-heal
  if (/\bprunable\b/i.test(stdout)) {
    try {
      await execFileAsync("git", ["worktree", "prune"], { cwd: project.path })
      // Re-list after pruning
      const res = await execFileAsync("git", ["worktree", "list", "--porcelain"], {
        cwd: project.path,
      })
      stdout = res.stdout
    } catch (pruneError) {
      // Non-fatal: continue with whatever we can parse; UI will still hide prunable entries
      log.warn("git worktree prune failed:", pruneError)
    }
  }

  // Parse and implicitly ignore prunable entries
  let parsed = parseWorktreeOutput(stdout, project.path)

  // Guard: filter out any worktree paths that no longer exist on disk
  if (parsed.length > 0) {
    const existence = await Promise.all(
      parsed.map(async (entry) => {
        try {
          const stat = await nodeFs.stat(entry.path)
          return stat.isDirectory()
        } catch {
          return false
        }
      })
    )
    parsed = parsed.filter((_, idx) => existence[idx])
  }
  const metadataList = projectManager.getWorktrees(projectId)

  const responses = parsed.map((entry) => {
    const metadata =
      metadataList.find((candidate) => normalizePath(candidate.path) === entry.path) ||
      projectManager.ensureWorktreeMetadata(
        projectId,
        entry.path,
        entry.branch || entry.relativePath || entry.path
      )

    if (!metadata) {
      throw new Error(`Unable to resolve metadata for worktree ${entry.path}`)
    }

    // If this is the primary worktree (the project root), prefer showing the git branch
    // as the title instead of a generic "(default)" suffix seeded at project creation.
    // Only override when the existing title looks like a default placeholder.
    if (entry.isPrimary) {
      const desired = entry.branch || "main"
      const looksDefault = !metadata.title || /\(default\)\s*$/i.test(metadata.title) || metadata.title.toLowerCase() === "default"
      if (looksDefault && metadata.title !== desired) {
        try {
          projectManager.updateWorktreeTitle(projectId, metadata.id, desired)
          metadata.title = desired
        } catch {
          // non-fatal; continue with existing title
        }
      }
    }

    return {
      id: metadata.id,
      title: metadata.title,
      path: metadata.path,
      relativePath: entry.relativePath,
      branch: entry.branch,
      head: entry.head,
      isPrimary: entry.isPrimary,
      isDetached: entry.isDetached,
      isLocked: entry.isLocked,
      lockReason: entry.lockReason,
    }
  })

  // Clean up orphaned metadata: any non-default worktree not present in git list
  try {
    const presentPaths = new Set(parsed.map((p) => p.path))
    for (const meta of metadataList) {
      if (meta.id === "default") continue
      if (!presentPaths.has(normalizePath(meta.path))) {
        try {
          projectManager.removeWorktreeMetadata(projectId, meta.id)
        } catch (e) {
          log.warn(`Failed removing orphaned worktree metadata ${meta.id}:`, e)
        }
      }
    }
  } catch (metaError) {
    log.warn("Failed during worktree metadata cleanup:", metaError)
  }

  await projectManager.saveProjects()
  return responses
}

function getProjectAgents(projectId: string, worktreePath?: string) {
  const key = getAgentStoreKey(projectId, worktreePath)
  if (!agentsStore.has(key)) {
    const initial = new Map<string, AgentRecord>()
    // Seed with a built-in example agent for UX/tests
    initial.set("claude", {
      id: "claude",
      name: "Claude",
      description: "Built-in assistant",
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: "You are Claude, a helpful built-in agent.",
      tools: [],
      model: "default",
      enabled: true,
      isTemplate: true,
      createdAt: Date.now(),
    })
    agentsStore.set(key, initial)
  }
  return agentsStore.get(key)!
}

/**
 * Adds integrated project management routes to a Hono app instance.
 *
 * This function extends the provided Hono app with project management
 * capabilities that directly bootstrap OpenCode instances.
 *
 * @param app - The Hono app instance to extend with integrated project routes
 * @returns The extended Hono app with integrated project routes added
 */
export function addIntegratedProjectRoutes(app: Hono) {
  return (
    app
      // GET /api/backend-url - get the OpenCode backend URL for client usage
      .get(
        "/api/backend-url",
        describeRoute({
          description: "Get base URL for OpenCode API calls",
          operationId: "backend.url",
          responses: {
            200: {
              description: "Base URL",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      url: z.string(),
                    })
                  ),
                },
              },
            },
            503: {
              description: "Backend not available",
            },
          },
        }),
        async (c) => {
          // Ensure backend has started
          if (!process.env.OPENCODE_API_URL) {
            return c.json({ error: "OpenCode backend not available" }, 503)
          }
          // Return proxied base path so clients avoid CORS and hit this server
          return c.json({ url: "/opencode" })
        }
      )

      // GET /api/projects - list all projects
      .get(
        "/api/system/home",
        describeRoute({
          description: "Get the current user's home directory",
          operationId: "system.home",
          responses: {
            200: {
              description: "Home directory path",
              content: {
                "application/json": {
                  schema: resolver(HomeDirectorySchema),
                },
              },
            },
            ...ERRORS,
          },
        }),
        async (c) => {
          return c.json({ path: HOME_DIRECTORY })
        }
      )

      .get(
        "/api/system/package-json",
        describeRoute({
          description: "Read a package.json file within the user's home directory",
          operationId: "system.packageJson",
          responses: {
            200: {
              description: "package.json contents",
              content: {
                "application/json": {
                  schema: resolver(PackageJsonResponseSchema),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "query",
          z.object({
            path: z.string().min(1, "Path is required"),
          })
        ),
        async (c) => {
          const { path } = c.req.valid("query")
          const requestedPath = path.trim()
          if (!requestedPath) {
            return c.json({ error: "Path is required" }, 400)
          }

          let packageJsonPath: string
          try {
            packageJsonPath = await realpathWithinHome(requestedPath)
          } catch (e) {
            return c.json({ error: (e as Error).message }, 400)
          }

          try {
            const stat = await nodeFs.stat(packageJsonPath)
            if (stat.isDirectory()) {
              packageJsonPath = normalizePath(nodePath.join(packageJsonPath, "package.json"))
            } else if (!stat.isFile()) {
              return c.json({ error: "Path must be a directory or package.json file" }, 400)
            }
          } catch (error) {
            const nodeError = error as NodeJS.ErrnoException
            if (nodeError?.code === "ENOENT") {
              return c.json({ error: "Path not found" }, 404)
            }
            log.error("Failed to inspect path for package.json", { path: packageJsonPath, error })
            return c.json({ error: "Unable to read path" }, 400)
          }

          // Re-validate after potential directory-to-file resolution
          try {
            packageJsonPath = await realpathWithinHome(packageJsonPath)
          } catch (e) {
            return c.json({ error: (e as Error).message }, 400)
          }

          let fileContents: string
          try {
            fileContents = await nodeFs.readFile(packageJsonPath, "utf-8")
          } catch (error) {
            const nodeError = error as NodeJS.ErrnoException
            if (nodeError?.code === "ENOENT") {
              return c.json({ error: "package.json not found" }, 404)
            }
            log.error("Failed to read package.json", { path: packageJsonPath, error })
            return c.json({ error: "Unable to read package.json" }, 400)
          }

          let parsed: unknown
          try {
            parsed = JSON.parse(fileContents)
          } catch (error) {
            log.error("Invalid package.json (parse error)", { path: packageJsonPath, error })
            return c.json({ error: "Invalid package.json: unable to parse JSON" }, 400)
          }

          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            log.error("Invalid package.json (unexpected structure)", { path: packageJsonPath })
            return c.json({ error: "Invalid package.json: expected an object" }, 400)
          }

          const packageJson = parsed as Record<string, unknown>

          return c.json({ path: packageJsonPath, packageJson })
        }
      )

      .get(
        "/api/system/list-directory",
        describeRoute({
          description: "List directories within the user's home directory",
          operationId: "system.listDirectory",
          responses: {
            200: {
              description: "Directory listing",
              content: {
                "application/json": {
                  schema: resolver(DirectoryListingSchema),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "query",
          z.object({
            path: z.string().optional(),
          })
        ),
        async (c) => {
          const { path } = c.req.valid("query")
          let target = path && path.trim() ? path : HOME_DIRECTORY
          try {
            target = await realpathWithinHome(target)
          } catch (e) {
            return c.json({ error: (e as Error).message }, 400)
          }

          try {
            const stats = await nodeFs.stat(target)
            if (!stats.isDirectory()) {
              return c.json({ error: "Path is not a directory" }, 400)
            }

            const entries = await nodeFs.readdir(target, { withFileTypes: true })
            const directories = entries
              .filter((entry) => entry.isDirectory())
              .map((entry) => {
                const entryPath = normalizePath(nodePath.join(target, entry.name))
                return {
                  name: entry.name,
                  path: entryPath,
                  isDirectory: true as const,
                }
              })
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
              .slice(0, DIRECTORY_ENTRY_LIMIT)

            const parent = target === HOME_DIRECTORY ? null : normalizePath(nodePath.dirname(target))

            return c.json({
              path: target,
              parent,
              entries: directories,
            })
          } catch (error) {
            log.error("Failed to list directory", { target, error })
            return c.json({ error: "Unable to list directory contents" }, 400)
          }
        }
      )

      .get(
        "/api/projects",
        describeRoute({
          description: "List all projects",
          operationId: "projects.list",
          responses: {
            200: {
              description: "List of projects",
              content: {
                "application/json": {
                  schema: resolver(ProjectInfoSchema.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const projects = projectManager.getAllProjects()
          // Add instance structure for compatibility
          const projectsWithInstance = projects.map((p) => ({
            ...p,
            instance: {
              status: p.status || "stopped",
            },
          }))
          return c.json(projectsWithInstance)
        }
      )

      // POST /api/projects - add new project
      .post(
        "/api/projects",
        describeRoute({
          description: "Add a new project",
          operationId: "projects.create",
          responses: {
            200: {
              description: "Successfully created project",
              content: {
                "application/json": {
                  schema: resolver(ProjectInfoSchema),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator("json", ProjectCreateSchema),
        async (c) => {
          const { path, name } = c.req.valid("json")
          // Use the imported projectManager directly

          try {
            const project = await projectManager.addProject(path, name)
            return c.json(project)
          } catch (error) {
            log.error("Failed to add project:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to add project" },
              400
            )
          }
        }
      )

      // GET /api/projects/:id - get project details
      .get(
        "/api/projects/:id",
        describeRoute({
          description: "Get project details",
          operationId: "projects.get",
          responses: {
            200: {
              description: "Project details",
              content: {
                "application/json": {
                  schema: resolver(ProjectInfoSchema),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")
          // Use the imported projectManager directly
          const project = projectManager.getProject(id)

          if (!project) {
            return c.json({ error: "Project not found" }, 404)
          }

          // Add instance structure for compatibility
          return c.json({
            ...project,
            instance: {
              status: project.status || "stopped",
            },
          })
        }
      )

      // PATCH /api/projects/:id - update project
      .patch(
        "/api/projects/:id",
        describeRoute({
          description: "Update project properties",
          operationId: "projects.update",
          responses: {
            200: {
              description: "Successfully updated project",
              content: {
                "application/json": {
                  schema: resolver(ProjectInfoSchema),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        zValidator("json", ProjectUpdateSchema),
        async (c) => {
          const { id } = c.req.valid("param")
          const updates = c.req.valid("json")
          // Use the imported projectManager directly

          try {
            const project = projectManager.getProject(id)
            if (!project) {
              return c.json({ error: "Project not found" }, 404)
            }

            // Update the project properties
            if (updates.name !== undefined) {
              project.name = updates.name
            }

            // Save the updated projects
            await projectManager.saveProjects()

            return c.json(project)
          } catch (error) {
            log.error("Failed to update project:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to update project" },
              400
            )
          }
        }
      )

      // PUT /api/projects/:id - update project (alias)
      .put(
        "/api/projects/:id",
        describeRoute({
          description: "Update project properties (alias for PATCH)",
          operationId: "projects.updateAlias",
          responses: {
            200: {
              description: "Successfully updated project",
              content: {
                "application/json": {
                  schema: resolver(ProjectInfoSchema),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        zValidator("json", ProjectUpdateSchema),
        async (c) => {
          const { id } = c.req.valid("param")
          const updates = c.req.valid("json")
          // Use the imported projectManager directly

          try {
            const project = projectManager.getProject(id)
            if (!project) {
              return c.json({ error: "Project not found" }, 404)
            }

            // Update the project properties
            if (updates.name !== undefined) {
              project.name = updates.name
            }

            // Save the updated projects
            await projectManager.saveProjects()

            return c.json(project)
          } catch (error) {
            log.error("Failed to update project:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to update project" },
              400
            )
          }
        }
      )

      // DELETE /api/projects/:id - remove project
      .delete(
        "/api/projects/:id",
        describeRoute({
          description: "Remove a project",
          operationId: "projects.delete",
          responses: {
            200: {
              description: "Successfully removed project",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")
          // Use the imported projectManager directly

          try {
            const success = await projectManager.removeProject(id)
            if (!success) {
              return c.json({ error: "Project not found" }, 404)
            }
            return c.json(true)
          } catch (error) {
            log.error("Failed to remove project:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to remove project" },
              400
            )
          }
        }
      )

      // POST /api/projects/:id/start - mark project as started (SDK handles actual operations)
      .post(
        "/api/projects/:id/start",
        describeRoute({
          description: "Mark project as running (no process spawning, SDK-only)",
          operationId: "projects.start",
          responses: {
            200: {
              description: "Successfully marked as started",
              content: {
                "application/json": {
                  schema: resolver(ProjectInfoSchema),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")

          try {
            const project = projectManager.getProject(id)
            if (!project) {
              return c.json({ error: "Project not found" }, 404)
            }

            // Just mark as running - SDK handles actual operations
            project.status = "running"
            project.lastAccessed = Date.now()
            await projectManager.saveProjects()

            // Return with instance structure for compatibility
            return c.json({
              ...project,
              instance: {
                status: "running",
              },
            })
          } catch (error) {
            log.error("Failed to start project:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to start project" },
              400
            )
          }
        }
      )

      // POST /api/projects/:id/stop - mark project as stopped (SDK handles actual operations)
      .post(
        "/api/projects/:id/stop",
        describeRoute({
          description: "Mark project as stopped (no process management, SDK-only)",
          operationId: "projects.stop",
          responses: {
            200: {
              description: "Successfully marked as stopped",
              content: {
                "application/json": {
                  schema: resolver(ProjectInfoSchema),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")

          try {
            const project = projectManager.getProject(id)
            if (!project) {
              return c.json({ error: "Project not found" }, 404)
            }

            // Just mark as stopped - SDK handles actual operations
            project.status = "stopped"
            project.lastAccessed = Date.now()
            await projectManager.saveProjects()

            // Return with instance structure for compatibility
            return c.json({
              ...project,
              instance: {
                status: "stopped",
              },
            })
          } catch (error) {
            log.error("Failed to stop project:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to stop project" },
              400
            )
          }
        }
      )

      // GET /api/projects/:id/status - get project status (simplified for SDK)
      .get(
        "/api/projects/:id/status",
        describeRoute({
          description: "Get project status",
          operationId: "projects.status",
          responses: {
            200: {
              description: "Project status",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      status: z.enum(["stopped", "running"]),
                      lastAccessed: z.number().optional(),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")
          // Use the imported projectManager directly
          const project = projectManager.getProject(id)

          if (!project) {
            return c.json({ error: "Project not found" }, 404)
          }

          // Return simplified status for SDK architecture
          const status = project.status === "running" ? "running" : "stopped"

          return c.json({
            status,
            lastAccessed: project.lastAccessed,
          })
        }
      )

      // GET /api/projects/:id/worktrees - list git worktrees
      .get(
        "/api/projects/:id/worktrees",
        describeRoute({
          description: "List git worktrees for a project",
          operationId: "projects.worktrees.list",
          responses: {
            200: {
              description: "Worktree list",
              content: {
                "application/json": {
                  schema: resolver(
                    z.array(
                      z.object({
                        id: z.string(),
                        title: z.string(),
                        path: z.string(),
                        relativePath: z.string(),
                        branch: z.string().optional(),
                        head: z.string().optional(),
                        isPrimary: z.boolean(),
                        isDetached: z.boolean(),
                        isLocked: z.boolean(),
                        lockReason: z.string().optional(),
                      })
                    )
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator("param", z.object({ id: z.string() })),
        async (c) => {
          const { id } = c.req.valid("param")
          try {
            const worktrees = await buildWorktreeResponses(id)
            return c.json(worktrees)
          } catch (error) {
            log.error("Failed to list worktrees:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to list worktrees" },
              400
            )
          }
        }
      )

      // POST /api/projects/:id/worktrees - create a new git worktree
      .post(
        "/api/projects/:id/worktrees",
        describeRoute({
          description: "Create a git worktree",
          operationId: "projects.worktrees.create",
          responses: {
            201: {
              description: "Created worktree",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      id: z.string(),
                      title: z.string(),
                      path: z.string(),
                      relativePath: z.string(),
                      branch: z.string().optional(),
                      head: z.string().optional(),
                      isPrimary: z.boolean(),
                      isDetached: z.boolean(),
                      isLocked: z.boolean(),
                      lockReason: z.string().optional(),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator("param", z.object({ id: z.string() })),
        zValidator(
          "json",
          z.object({
            path: z.string().min(1),
            title: z.string().min(1),
            branch: z.string().optional(),
            baseRef: z.string().optional(),
            createBranch: z.boolean().optional(),
            force: z.boolean().optional(),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")
          const body = c.req.valid("json")
          const project = projectManager.getProject(id)
          if (!project) {
            return c.json({ error: "Project not found" }, 404)
          }

          try {
            const resolvedPath = resolveWorktreePath(project.path, body.path)
            const args = ["worktree", "add"] as string[]
            if (body.force) {
              args.push("--force")
            }
            if (body.createBranch) {
              if (!body.branch) {
                return c.json({ error: "Branch name required when creating a new branch" }, 400)
              }
              if (body.branch.startsWith("-")) {
                return c.json({ error: "Invalid branch name" }, 400)
              }
              args.push("-b", body.branch)
            }
            // Terminate options before path to avoid option-like path segments being parsed
            args.push("--", resolvedPath)
            if (body.createBranch) {
              const baseRef = body.baseRef || "HEAD"
              if (baseRef.startsWith("-")) {
                return c.json({ error: "Invalid base ref" }, 400)
              }
              // Separate commit-ish with another -- for safety
              args.push("--", baseRef)
            } else if (body.branch) {
              if (body.branch.startsWith("-")) {
                return c.json({ error: "Invalid branch name" }, 400)
              }
              args.push("--", body.branch)
            }

            await execFileAsync("git", args, { cwd: project.path })

            const metadata = projectManager.ensureWorktreeMetadata(id, resolvedPath, body.title)
            if (!metadata) {
              throw new Error("Failed to persist worktree metadata")
            }
            metadata.title = body.title
            await projectManager.saveProjects()

            const worktrees = await buildWorktreeResponses(id)
            const created = worktrees.find((worktree) => worktree.id === metadata.id)
            if (!created) {
              throw new Error("Unable to locate created worktree")
            }
            return c.json(created, 201)
          } catch (error) {
            log.error("Failed to create worktree:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to create worktree" },
              400
            )
          }
        }
      )

      // PATCH /api/projects/:id/worktrees/:worktreeId - update metadata
      .patch(
        "/api/projects/:id/worktrees/:worktreeId",
        describeRoute({
          description: "Update worktree metadata",
          operationId: "projects.worktrees.update",
          responses: {
            200: {
              description: "Updated worktree",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      id: z.string(),
                      title: z.string(),
                      path: z.string(),
                      relativePath: z.string(),
                      branch: z.string().optional(),
                      head: z.string().optional(),
                      isPrimary: z.boolean(),
                      isDetached: z.boolean(),
                      isLocked: z.boolean(),
                      lockReason: z.string().optional(),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator("param", z.object({ id: z.string(), worktreeId: z.string() })),
        zValidator("json", z.object({ title: z.string().min(1) })),
        async (c) => {
          const { id, worktreeId } = c.req.valid("param")
          const { title } = c.req.valid("json")
          try {
            const updated = projectManager.updateWorktreeTitle(id, worktreeId, title)
            await projectManager.saveProjects()
            const worktrees = await buildWorktreeResponses(id)
            const response = worktrees.find((worktree) => worktree.id === updated.id)
            if (!response) {
              throw new Error("Updated worktree not found")
            }
            return c.json(response)
          } catch (error) {
            log.error("Failed to update worktree metadata:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to update worktree" },
              400
            )
          }
        }
      )

      // DELETE /api/projects/:id/worktrees/:worktreeId - remove worktree
      .delete(
        "/api/projects/:id/worktrees/:worktreeId",
        describeRoute({
          description: "Remove a git worktree",
          operationId: "projects.worktrees.delete",
          responses: {
            200: {
              description: "Removal result",
              content: {
                "application/json": {
                  schema: resolver(z.object({ success: z.boolean() })),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator("param", z.object({ id: z.string(), worktreeId: z.string() })),
        zValidator("query", z.object({ force: z.coerce.boolean().optional() })),
        async (c) => {
          const { id, worktreeId } = c.req.valid("param")
          const { force } = c.req.valid("query")
          const project = projectManager.getProject(id)
          if (!project) {
            return c.json({ error: "Project not found" }, 404)
          }

          try {
            const metadata = projectManager.findWorktreeById(id, worktreeId)
            if (!metadata) {
              return c.json({ error: "Worktree not found" }, 404)
            }
            if (metadata.id === "default") {
              return c.json({ error: "Cannot remove default worktree" }, 400)
            }

            const args = ["worktree", "remove"] as string[]
            if (force) {
              args.push("--force")
            }
            args.push(metadata.path)

            await execFileAsync("git", args, { cwd: project.path })
            projectManager.removeWorktreeMetadata(id, metadata.id)
            await projectManager.saveProjects()
            await buildWorktreeResponses(id)
            return c.json({ success: true })
          } catch (error) {
            log.error("Failed to remove worktree:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to remove worktree" },
              400
            )
          }
        }
      )

      // GET /api/projects/:id/resources - get minimal resource info (SDK handles actual resources)
      .get(
        "/api/projects/:id/resources",
        describeRoute({
          description: "Get minimal resource information",
          operationId: "projects.resources",
          responses: {
            200: {
              description: "Minimal resource information",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      memory: z.object({
                        used: z.number(),
                        total: z.number(),
                      }),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        zValidator(
          "query",
          z.object({
            worktree: z.string().optional(),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")
          const { worktree } = c.req.valid("query")
          // Use the imported projectManager directly
          const project = projectManager.getProject(id)

          if (!project) {
            return c.json({ error: "Project not found" }, 404)
          }

          if (worktree) {
            projectManager.ensureWorktreeMetadata(id, worktree)
          }

          // Return minimal resource data - SDK handles actual resource monitoring
          return c.json({
            memory: { used: 0, total: 0 },
          })
        }
      )

      // GET /api/projects/:id/activity - get activity feed
      .get(
        "/api/projects/:id/activity",
        describeRoute({
          description: "Get project activity feed",
          operationId: "projects.activity",
          responses: {
            200: {
              description: "Activity feed events",
              content: {
                "application/json": {
                  schema: resolver(
                    z.array(
                      z.object({
                        id: z.string(),
                        type: z.enum([
                          "session_created",
                          "file_changed",
                          "git_commit",
                          "agent_used",
                        ]),
                        message: z.string(),
                        timestamp: z.string(),
                      })
                    )
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        zValidator(
          "query",
          z.object({
            worktree: z.string().optional(),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")
          const { worktree } = c.req.valid("query")
          // Use the imported projectManager directly
          const project = projectManager.getProject(id)

          if (!project) {
            return c.json({ error: "Project not found" }, 404)
          }

          if (worktree) {
            projectManager.ensureWorktreeMetadata(id, worktree)
          }

          // Return basic activity data
          const activity = []

          // Check if project is running
          const isRunning = project.status === "running"

          if (isRunning) {
            activity.push({
              id: `project-start-${project.lastAccessed}`,
              type: "session_created" as const,
              message: `Project started`,
              timestamp: new Date(project.lastAccessed).toISOString(),
            })
          }

          return c.json(activity)
        }
      )

      // GET /api/projects/:id/agents - list agents
      .get(
        "/api/projects/:id/agents",
        describeRoute({
          description: "List agents for project",
          operationId: "projects.agents.list",
          responses: {
            200: {
              description: "List of agents",
              content: {
                "application/json": {
                  schema: resolver(
                    z.array(
                      z.object({
                        id: z.string(),
                        name: z.string(),
                        description: z.string().optional(),
                        temperature: z.number().optional(),
                        maxTokens: z.number().optional(),
                        systemPrompt: z.string().optional(),
                        tools: z.array(z.string()).default([]),
                        model: z.string().optional(),
                        enabled: z.boolean(),
                        isTemplate: z.boolean().optional(),
                        createdAt: z.number().optional(),
                      })
                    )
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        zValidator(
          "query",
          z.object({
            worktree: z.string().optional(),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")
          const { worktree } = c.req.valid("query")
          // Use the imported projectManager directly
          const project = projectManager.getProject(id)

          if (!project) {
            return c.json({ error: "Project not found" }, 404)
          }

          const metadata = worktree
            ? projectManager.ensureWorktreeMetadata(id, worktree)
            : projectManager.findWorktreeById(id, "default")
          const agents = getProjectAgents(id, metadata?.path)
          const list = Array.from(agents.values())
          return c.json(list)
        }
      )

      // POST /api/projects/:id/agents - create agent
      .post(
        "/api/projects/:id/agents",
        describeRoute({
          description: "Create an agent for project",
          operationId: "projects.agents.create",
          responses: {
            200: {
              description: "Created agent",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      id: z.string(),
                      name: z.string(),
                      description: z.string().optional(),
                      temperature: z.number().optional(),
                      maxTokens: z.number().optional(),
                      systemPrompt: z.string().optional(),
                      tools: z.array(z.string()).default([]),
                      model: z.string().optional(),
                      enabled: z.boolean(),
                      isTemplate: z.boolean().optional(),
                      createdAt: z.number().optional(),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        zValidator(
          "query",
          z.object({
            worktree: z.string().optional(),
          })
        ),
        zValidator(
          "json",
          z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            temperature: z.number().optional(),
            maxTokens: z.number().optional(),
            systemPrompt: z.string().optional(),
            tools: z.array(z.string()).default([]),
            model: z.string().optional(),
            enabled: z.boolean().default(true),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")
          const { worktree } = c.req.valid("query")
          const body = c.req.valid("json")
          // Use the imported projectManager directly
          const project = projectManager.getProject(id)
          if (!project) {
            return c.json({ error: "Project not found" }, 404)
          }

          const metadata = worktree
            ? projectManager.ensureWorktreeMetadata(id, worktree)
            : projectManager.findWorktreeById(id, "default")

          const agents = getProjectAgents(id, metadata?.path)
          const agentId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`)
          const record: AgentRecord = {
            id: agentId,
            name: body.name,
            description: body.description ?? "",
            temperature: body.temperature ?? 0.7,
            maxTokens: body.maxTokens ?? 1000,
            systemPrompt: body.systemPrompt ?? "",
            tools: body.tools ?? [],
            model: body.model ?? "default",
            enabled: body.enabled ?? true,
            isTemplate: false,
            createdAt: Date.now(),
          }
          agents.set(agentId, record)
          return c.json(record)
        }
      )

      // GET /api/projects/:id/agents/:agentId - get agent
      .get(
        "/api/projects/:id/agents/:agentId",
        describeRoute({
          description: "Get agent details",
          operationId: "projects.agents.get",
          responses: {
            200: {
              description: "Agent details",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      id: z.string(),
                      name: z.string(),
                      description: z.string().optional(),
                      temperature: z.number().optional(),
                      maxTokens: z.number().optional(),
                      systemPrompt: z.string().optional(),
                      tools: z.array(z.string()).default([]),
                      model: z.string().optional(),
                      enabled: z.boolean(),
                      isTemplate: z.boolean().optional(),
                      createdAt: z.number().optional(),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({ id: z.string(), agentId: z.string() })
        ),
        zValidator(
          "query",
          z.object({ worktree: z.string().optional() })
        ),
        async (c) => {
          const { id, agentId } = c.req.valid("param")
          const { worktree } = c.req.valid("query")
          // Use the imported projectManager directly
          const project = projectManager.getProject(id)
          if (!project) return c.json({ error: "Project not found" }, 404)
          const metadata = worktree
            ? projectManager.ensureWorktreeMetadata(id, worktree)
            : projectManager.findWorktreeById(id, "default")
          const agent = getProjectAgents(id, metadata?.path).get(agentId)
          if (!agent) return c.json({ error: "Agent not found" }, 404)
          return c.json(agent)
        }
      )

      // PUT /api/projects/:id/agents/:agentId - update agent
      .put(
        "/api/projects/:id/agents/:agentId",
        describeRoute({
          description: "Update an agent",
          operationId: "projects.agents.update",
          responses: {
            200: {
              description: "Updated agent",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      id: z.string(),
                      name: z.string(),
                      description: z.string().optional(),
                      temperature: z.number().optional(),
                      maxTokens: z.number().optional(),
                      systemPrompt: z.string().optional(),
                      tools: z.array(z.string()).default([]),
                      model: z.string().optional(),
                      enabled: z.boolean(),
                      isTemplate: z.boolean().optional(),
                      createdAt: z.number().optional(),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({ id: z.string(), agentId: z.string() })
        ),
        zValidator(
          "query",
          z.object({ worktree: z.string().optional() })
        ),
        zValidator(
          "json",
          z.object({
            name: z.string().optional(),
            description: z.string().optional(),
            temperature: z.number().optional(),
            maxTokens: z.number().optional(),
            systemPrompt: z.string().optional(),
            tools: z.array(z.string()).optional(),
            model: z.string().optional(),
            enabled: z.boolean().optional(),
          })
        ),
        async (c) => {
          const { id, agentId } = c.req.valid("param")
          const { worktree } = c.req.valid("query")
          const updates = c.req.valid("json")
          // Use the imported projectManager directly
          const project = projectManager.getProject(id)
          if (!project) return c.json({ error: "Project not found" }, 404)
          const metadata = worktree
            ? projectManager.ensureWorktreeMetadata(id, worktree)
            : projectManager.findWorktreeById(id, "default")
          const agents = getProjectAgents(id, metadata?.path)
          const existing = agents.get(agentId)
          if (!existing) return c.json({ error: "Agent not found" }, 404)

          const updated: AgentRecord = {
            ...existing,
            ...updates,
          }
          agents.set(agentId, updated)
          return c.json(updated)
        }
      )

      // DELETE /api/projects/:id/agents/:agentId - delete agent
      .delete(
        "/api/projects/:id/agents/:agentId",
        describeRoute({
          description: "Delete an agent",
          operationId: "projects.agents.delete",
          responses: {
            200: {
              description: "Deleted",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({ id: z.string(), agentId: z.string() })
        ),
        zValidator(
          "query",
          z.object({ worktree: z.string().optional() })
        ),
        async (c) => {
          const { id, agentId } = c.req.valid("param")
          const { worktree } = c.req.valid("query")
          // Use the imported projectManager directly
          const project = projectManager.getProject(id)
          if (!project) return c.json({ error: "Project not found" }, 404)
          const metadata = worktree
            ? projectManager.ensureWorktreeMetadata(id, worktree)
            : projectManager.findWorktreeById(id, "default")
          const agents = getProjectAgents(id, metadata?.path)
          const ok = agents.delete(agentId)
          if (!ok) return c.json({ error: "Agent not found" }, 404)
          return c.json(true)
        }
      )

      // POST /api/projects/:id/agents/:agentId/test - stubbed test endpoint
      .post(
        "/api/projects/:id/agents/:agentId/test",
        describeRoute({
          description: "Test an agent (stubbed)",
          operationId: "projects.agents.test",
          responses: {
            200: {
              description: "Test result",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      success: z.boolean(),
                      response: z.string().optional(),
                      error: z.string().optional(),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator("param", z.object({ id: z.string(), agentId: z.string() })),
        zValidator("query", z.object({ worktree: z.string().optional() })),
        zValidator("json", z.object({ prompt: z.string() })),
        async (c) => {
          const { id, agentId } = c.req.valid("param")
          const { worktree } = c.req.valid("query")
          const { prompt } = c.req.valid("json")
          // Use the imported projectManager directly
          const project = projectManager.getProject(id)
          if (!project) return c.json({ success: false, error: "Project not found" }, 404)
          const metadata = worktree
            ? projectManager.ensureWorktreeMetadata(id, worktree)
            : projectManager.findWorktreeById(id, "default")
          const agent = getProjectAgents(id, metadata?.path).get(agentId)
          if (!agent) return c.json({ success: false, error: "Agent not found" }, 404)

          // Minimal stubbed behavior
        return c.json({
          success: true,
          response: `Agent ${agent.name} received: ${prompt}`,
        })
      }
    )
      .post(
        "/api/projects/:id/github/issues/list",
        describeRoute({
          description: "List GitHub issues for a repository",
          operationId: "projects.github.issues.list",
          responses: {
            200: {
              description: "GitHub issues",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      items: z.array(z.unknown()),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        zValidator("json", GitHubIssuesListRequestSchema),
        async (c) => {
          const { id } = c.req.valid("param")
          const { repo, params } = c.req.valid("json")

          const resolved = resolveProjectRecord(id)
          if (!resolved) {
            return c.json({ error: "Project not found" }, 404)
          }

          const client = createServerGitHubClient()

          try {
            const items = await client.listIssues(repo, params ?? {})
            return c.json({ items })
          } catch (error) {
            const message = formatGitHubError(error)
            log.error("Failed to list GitHub issues", {
              projectId: id,
              repo,
              error,
            })
            return c.json({ error: message }, 502)
          }
        }
      )
      .post(
        "/api/projects/:id/github/pulls/list",
        describeRoute({
          description: "List GitHub pull requests for a repository",
          operationId: "projects.github.pulls.list",
          responses: {
            200: {
              description: "GitHub pull requests",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      items: z.array(z.unknown()),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        zValidator("json", GitHubPullsListRequestSchema),
        async (c) => {
          const { id } = c.req.valid("param")
          const { repo, params } = c.req.valid("json")

          const resolved = resolveProjectRecord(id)
          if (!resolved) {
            return c.json({ error: "Project not found" }, 404)
          }

          const client = createServerGitHubClient()

          try {
            const items = await client.listPullRequests(repo, params ?? {})
            return c.json({ items })
          } catch (error) {
            const message = formatGitHubError(error)
            log.error("Failed to list GitHub pull requests", {
              projectId: id,
              repo,
              error,
            })
            return c.json({ error: message }, 502)
          }
        }
      )
      .post(
        "/api/projects/:id/github/pulls/:number/status",
        describeRoute({
          description: "Get rollup status information for a GitHub pull request",
          operationId: "projects.github.pulls.status",
          responses: {
            200: {
              description: "Pull request status summary",
              content: {
                "application/json": {
                  schema: resolver(PullRequestStatusResponseSchema),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
            number: z.coerce.number().int().positive(),
          })
        ),
        zValidator("json", GitHubPullStatusRequestSchema),
        async (c) => {
          const { id, number } = c.req.valid("param")
          const { repo } = c.req.valid("json")

          const resolved = resolveProjectRecord(id)
          if (!resolved) {
            return c.json({ error: "Project not found" }, 404)
          }

          const client = createServerGitHubClient()

          try {
            const payload = await client.getPullRequestStatus(repo, number)
            return c.json(payload)
          } catch (error) {
            const message = formatGitHubError(error)
            log.error("Failed to load GitHub pull request status", {
              projectId: id,
              repo,
              number,
              error,
            })
            return c.json({ error: message }, 502)
          }
        }
      )
      .post(
        "/api/projects/:id/github/content",
        describeRoute({
          description: "Fetch GitHub issue and pull request content with caching",
          operationId: "projects.github.content",
          responses: {
            200: {
              description: "Cached GitHub content",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      items: z.array(z.unknown()),
                      errors: z.array(z.unknown()),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        zValidator("json", GitHubContentRequestSchema),
        async (c) => {
          const { id } = c.req.valid("param")
          const {
            repo,
            items = [],
            cacheTtlMs,
            includeIssues,
            includePulls,
            includeStatuses,
          } = c.req.valid("json")

          const resolved = resolveProjectRecord(id)
          if (!resolved) {
            return c.json({ error: "Project not found" }, 404)
          }

          try {
            const payload = await fetchGitHubContentBatch({
              repo,
              items,
              cacheTtlMs,
              includeIssues: includeIssues ?? null,
              includePulls: includePulls ?? null,
              includeStatuses,
            })
            return c.json(payload)
          } catch (error) {
            log.error("Failed to load GitHub content", {
              projectId: id,
              repo,
              error,
            })
            return c.json({ error: "Unable to load GitHub content" }, 502)
          }
        }
      )
      // GET /api/projects/:id/git/status - get git status
      .get(
        "/api/projects/:id/git/status",
        describeRoute({
          description: "Get git status for project",
          operationId: "projects.git.status",
          responses: {
            200: {
              description: "Git status information",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      branch: z.string(),
                      ahead: z.number(),
                      behind: z.number(),
                      changedFiles: z.number(),
                      stagedCount: z.number(),
                      unstagedCount: z.number(),
                      untrackedCount: z.number(),
                      staged: z.array(GitFileSchema),
                      modified: z.array(GitFileSchema),
                      untracked: z.array(GitFileSchema),
                      remoteUrl: z.string().optional(),
                      lastCommit: z
                        .object({
                          hash: z.string(),
                          author: z.string(),
                          date: z.string(),
                          message: z.string(),
                        })
                        .optional(),
                      recentCommits: z
                        .array(
                          z.object({
                            hash: z.string(),
                            author: z.string(),
                            date: z.string(),
                            message: z.string(),
                          })
                        )
                        .optional(),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        zValidator(
          "query",
          z.object({
            worktree: z.string().optional(),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")
          const { worktree } = c.req.valid("query")

          const resolved = resolveProjectRecord(id)
          if (!resolved) {
            return c.json({ error: "Project not found" }, 404)
          }

          const { project, canonicalId } = resolved

          let targetPath = project.path

          if (worktree && worktree !== "default") {
            const metadata = resolveWorktreeMetadata(canonicalId, worktree)
            if (metadata?.path) {
              targetPath = metadata.path
            } else {
              return c.json({ error: "Worktree not found" }, 404)
            }
          } else {
            const defaultTree = projectManager.findWorktreeById(id, "default")
            if (defaultTree?.path) {
              targetPath = defaultTree.path
            }
          }

          if (!targetPath) {
            return c.json(createEmptyGitStatus())
          }

          const repoPath = normalizePath(targetPath)
          // Enforce repoPath stays within the user's HOME to avoid arbitrary FS access
          if (!(repoPath === HOME_DIRECTORY || repoPath.startsWith(`${HOME_DIRECTORY}/`))) {
            log.warn("Rejected git status for path outside HOME", { repoPath })
            return c.json(createEmptyGitStatus())
          }

          try {
            await nodeFs.stat(repoPath)
          } catch (error) {
            log.warn("Git path not accessible", { repoPath, error })
            return c.json(createEmptyGitStatus())
          }

          const runGit = async (args: string[]) => {
            const { stdout } = await execFileAsync("git", args, { cwd: repoPath })
            return stdout.toString()
          }

          let statusOutput: string
          try {
            statusOutput = await runGit(["status", "--porcelain=v1", "-b"])
          } catch (error) {
            log.warn("Failed to execute git status", { repoPath, error })
            return c.json(createEmptyGitStatus())
          }

          const parsed = parseGitStatusOutput(statusOutput)

          let remoteUrl: string | undefined
          try {
            const remoteOutput = await runGit(["remote", "get-url", "origin"])
            const trimmed = remoteOutput.trim()
            if (trimmed) {
              remoteUrl = trimmed
            }
          } catch (remoteError) {
            log.debug("No git remote detected", { repoPath, remoteError })
          }

          let recentCommits: GitStatusPayload["recentCommits"] = []
          let lastCommit: GitStatusPayload["lastCommit"]
          try {
            const commitOutput = await runGit([
              "log",
              "-5",
              "--pretty=format:%H%x1f%an%x1f%ad%x1f%s",
              "--date=iso-strict",
            ])
            recentCommits = commitOutput
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
              .map((line) => {
                const [hash, author, date, message] = line.split("\x1f")
                return { hash, author, date, message }
              })
              .filter(
                (commit): commit is {
                  hash: string
                  author: string
                  date: string
                  message: string
                } =>
                  Boolean(commit.hash && commit.author && commit.date && commit.message !== undefined)
              )

            if (recentCommits.length > 0) {
              lastCommit = recentCommits[0]
            }
          } catch (commitError) {
            log.debug("Failed to read recent commits", { repoPath, commitError })
            recentCommits = []
          }

          const payload: GitStatusPayload = {
            branch: parsed.branch,
            ahead: parsed.ahead,
            behind: parsed.behind,
            changedFiles: parsed.changedFiles,
            stagedCount: parsed.staged.length,
            unstagedCount: parsed.modified.length,
            untrackedCount: parsed.untracked.length,
            staged: parsed.staged,
            modified: parsed.modified,
            untracked: parsed.untracked,
            remoteUrl,
            lastCommit,
            recentCommits,
          }

          return c.json(payload)
        }
      )

      // GET /api/projects/:id/sdk-info - get SDK connection information
      .get(
        "/api/projects/:id/sdk-info",
        describeRoute({
          description: "Get SDK connection information for project",
          operationId: "projects.sdkInfo",
          responses: {
            200: {
              description: "SDK connection information",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      baseUrl: z.string(),
                      projectPath: z.string(),
                      status: z.enum(["ready", "not_initialized"]),
                      message: z.string(),
                    })
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          })
        ),
        async (c) => {
          const { id } = c.req.valid("param")
          // Use the imported projectManager directly
          const project = projectManager.getProject(id)

          if (!project) {
            return c.json({ error: "Project not found" }, 404)
          }

          // Return SDK connection info for direct client access
          const sdkInstance = projectManager.getSDKInstance(id)
          const status = sdkInstance ? "ready" : "not_initialized"

          return c.json({
            // Always direct clients to the proxy path
            baseUrl: "/opencode",
            projectPath: project.path,
            status,
            message:
              status === "ready"
                ? "SDK is ready for use with this project"
                : "Project needs to be started first",
          })
        }
      )

    // Client connects directly to OpenCode backend using SDK
  )
}

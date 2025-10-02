/**
 * Integrated Project Routes
 *
 * This module provides project/worktree management and GitHub helper routes
 * for the Operator Hub application.
 */

import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { projectManager } from "./project-manager"
import { ProjectCreateSchema, ProjectUpdateSchema } from "./project-schemas"
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

const execFileAsync = promisify(execFile)

const normalizePath = (value: string) =>
  nodePath.resolve(value).replace(/\\/g, "/").replace(/\/+$/, "")

const humanizeSlug = (value: string | undefined): string => {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  return trimmed
    .split(/[\/-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

const HOME_DIRECTORY = normalizePath(process.env["HOME"] || nodeOs.homedir())
const TMP_DIRECTORY = normalizePath(nodeOs.tmpdir())
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

// (OpenAPI schemas removed during rewrite)

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

// (OpenAPI schemas removed during rewrite)

/**
 * Resolve a filesystem path to its realpath and ensure it remains within the
 * allowed sandbox: the user's HOME directory or the system tmp directory.
 * This prevents traversal outside expected roots and avoids symlink escapes.
 */
const realpathWithinAllowed = async (inputPath: string): Promise<string> => {
  const absolute = normalizePath(inputPath)
  const resolved = normalizePath(await nodeFs.realpath(absolute))

  const tmpReal = await (async () => {
    try {
      return normalizePath(await nodeFs.realpath(TMP_DIRECTORY))
    } catch {
      return TMP_DIRECTORY
    }
  })()

  const within =
    resolved === HOME_DIRECTORY ||
    resolved.startsWith(`${HOME_DIRECTORY}/`) ||
    resolved === TMP_DIRECTORY ||
    resolved.startsWith(`${TMP_DIRECTORY}/`) ||
    resolved === tmpReal ||
    resolved.startsWith(`${tmpReal}/`)

  if (!within) {
    const err = new Error("Path must be within the home or temp directory") as Error & {
      status?: number
    }
    err.status = 400
    throw err
  }
  return resolved
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

// (OpenAPI schemas removed during rewrite)

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
    const relative =
      normalizePath(item.path!) === normalizedProject
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
  const metadataCandidates = await Promise.all(
    metadataList.map(async (meta) => {
      const normalizedPath = normalizePath(meta.path)
      let realPath: string | null = null
      try {
        realPath = normalizePath(await nodeFs.realpath(meta.path))
      } catch {
        realPath = null
      }
      return { meta, normalizedPath, realPath }
    })
  )

  const findMetadataForEntry = async (entryPath: string) => {
    const normalizedEntry = normalizePath(entryPath)
    let candidate = metadataCandidates.find((item) => item.normalizedPath === normalizedEntry)
    if (candidate) return candidate.meta

    let entryReal: string | null = null
    try {
      entryReal = normalizePath(await nodeFs.realpath(entryPath))
    } catch {
      entryReal = null
    }

    if (entryReal) {
      candidate = metadataCandidates.find(
        (item) => item.normalizedPath === entryReal || item.realPath === entryReal
      )
      if (candidate) return candidate.meta
    }

    candidate = metadataCandidates.find((item) => item.realPath && item.realPath === normalizedEntry)
    if (candidate) return candidate.meta

    return undefined
  }

  const registerMetadata = async (metadata: typeof metadataList[number]) => {
    const existing = metadataCandidates.find((item) => item.meta === metadata)
    if (existing) {
      existing.normalizedPath = normalizePath(metadata.path)
      try {
        existing.realPath = normalizePath(await nodeFs.realpath(metadata.path))
      } catch {
        existing.realPath = null
      }
      return
    }
    let realPath: string | null = null
    try {
      realPath = normalizePath(await nodeFs.realpath(metadata.path))
    } catch {
      realPath = null
    }
    metadataCandidates.push({
      meta: metadata,
      normalizedPath: normalizePath(metadata.path),
      realPath,
    })
  }

  const responses: WorktreeResponse[] = []

  for (const entry of parsed) {
    let metadata = await findMetadataForEntry(entry.path)
    if (!metadata) {
      metadata = projectManager.ensureWorktreeMetadata(
        projectId,
        entry.path,
        entry.branch || entry.relativePath || entry.path
      )
      if (!metadata) {
        throw new Error(`Unable to resolve metadata for worktree ${entry.path}`)
      }
      await registerMetadata(metadata)
    }

    await registerMetadata(metadata)

    // If this is the primary worktree (the project root), prefer showing the git branch
    // as the title instead of a generic "(default)" suffix seeded at project creation.
    // Only override when the existing title looks like a default placeholder.
    if (entry.isPrimary) {
      const desired = entry.branch || "main"
      const looksDefault =
        !metadata.title ||
        /\(default\)\s*$/i.test(metadata.title) ||
        metadata.title.toLowerCase() === "default"
      if (looksDefault && metadata.title !== desired) {
        try {
          projectManager.updateWorktreeTitle(projectId, metadata.id, desired)
          metadata.title = desired
        } catch {
          // non-fatal; continue with existing title
        }
      }
    }

    // Fix isPrimary detection across platforms by comparing realpaths
    let effectiveIsPrimary = entry.isPrimary
    try {
      const realEntry = normalizePath(await nodeFs.realpath(entry.path))
      let realProject: string
      try {
        realProject = normalizePath(await nodeFs.realpath(project.path))
      } catch {
        realProject = normalizePath(project.path)
      }
      if (realEntry === realProject) {
        effectiveIsPrimary = true
      }
    } catch {
      // ignore
    }

    responses.push({
      id: metadata.id,
      title: metadata.title,
      path: metadata.path,
      relativePath: entry.relativePath,
      branch: entry.branch,
      head: entry.head,
      isPrimary: effectiveIsPrimary,
      isDetached: entry.isDetached,
      isLocked: entry.isLocked,
      lockReason: entry.lockReason,
    })
  }

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


/**
 * Adds integrated project management routes to a Hono app instance.
 *
 * This function extends the provided Hono app with project management
 * capabilities used by the Operator Hub UI (projects, worktrees, git, GitHub).
 *
 * @param app - The Hono app instance to extend with integrated project routes
 * @returns The extended Hono app with integrated project routes added
 */
export function addIntegratedProjectRoutes(app: Hono) {
  return (
    app

      // GET /api/projects - list all projects
      .get(
        "/api/system/home",
        async (c) => {
          return c.json({ path: HOME_DIRECTORY })
        }
      )

      .get(
        "/api/system/package-json",
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
            packageJsonPath = await realpathWithinAllowed(requestedPath)
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
            packageJsonPath = await realpathWithinAllowed(packageJsonPath)
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
            target = await realpathWithinAllowed(target)
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

            const parent =
              target === HOME_DIRECTORY ? null : normalizePath(nodePath.dirname(target))

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
        async (c) => {
          const projects = projectManager.getAllProjects()
          // Return bare array to match client expectations
          return c.json(projects)
        }
      )

      // POST /api/projects - add new project
      .post(
        "/api/projects",
        zValidator("json", ProjectCreateSchema),
        async (c) => {
          const { path, name } = c.req.valid("json")
          // Use the imported projectManager directly

          try {
            log.info("add-project:start", { path, name })
            const project = await projectManager.addProject(path, name)
            // Return bare project object
            log.info("add-project:ok", { id: project.id })
            return c.json(project)
          } catch (error) {
            log.error("Failed to add project:", error)
            log.warn("add-project:error", { error: String(error) })
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

          return c.json(project)
        }
      )

      // PATCH /api/projects/:id - update project
      .patch(
        "/api/projects/:id",
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
            return c.json({ success: true })
          } catch (error) {
            log.error("Failed to remove project:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to remove project" },
              400
            )
          }
        }
      )

      // GET /api/projects/:id/worktrees - list git worktrees
      .get(
        "/api/projects/:id/worktrees",
        zValidator("param", z.object({ id: z.string() })),
        async (c) => {
          const { id } = c.req.valid("param")
          try {
            const worktrees = await buildWorktreeResponses(id)
            // Return bare array to match client expectations
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
            const requestedTitleRaw = body.title ?? ""
            const requestedTitle = String(requestedTitleRaw).trim()
            const requestedLooksSluggy =
              !requestedTitle ||
              /[\/_-]/.test(requestedTitle) ||
              requestedTitle === requestedTitle.toLowerCase()
            const branchTitle = humanizeSlug(body.branch)
            const pathTitle = humanizeSlug(nodePath.basename(resolvedPath))
            const displayTitle =
              requestedLooksSluggy
                ? branchTitle || pathTitle || "Worktree"
                : requestedTitle
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
              const baseRef = (body.baseRef || "HEAD").trim()
              if (!baseRef) {
                return c.json({ error: "Base ref cannot be empty" }, 400)
              }
              if (baseRef.startsWith("-")) {
                return c.json({ error: "Invalid base ref" }, 400)
              }
              args.push(baseRef)
            } else if (body.branch) {
              const branchRef = body.branch.trim()
              if (!branchRef) {
                return c.json({ error: "Branch name cannot be empty" }, 400)
              }
              if (branchRef.startsWith("-")) {
                return c.json({ error: "Invalid branch name" }, 400)
              }
              args.push(branchRef)
            }

            await execFileAsync("git", args, { cwd: project.path })

            // Wait briefly for filesystem to settle
            await new Promise(resolve => setTimeout(resolve, 100))

            const metadata = projectManager.ensureWorktreeMetadata(id, resolvedPath, displayTitle)
            if (!metadata) {
              throw new Error("Failed to persist worktree metadata")
            }
            metadata.title = displayTitle
            await projectManager.saveProjects()

            const providedPath = body.path?.toString() ?? ""
            const relativeFromProject = !nodePath.isAbsolute(providedPath) && providedPath
              ? providedPath.replace(/\\/g, "/")
              : (() => {
                  const raw = nodePath.relative(project.path, metadata.path)
                  return raw ? raw.replace(/\\/g, "/") : ""
                })()

            let headSha: string | null = null
            try {
              const { stdout } = await execFileAsync(
                "git",
                ["rev-parse", "--verify", "HEAD"],
                { cwd: metadata.path }
              )
              headSha = stdout.trim()
            } catch {
              headSha = null
            }

            const responsePayload = {
              id: metadata.id,
              title: displayTitle,
              path: metadata.path,
              relativePath: relativeFromProject,
              branch: body.branch,
              head: headSha ?? undefined,
              isPrimary: relativeFromProject === "",
              isDetached: false,
              isLocked: false,
            }

            return c.json(responsePayload, 201)
          } catch (error) {
            log.error("Failed to create worktree:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to create worktree" },
              400
            )
          }
        }
      )

      // GET /api/projects/:id/git/branches - list local and remote branches and their checkout status
      .get(
        "/api/projects/:id/git/branches",
        zValidator("param", z.object({ id: z.string() })),
        async (c) => {
          const { id } = c.req.valid("param")
          const project = projectManager.getProject(id)
          if (!project) {
            return c.json({ error: "Project not found" }, 404)
          }

          try {
            // Best-effort refresh of remotes to keep branch list current
            try {
              await execFileAsync(
                "git",
                ["fetch", "--all", "--prune"],
                { cwd: project.path, timeout: 20000 }
              )
            } catch (fetchError) {
              // Do not fail the request if fetch fails; continue with existing refs
              log.debug("git fetch --all --prune failed (continuing)", {
                error: fetchError instanceof Error ? fetchError.message : String(fetchError),
              })
            }

            // List local branches
            const { stdout: localStdout } = await execFileAsync(
              "git",
              [
                "for-each-ref",
                "--format=%(refname:short)",
                "refs/heads",
              ],
              { cwd: project.path }
            )
            const localBranches = localStdout
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean)

            // List remote-tracking branches (exclude symbolic refs like origin/HEAD)
            const { stdout: remoteStdout } = await execFileAsync(
              "git",
              [
                "for-each-ref",
                "--format=%(refname:short)",
                "refs/remotes",
              ],
              { cwd: project.path }
            )
            const remoteBranches = remoteStdout
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter((name) => Boolean(name) && !/\/?HEAD$/.test(name))

            // Determine which local branches are checked out by any worktree
            const { stdout: wtStdout } = await execFileAsync(
              "git",
              ["worktree", "list", "--porcelain"],
              { cwd: project.path }
            )
            const checkedOutLocal = new Set<string>()
            for (const line of wtStdout.split(/\r?\n/)) {
              if (line.startsWith("branch ")) {
                const ref = line.substring("branch ".length).trim()
                // Expect format like "refs/heads/feature/foo"
                const short = ref.startsWith("refs/heads/") ? ref.substring("refs/heads/".length) : ref
                if (short) checkedOutLocal.add(short)
              }
            }

            // Build combined result: locals first, then remotes
            const result = [
              ...localBranches.map((name) => ({ name, checkedOut: checkedOutLocal.has(name) })),
              ...remoteBranches.map((name) => {
                // Mark remote as in-use if its local counterpart is checked out (e.g., origin/foo → foo)
                const localEquivalent = name.includes("/") ? name.split("/").slice(1).join("/") : name
                return {
                  name,
                  checkedOut: checkedOutLocal.has(localEquivalent),
                }
              }),
            ]

            return c.json(result)
          } catch (error) {
            log.error("Failed to list branches:", error)
            return c.json(
              { error: error instanceof Error ? error.message : "Failed to list branches" },
              400
            )
          }
        }
      )

      // PATCH /api/projects/:id/worktrees/:worktreeId - update metadata
      .patch(
        "/api/projects/:id/worktrees/:worktreeId",
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

      // (Removed legacy resource/activity stubs during rewrite)

      .post(
        "/api/projects/:id/github/issues/list",
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

          // Enforce repoPath stays within HOME or TMP to avoid arbitrary FS access
          try {
            await realpathWithinAllowed(repoPath)
          } catch (error) {
            log.warn("Rejected git status for disallowed path", { repoPath, error })
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
                (
                  commit
                ): commit is {
                  hash: string
                  author: string
                  date: string
                  message: string
                } =>
                  Boolean(
                    commit.hash && commit.author && commit.date && commit.message !== undefined
                  )
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

      
    // Client connects directly to OpenCode backend using SDK
  )
}

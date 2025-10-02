import { Log } from "../util/log"
// removed expensive git helpers from hot path
import * as fs from "fs/promises"
import fsSync from "node:fs"
import * as crypto from "crypto"
import * as path from "node:path"

export interface WorktreeMetadata {
  id: string
  path: string
  title: string
}

export interface ProjectInfo {
  id: string
  name: string
  path: string
  status: "stopped" | "running"
  lastAccessed: number
  gitRoot?: string
  commitHash?: string
  // port removed - client connects directly to OpenCode backend
  port?: number
  worktrees?: WorktreeMetadata[]
}

export interface ProjectInstance {
  info: ProjectInfo
  sdk?: unknown
}

const isNodeError = (error: unknown): error is NodeJS.ErrnoException => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  )
}

export class ProjectManager {
  private static instance: ProjectManager | null = null
  private projects = new Map<string, ProjectInstance>()
  private loaded = false
  private dirty = false
  private configDir = (() => {
    const override = process.env["AGENT_ORANGE_CONFIG_DIR"]
    if (override && override.trim()) return override.trim()
    const testMode = process.env["AGENT_ORANGE_TEST_MODE"]
    if (
      process.env["NODE_ENV"] === "test" ||
      (typeof testMode === "string" && /^(1|true)$/i.test(testMode))
    ) {
      return `${process.env["HOME"]}/.agent-orange-test`
    }
    return `${process.env["HOME"]}/.agent-orange`
  })()
  private configFile = `${this.configDir}/web-projects.json`
  private log = Log.create({ service: "project-manager" })

  private normalizePath(value: string): string {
    return path.resolve(value).replace(/\\/g, "/").replace(/\/+$/, "")
  }

  private canonicalizePath(value: string): string {
    const normalized = this.normalizePath(value)
    try {
      const real =
        typeof fsSync.realpathSync.native === "function"
          ? fsSync.realpathSync.native(normalized)
          : fsSync.realpathSync(normalized)
      return this.normalizePath(real)
    } catch {
      return normalized
    }
  }

  private slugify(value: string): string {
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64) || "worktree"
    )
  }

  private ensureDefaultWorktree(info: ProjectInfo): void {
    const normalizedProjectPath = this.canonicalizePath(info.path)
    info.path = normalizedProjectPath
    if (!info.worktrees) {
      info.worktrees = []
    }

    const existingDefault = info.worktrees.find((worktree) => worktree.id === "default")
    if (existingDefault) {
      existingDefault.path = normalizedProjectPath
      if (!existingDefault.title) {
        existingDefault.title = `${info.name} (default)`
      }
    } else {
      info.worktrees.push({
        id: "default",
        path: normalizedProjectPath,
        title: `${info.name} (default)`,
      })
    }

    info.worktrees = info.worktrees.map((worktree) => ({
      ...worktree,
      path: this.canonicalizePath(worktree.path || normalizedProjectPath),
      title: worktree.title || worktree.id,
    }))
  }

  private markDirty(): void {
    this.dirty = true
  }

  private generateWorktreeId(info: ProjectInfo, title: string): string {
    const base = this.slugify(title)
    const reserved = new Set((info.worktrees || []).map((worktree) => worktree.id))
    if (!reserved.has(base) && base !== "default") {
      return base
    }
    let counter = 2
    let candidate = `${base}-${counter}`
    while (reserved.has(candidate) || candidate === "default") {
      counter += 1
      candidate = `${base}-${counter}`
    }
    return candidate
  }

  private constructor() {
    // Initialize config directory and load projects asynchronously
    this.ensureConfigDirSync().catch(console.error)
    // Fire-and-forget; a fast shutdown before this completes should not
    // overwrite existing project data thanks to the loaded/dirty guards.
    this.loadProjects()
  }

  static getInstance(): ProjectManager {
    if (!ProjectManager.instance) {
      ProjectManager.instance = new ProjectManager()
    }
    return ProjectManager.instance
  }

  // For testing only - reset the singleton
  static resetInstance(): void {
    if (ProjectManager.instance) {
      // Clear all SDK instances
      for (const instance of ProjectManager.instance.projects.values()) {
        instance.sdk = undefined
      }
      ProjectManager.instance.projects.clear()
    }
    ProjectManager.instance = null
  }

  private async ensureConfigDirSync(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true })
    } catch {
      // Directory might already exist or other error, ignore
    }
  }

  async loadProjects(): Promise<void> {
    try {
      try {
        const text = await fs.readFile(this.configFile, "utf-8")
        const data = JSON.parse(text)

        for (const projectInfo of data.projects || []) {
          // Validate that the project path still exists
          try {
            const stat = await (await import("fs/promises")).stat(projectInfo.path)
            if (!stat.isDirectory()) {
              this.log.warn(`Skipping project (not a directory): ${projectInfo.path}`)
              continue
            }
          } catch {
            this.log.warn(`Skipping missing project path: ${projectInfo.path}`)
            continue
          }

          const instance: ProjectInstance = {
            info: {
              ...projectInfo,
              status: "running" as const, // SDK mode - projects are always ready
            },
          }
          this.ensureDefaultWorktree(instance.info)
          this.projects.set(projectInfo.id, instance)
        }

        this.log.info(`Loaded ${this.projects.size} projects`)
      } catch (error: unknown) {
        if (isNodeError(error) && error.code === "ENOENT") {
          this.log.info("No existing projects file found")
        } else {
          throw error
        }
      }
    } catch (error) {
      this.log.error("Failed to load projects:", error)
    } finally {
      // Mark as loaded so shutdown won't clobber existing data if nothing changed
      this.loaded = true
      // Seed a default project if none are available to improve first-run UX/tests
      if (this.projects.size === 0) {
        try {
          const cwd = process.cwd()
          const name = cwd.split("/").pop() || "Project"
          await this.addProject(cwd, name)
          this.log.info(`Seeded default project: ${name} (${cwd})`)
        } catch (e) {
          this.log.warn("Failed to seed default project:", e)
        }
      }
    }
  }

  async saveProjects(): Promise<void> {
    // Avoid overwriting existing data if we haven't loaded it yet
    if (!this.loaded) return
    // Skip writing when there were no in-memory changes
    if (!this.dirty) return

    const projects = Array.from(this.projects.values()).map((instance) => ({
      ...instance.info,
      status: "stopped", // Always save as stopped
    }))

    const data = { projects }
    await fs.writeFile(this.configFile, JSON.stringify(data, null, 2), "utf-8")
    // Persisted successfully; mark as clean
    this.dirty = false
  }

  async getGitProjectId(projectPath: string): Promise<string> {
    // Stable ID derived from normalized absolute path (no external processes)
    const resolvedPath = projectPath.startsWith("/")
      ? projectPath
      : `${process.cwd()}/${projectPath}`
    const hash = crypto.createHash("sha256")
    hash.update(resolvedPath)
    return hash.digest("hex").substring(0, 16)
  }

  // Git helpers removed from hot path; re-introduce if needed.

  async addProject(projectPath: string, name?: string): Promise<ProjectInfo> {
    if (!path.isAbsolute(projectPath)) {
      throw new Error(`Project path must be absolute: received "${projectPath}"`)
    }

    const normalizedPath = this.normalizePath(projectPath)

    try {
      const stat = await fs.stat(normalizedPath)
      if (!stat.isDirectory()) {
        throw new Error(`Project path is not a directory: ${normalizedPath}`)
      }
    } catch (error) {
      const message =
        error instanceof Error && "code" in error && (error as { code?: string }).code === "ENOENT"
          ? `Project path does not exist: ${normalizedPath}`
          : error instanceof Error
            ? error.message
            : "Unable to verify project path"
      throw new Error(message)
    }

    let canonicalPath = normalizedPath
    try {
      canonicalPath = this.normalizePath(await fs.realpath(normalizedPath))
    } catch {
      // Keep normalizedPath when realpath cannot resolve (e.g., permission issues)
    }

    const projectId = await this.getGitProjectId(canonicalPath)

    // Check if project already exists
    if (this.projects.has(projectId)) {
      const existing = this.projects.get(projectId)!
      const incomingName = name?.trim()

      let updated = false
      if (existing.info.path !== canonicalPath) {
        existing.info.path = canonicalPath
        updated = true
      }
      if (incomingName && existing.info.name !== incomingName) {
        existing.info.name = incomingName
        updated = true
      }

      if (updated) {
        this.ensureDefaultWorktree(existing.info)
        this.markDirty()
      }

      existing.info.lastAccessed = Date.now()
      await this.saveProjects()
      return existing.info
    }

    const fallbackName = canonicalPath.split("/").pop() || "Unknown Project"
    const projectInfo: ProjectInfo = {
      id: projectId,
      name: name || fallbackName,
      path: canonicalPath,
      status: "running", // SDK mode - projects are always ready
      lastAccessed: Date.now(),
      gitRoot: undefined,
      commitHash: undefined,
      worktrees: [
        {
          id: "default",
          path: canonicalPath,
          title: `${name || fallbackName} (default)`.trim(),
        },
      ],
    }

    this.ensureDefaultWorktree(projectInfo)

    const instance: ProjectInstance = { info: projectInfo }
    this.projects.set(projectId, instance)
    this.markDirty()
    await this.saveProjects()

    this.log.info(`Added project: ${projectInfo.name} (${projectId})`)
    return projectInfo
  }

  async removeProject(projectId: string): Promise<boolean> {
    const instance = this.projects.get(projectId)
    if (!instance) {
      return false
    }

    this.projects.delete(projectId)
    this.markDirty()
    await this.saveProjects()
    this.log.info(`Removed project: ${instance.info.name} (${projectId})`)
    return true
  }

  getProjectPath(projectId: string): string | undefined {
    const instance = this.projects.get(projectId)
    return instance?.info.path
  }

  getProject(projectId: string): ProjectInfo | undefined {
    return this.projects.get(projectId)?.info
  }

  getAllProjects(): ProjectInfo[] {
    return Array.from(this.projects.values())
      .map((instance) => instance.info)
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
  }

  getWorktrees(projectId: string): WorktreeMetadata[] {
    const instance = this.projects.get(projectId)
    if (!instance) return []
    this.ensureDefaultWorktree(instance.info)
    return [...(instance.info.worktrees || [])]
  }

  findWorktreeById(projectId: string, worktreeId: string): WorktreeMetadata | undefined {
    const instance = this.projects.get(projectId)
    if (!instance) return undefined
    this.ensureDefaultWorktree(instance.info)
    return instance.info.worktrees?.find((worktree) => worktree.id === worktreeId)
  }

  ensureWorktreeMetadata(
    projectId: string,
    worktreePath: string,
    title?: string
  ): WorktreeMetadata | undefined {
    const instance = this.projects.get(projectId)
    if (!instance) return undefined
    this.ensureDefaultWorktree(instance.info)

    const normalizedPath = this.canonicalizePath(worktreePath)
    const existing = instance.info.worktrees?.find(
      (worktree) => this.canonicalizePath(worktree.path) === normalizedPath
    )
    if (existing) {
      if (existing.path !== normalizedPath) {
        existing.path = normalizedPath
        this.markDirty()
      }
      if (title && existing.title !== title) {
        const normalizedIncoming = title.trim()
        const current = existing.title?.trim() ?? ""
        const incomingSlug = this.slugify(normalizedIncoming)
        const currentSlug = current ? this.slugify(current) : ""
        const incomingLooksSluggy =
          !normalizedIncoming ||
          normalizedIncoming === incomingSlug ||
          /[\/_]/.test(normalizedIncoming)
        const currentLooksSluggy =
          !current ||
          current === existing.id ||
          current === existing.path ||
          current === path.basename(existing.path) ||
          current === currentSlug ||
          /[\/_]/.test(current)
        const shouldOverwrite = !current || (currentLooksSluggy && !incomingLooksSluggy)
        if (shouldOverwrite) {
          existing.title = normalizedIncoming
          this.markDirty()
        }
      }
      return existing
    }

    const worktreeTitle = title || path.basename(normalizedPath) || "worktree"
    const id = this.generateWorktreeId(instance.info, worktreeTitle)
    const metadata: WorktreeMetadata = {
      id,
      path: normalizedPath,
      title: worktreeTitle,
    }
    instance.info.worktrees = [...(instance.info.worktrees || []), metadata]
    this.markDirty()
    return metadata
  }

  updateWorktreeTitle(projectId: string, worktreeId: string, title: string): WorktreeMetadata {
    const instance = this.projects.get(projectId)
    if (!instance) {
      throw new Error(`Project ${projectId} not found`)
    }
    this.ensureDefaultWorktree(instance.info)
    const metadata = instance.info.worktrees?.find((worktree) => worktree.id === worktreeId)
    if (!metadata) {
      throw new Error(`Worktree ${worktreeId} not found for project ${projectId}`)
    }
    metadata.title = title
    this.markDirty()
    return metadata
  }

  removeWorktreeMetadata(projectId: string, worktreeId: string): void {
    const instance = this.projects.get(projectId)
    if (!instance) {
      throw new Error(`Project ${projectId} not found`)
    }
    this.ensureDefaultWorktree(instance.info)
    if (worktreeId === "default") {
      throw new Error("Cannot remove default worktree")
    }
    const before = instance.info.worktrees?.length ?? 0
    instance.info.worktrees = (instance.info.worktrees || []).filter(
      (worktree) => worktree.id !== worktreeId
    )
    if ((instance.info.worktrees?.length ?? 0) !== before) {
      this.markDirty()
    }
  }

  async shutdown(): Promise<void> {
    this.log.info("Shutting down project manager")

    // Save final state
    await this.saveProjects()
  }
}

// Export singleton instance
export const projectManager = ProjectManager.getInstance()

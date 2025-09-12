import { Log } from "../util/log"
import { OpencodeClient, createOpencodeClient } from "@opencode-ai/sdk/client"
import { execSync, exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs/promises"
import * as crypto from "crypto"

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
}

export interface ProjectInstance {
  info: ProjectInfo
  sdk?: OpencodeClient
}

export class ProjectManager {
  private static instance: ProjectManager
  private projects = new Map<string, ProjectInstance>()
  private loaded = false
  private dirty = false
  private configDir = 
    process.env["NODE_ENV"] === "test"
      ? "/tmp/.opencode-test"
      : `${process.env["HOME"]}/.opencode`
  private configFile = `${this.configDir}/web-projects.json`
  private log = Log.create({ service: "project-manager" })

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
    ProjectManager.instance = null as any
  }

  private async ensureConfigDirSync(): Promise<void> {
    try {
      execSync(`mkdir -p ${this.configDir}`)
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
          this.projects.set(projectInfo.id, instance)
        }

        this.log.info(`Loaded ${this.projects.size} projects`)
      } catch (error: any) {
        if (error.code === "ENOENT") {
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
    // Resolve path - if relative, make it absolute from cwd
    const resolvedPath = projectPath.startsWith("/")
      ? projectPath
      : `${process.cwd()}/${projectPath}`

    // Try to find git root and get initial commit hash
    const gitRoot = await this.findGitRoot(resolvedPath)
    if (gitRoot) {
      const commitHash = await this.getInitialCommitHash(gitRoot)
      if (commitHash) {
        return commitHash
      }
    }

    // Fallback to path hash
    const hash = crypto.createHash("sha256")
    hash.update(resolvedPath)
    return hash.digest("hex").substring(0, 16)
  }

  private async findGitRoot(startPath: string): Promise<string | null> {
    try {
      const execAsync = promisify(exec)
      const result = await execAsync(`cd ${startPath} && git rev-parse --show-toplevel`)
      return result.stdout.trim()
    } catch {
      return null
    }
  }

  private async getInitialCommitHash(gitRoot: string): Promise<string | null> {
    try {
      const execAsync = promisify(exec)
      const result = await execAsync(`cd ${gitRoot} && git rev-list --max-parents=0 HEAD`)
      const hash = result.stdout.trim().split("\n")[0]
      return hash ? hash.substring(0, 16) : null
    } catch {
      return null
    }
  }

  async addProject(projectPath: string, name?: string): Promise<ProjectInfo> {
    const resolvedPath = projectPath.startsWith("/")
      ? projectPath
      : `${process.cwd()}/${projectPath}`
    const projectId = await this.getGitProjectId(resolvedPath)

    // Check if project already exists
    if (this.projects.has(projectId)) {
      const existing = this.projects.get(projectId)!
      existing.info.lastAccessed = Date.now()
      await this.saveProjects()
      return existing.info
    }

    const gitRoot = await this.findGitRoot(resolvedPath)
    const commitHash = gitRoot ? await this.getInitialCommitHash(gitRoot) : undefined

    const projectInfo: ProjectInfo = {
      id: projectId,
      name: name || resolvedPath.split("/").pop() || "Unknown Project",
      path: resolvedPath,
      status: "running", // SDK mode - projects are always ready
      lastAccessed: Date.now(),
      gitRoot: gitRoot || undefined,
      commitHash: commitHash || undefined,
    }

    const instance: ProjectInstance = { info: projectInfo }
    this.projects.set(projectId, instance)
    this.dirty = true
    await this.saveProjects()

    this.log.info(`Added project: ${projectInfo.name} (${projectId})`)
    return projectInfo
  }

  async removeProject(projectId: string): Promise<boolean> {
    const instance = this.projects.get(projectId)
    if (!instance) {
      return false
    }

    // Stop the instance if running
    if (instance.info.status !== "stopped") {
      await this.stopInstance(projectId)
    }

    this.projects.delete(projectId)
    this.dirty = true
    await this.saveProjects()
    this.log.info(`Removed project: ${instance.info.name} (${projectId})`)
    return true
  }

  async spawnInstance(projectId: string): Promise<boolean> {
    const instance = this.projects.get(projectId)
    if (!instance) {
      throw new Error(`Project ${projectId} not found`)
    }

    if (instance.info.status === "running") {
      return true
    }

    // Create SDK instance for metadata purposes only
    // Actual SDK operations are handled by the client
    instance.sdk = createOpencodeClient({
      baseUrl:
        process.env.OPENCODE_API_URL ||
        (() => {
          throw new Error("OPENCODE_API_URL not set - OpenCode backend not started")
        })(),
    })

    instance.info.status = "running"
    instance.info.lastAccessed = Date.now()

    this.log.info(
      `Project marked as running with SDK: ${instance.info.name} at ${instance.info.path}`
    )

    this.dirty = true
    await this.saveProjects()
    return true
  }

  async stopInstance(projectId: string): Promise<boolean> {
    const instance = this.projects.get(projectId)
    if (!instance) {
      return false
    }

    this.log.info(`Stopping SDK instance for project: ${instance.info.name}`)

    // Clear SDK instance
    instance.sdk = undefined
    instance.info.status = "stopped"

    this.dirty = true
    await this.saveProjects()
    return true
  }

  getSDKInstance(projectId: string): OpencodeClient | undefined {
    const instance = this.projects.get(projectId)
    if (!instance) {
      return undefined
    }

    // SDK instance is for metadata only - client handles actual connections
    if (!instance.sdk && instance.info.status === "running") {
      instance.sdk = createOpencodeClient({
        baseUrl:
          process.env.OPENCODE_API_URL ||
          (() => {
            throw new Error("OPENCODE_API_URL not set - OpenCode backend not started")
          })(),
      })
    }

    return instance.sdk
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

  async monitorHealth(): Promise<void> {
    // Health monitoring simplified - just track project metadata
    // Client handles actual SDK connections
    const instances = Array.from(this.projects.values())
    for (const instance of instances) {
      if (instance.info.status === "running" && !instance.sdk) {
        // SDK instance for metadata only
        instance.sdk = createOpencodeClient({
          baseUrl:
            process.env.OPENCODE_API_URL ||
            (() => {
              throw new Error("OPENCODE_API_URL not set - OpenCode backend not started")
            })(),
        })
      }
    }
  }

  async shutdown(): Promise<void> {
    this.log.info("Shutting down project manager")

    // Stop all running instances
    const stopPromises = Array.from(this.projects.keys()).map((id) => this.stopInstance(id))
    await Promise.all(stopPromises)

    // Save final state
    await this.saveProjects()
  }
}

// Export singleton instance
export const projectManager = ProjectManager.getInstance()

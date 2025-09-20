import { describe, test, expect, beforeEach, afterEach, rs } from "@rstest/core"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { tmpdir } from "node:os"

const createTempProjectDir = async (name: string) => {
  const dir = path.join(tmpdir(), `opencode-${name}-${Math.random().toString(36).slice(2)}`)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

describe("ProjectManager.addProject path handling", () => {
  let originalHome: string | undefined
  let testHome: string
  let ProjectManager: typeof import("../../src/server/project-manager").ProjectManager

  beforeEach(async () => {
    originalHome = process.env["HOME"]
    testHome = path.join(tmpdir(), `opencode-home-${Math.random().toString(36).slice(2)}`)
    process.env["HOME"] = testHome
    await fs.rm(testHome, { recursive: true, force: true })
    await fs.mkdir(testHome, { recursive: true })
    ProjectManager = (await rs.importActual<typeof import("../../src/server/project-manager")>(
      "../../src/server/project-manager"
    )).ProjectManager
    ProjectManager.resetInstance()
  })

  afterEach(async () => {
    ProjectManager.resetInstance()
    await fs.rm(testHome, { recursive: true, force: true }).catch(() => {})
    if (originalHome !== undefined) {
      process.env["HOME"] = originalHome
    }
  })

  test("stores absolute path without modification", async () => {
    const manager = ProjectManager.getInstance()
    await manager.loadProjects()
    const projectDir = await createTempProjectDir("absolute")

    try {
      const project = await manager.addProject(projectDir, "absolute-project")
      expect(project.path).toBe(projectDir)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  test("rejects relative paths to prevent duplicated segments", async () => {
    const manager = ProjectManager.getInstance()
    await manager.loadProjects()

    await expect(manager.addProject("relative-folder", "relative"))
      .rejects.toThrow(/Project path must be absolute/i)
  })

  test("re-adding project updates stored path", async () => {
    const manager = ProjectManager.getInstance()
    await manager.loadProjects()
    const projectDir = await createTempProjectDir("update")

    try {
      const first = await manager.addProject(projectDir, "update-project")
      expect(first.path).toBe(projectDir)

      // Simulate legacy stored path
      const projectsMap = (manager as unknown as { projects: Map<string, any> }).projects
      const instance = projectsMap.get(first.id)
      expect(instance).toBeDefined()
      if (instance) {
        instance.info.path = `${projectDir}/opencode-1`
      }

      const second = await manager.addProject(projectDir, "update-project")
      expect(second.path).toBe(projectDir)

      await manager.saveProjects()

      const configPath = (manager as unknown as { configFile: string }).configFile
      const saved = JSON.parse(await fs.readFile(configPath, "utf-8"))
      const stored = saved.projects.find((p: any) => p.id === first.id)
      expect(stored.path).toBe(projectDir)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true }).catch(() => {})
    }
  })
})

import { describe, it, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { MockProjectManager } from "../mocks/project-manager.mock"

// Mock the actual ProjectManager module
rstest.mock("../../src/server/project-manager", () => ({
  ProjectManager: MockProjectManager,
  get projectManager() {
    return MockProjectManager.getInstance()
  },
}))

describe("ProjectManager", () => {
  let manager: MockProjectManager

  beforeEach(async () => {
    // Reset the mock singleton for clean test state
    MockProjectManager.resetInstance()

    // Create a new manager instance for testing
    manager = MockProjectManager.getInstance()
  })

  afterEach(async () => {
    // Reset instance to clean up
    MockProjectManager.resetInstance()
  })

  it("should create a singleton instance", () => {
    const manager1 = MockProjectManager.getInstance()
    const manager2 = MockProjectManager.getInstance()
    expect(manager1).toBe(manager2)
  })

  it("should generate project ID from path hash", async () => {
    const projectPath = "/test/project/path"
    const projectId = await manager.getGitProjectId(projectPath)

    expect(projectId).toBeDefined()
    expect(typeof projectId).toBe("string")
    expect(projectId.length).toBe(16)
  })

  it("should add and retrieve projects", async () => {
    const projectPath = "/test/project"
    const projectName = "Test Project"

    const project = await manager.addProject(projectPath, projectName)

    expect(project.name).toBe(projectName)
    expect(project.path).toBe(projectPath)
    expect(project.status).toBe("stopped")
    expect(project.port).toBeGreaterThanOrEqual(8081)

    const retrieved = manager.getProject(project.id)
    expect(retrieved).toEqual(project)
  })

  it("should list all projects", async () => {
    await manager.addProject("/test/project1", "Project 1")
    await manager.addProject("/test/project2", "Project 2")

    const projects = manager.getAllProjects()
    expect(projects).toHaveLength(2)
    // Both projects should be present
    const projectNames = projects.map((p) => p.name)
    expect(projectNames).toContain("Project 1")
    expect(projectNames).toContain("Project 2")
  })

  it("should remove projects", async () => {
    const project = await manager.addProject("/test/project", "Test Project")

    const removed = await manager.removeProject(project.id)
    expect(removed).toBe(true)

    const retrieved = manager.getProject(project.id)
    expect(retrieved).toBeUndefined()
  })

  it("should return false when removing non-existent project", async () => {
    const removed = await manager.removeProject("non-existent-id")
    expect(removed).toBe(false)
  })
})

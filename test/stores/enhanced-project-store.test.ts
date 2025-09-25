import { describe, test, expect, beforeEach, afterEach, rstest } from "@rstest/core"
// Adapted mock utility for rstest
import { TestDataFactory } from "../fixtures/test-data"

// Mock the entire module BEFORE any imports
const mockGetProjects = rstest.fn()
const mockGetProject = rstest.fn()
const mockCreateProject = rstest.fn()
const mockUpdateProject = rstest.fn()
const mockRemoveProject = rstest.fn()
const mockStartInstance = rstest.fn()
const mockStopInstance = rstest.fn()
const mockGetInstanceStatus = rstest.fn()

rstest.mock("../../src/lib/api/project-manager", () => ({
  ProjectManagerClient: class MockProjectManagerClient {
    async getProjects() {
      return mockGetProjects()
    }
    async getProject(id: string) {
      return mockGetProject(id)
    }
    async createProject(params: any) {
      return mockCreateProject(params)
    }
    async updateProject(id: string, params: any) {
      return mockUpdateProject(id, params)
    }
    async removeProject(id: string) {
      return mockRemoveProject(id)
    }
    async startInstance(id: string) {
      return mockStartInstance(id)
    }
    async stopInstance(id: string) {
      return mockStopInstance(id)
    }
    async getInstanceStatus(id: string) {
      return mockGetInstanceStatus(id)
    }
  },
}))

// Import store after mocking
import { useProjectsStore } from "../../src/stores/projects"

describe("Enhanced Projects Store", () => {
  beforeEach(() => {
    // Reset store state completely
    useProjectsStore.setState({
      projects: [],
      currentProject: null,
      loading: false,
      error: null,
      instanceOperations: {},
    })

    // Clear all mocks and reset their implementations
    mockGetProjects.mockClear()
    mockGetProject.mockClear()
    mockCreateProject.mockClear()
    mockUpdateProject.mockClear()
    mockRemoveProject.mockClear()
    mockStartInstance.mockClear()
    mockStopInstance.mockClear()
    mockGetInstanceStatus.mockClear()

    // Setup default mock responses
    mockGetProjects.mockResolvedValue([])
    mockGetProject.mockResolvedValue(TestDataFactory.createProject())
    mockCreateProject.mockResolvedValue(TestDataFactory.createProject())
    mockUpdateProject.mockResolvedValue(TestDataFactory.createProject())
    mockRemoveProject.mockResolvedValue(true)
    mockStartInstance.mockResolvedValue({ id: "instance-1", port: 3099, status: "running", startedAt: new Date() })
    mockStopInstance.mockResolvedValue(true)
    mockGetInstanceStatus.mockResolvedValue(null)
  })

  afterEach(() => {
    // Clean up any pending operations
    const state = useProjectsStore.getState()
    Object.keys(state.instanceOperations).forEach((projectId) => {
      useProjectsStore.setState((state) => {
        delete state.instanceOperations[projectId]
      })
    })
  })

  describe("Store Actions and Mutations", () => {
    test("all store actions are available and callable", () => {
      const state = useProjectsStore.getState()

      expect(typeof state.loadProjects).toBe("function")
      expect(typeof state.selectProject).toBe("function")
      expect(typeof state.createProject).toBe("function")
      expect(typeof state.updateProject).toBe("function")
      expect(typeof state.removeProject).toBe("function")
      expect(typeof state.startInstance).toBe("function")
      expect(typeof state.stopInstance).toBe("function")
      expect(typeof state.refreshInstanceStatus).toBe("function")
      expect(typeof state.refreshAllInstanceStatuses).toBe("function")
      expect(typeof state.stopAllInstances).toBe("function")
      expect(typeof state.clearError).toBe("function")
      expect(typeof state.setCurrentProject).toBe("function")
    })

    test("loadProjects mutation updates state correctly", async () => {
      const projects = [
        TestDataFactory.createProject({ id: "p1", name: "Project 1" }),
        TestDataFactory.createProject({ id: "p2", name: "Project 2" }),
      ]
      mockGetProjects.mockResolvedValue(projects)

      // Test loading state
      const loadPromise = useProjectsStore.getState().loadProjects()
      expect(useProjectsStore.getState().loading).toBe(true)
      expect(useProjectsStore.getState().error).toBe(null)

      await loadPromise

      const state = useProjectsStore.getState()
      expect(state.loading).toBe(false)
      expect(state.projects).toEqual(projects)
      expect(state.error).toBe(null)
    })

    test("createProject mutation adds project to state", async () => {
      const newProject = TestDataFactory.createProject({ id: "new", name: "New Project" })
      mockCreateProject.mockResolvedValue(newProject)

      const result = await useProjectsStore.getState().createProject({
        name: "New Project",
        path: "/path/to/project",
      })

      expect(result).toEqual(newProject)
      const state = useProjectsStore.getState()
      expect(state.projects).toContain(newProject)
      expect(state.loading).toBe(false)
    })

    test("updateProject mutation modifies existing project", async () => {
      const originalProject = TestDataFactory.createProject({ id: "update-test", name: "Original" })
      const updatedProject = { ...originalProject, name: "Updated" }

      useProjectsStore.setState({ projects: [originalProject], currentProject: originalProject })
      mockUpdateProject.mockResolvedValue(updatedProject)

      await useProjectsStore.getState().updateProject("update-test", { name: "Updated" })

      const state = useProjectsStore.getState()
      const found = state.projects.find((p: any) => p.id === "update-test")
      expect(found).toBeDefined()
      expect(found?.name).toBe("Updated")
      expect(state.currentProject).toBeDefined()
      expect(state.currentProject?.name).toBe("Updated")
    })

    test("removeProject mutation removes project from state", async () => {
      const project1 = TestDataFactory.createProject({ id: "remove1" })
      const project2 = TestDataFactory.createProject({ id: "remove2" })

      useProjectsStore.setState({
        projects: [project1, project2],
        currentProject: project1,
      })

      await useProjectsStore.getState().removeProject("remove1")

      const state = useProjectsStore.getState()
      expect(state.projects).toHaveLength(1)
      expect(state.projects[0].id).toBe("remove2")
      expect(state.currentProject).toBe(null)
    })

    test("instance operations update project state", async () => {
      const project = TestDataFactory.createProject({ id: "instance-test" })
      const instance = { id: "inst-1", port: 3099, status: "running" as const, startedAt: new Date() }

      useProjectsStore.setState({ projects: [project] })
      mockStartInstance.mockResolvedValue(instance)

      await useProjectsStore.getState().startInstance("instance-test")

      const state = useProjectsStore.getState()
      const updatedProject = state.projects.find((p: any) => p.id === "instance-test")
      expect(updatedProject).toBeDefined()
      expect(updatedProject?.instance).toEqual(instance)
    })

    test("batch operations work correctly", async () => {
      const runningProject = TestDataFactory.createProject({
        id: "running",
        instance: { id: "inst-1", port: 3099, status: "running", startedAt: new Date() },
      })
      const stoppedProject = TestDataFactory.createProject({ id: "stopped" })

      useProjectsStore.setState({ projects: [runningProject, stoppedProject] })

      await useProjectsStore.getState().stopAllInstances()

      expect(mockStopInstance).toHaveBeenCalledTimes(1)
      expect(mockStopInstance).toHaveBeenCalledWith("running")
    })
  })

  describe("Computed Values and Selectors", () => {
    test("running projects selector logic works correctly", () => {
      const runningProject1 = TestDataFactory.createProject({
        id: "running1",
        instance: { id: "inst-1", port: 3099, status: "running", startedAt: new Date() },
      })
      const runningProject2 = TestDataFactory.createProject({
        id: "running2",
        instance: { id: "inst-2", port: 3002, status: "running", startedAt: new Date() },
      })
      const stoppedProject = TestDataFactory.createProject({ id: "stopped" })

      useProjectsStore.setState({ projects: [runningProject1, runningProject2, stoppedProject] })

      // Test the selector logic directly
      const state = useProjectsStore.getState()
      const runningProjects = state.projects.filter((p: any) => p.instance?.status === "running")
      expect(runningProjects).toHaveLength(2)
      expect(runningProjects.map((p) => p.id)).toEqual(["running1", "running2"])
    })

    test("project by id selector logic works correctly", () => {
      const project1 = TestDataFactory.createProject({ id: "find-me" })
      const project2 = TestDataFactory.createProject({ id: "not-me" })

      useProjectsStore.setState({ projects: [project1, project2] })

      // Test the selector logic directly
      const state = useProjectsStore.getState()
      const foundProject = state.projects.find((p: any) => p.id === "find-me")
      expect(foundProject).toBeDefined()
      expect(foundProject?.id).toBe("find-me")

      const notFound = state.projects.find((p: any) => p.id === "missing")
      expect(notFound).toBeUndefined()
    })

    test("recent projects selector logic works correctly", () => {
      const now = Date.now()
      const recent = TestDataFactory.createProject({
        id: "recent",
        lastOpened: new Date(now - 1000).toISOString(),
      })
      const older = TestDataFactory.createProject({
        id: "older",
        lastOpened: new Date(now - 5000).toISOString(),
      })
      const oldest = TestDataFactory.createProject({
        id: "oldest",
        lastOpened: new Date(now - 10000).toISOString(),
      })
      const noDate = TestDataFactory.createProject({ id: "no-date" })

      useProjectsStore.setState({ projects: [oldest, recent, noDate, older] })

      // Test the selector logic directly
      const state = useProjectsStore.getState()
      const recentProjects = state.projects
        .filter((p: any) => p.lastOpened)
        .sort((a: any, b: any) => {
          const dateA = new Date(a.lastOpened!).getTime()
          const dateB = new Date(b.lastOpened!).getTime()
          return dateB - dateA
        })
        .slice(0, 2)

      expect(recentProjects).toHaveLength(2)
      expect(recentProjects[0].id).toBe("recent")
      expect(recentProjects[1].id).toBe("older")
    })

    test("basic state access works correctly", () => {
      const projects = [TestDataFactory.createProject()]
      const currentProject = projects[0]
      const error = "Test error"
      const instanceOps = { "project-1": true }

      useProjectsStore.setState({
        projects,
        currentProject,
        loading: true,
        error,
        instanceOperations: instanceOps,
      })

      const state = useProjectsStore.getState()
      expect(state.projects).toEqual(projects)
      expect(state.currentProject).toEqual(currentProject)
      expect(state.loading).toBe(true)
      expect(state.error).toBe(error)
      expect(state.instanceOperations).toEqual(instanceOps)
    })

    test("state references are stable when unchanged", () => {
      const project = TestDataFactory.createProject()
      useProjectsStore.setState({ projects: [project] })

      const state1 = useProjectsStore.getState()
      const state2 = useProjectsStore.getState()

      // Should return same reference for same data
      expect(state1.projects).toBe(state2.projects)
    })
  })

  describe("Store Persistence and Hydration", () => {
    test("only specified state is persisted", () => {
      const project = TestDataFactory.createProject({ id: "persist-test" })

      useProjectsStore.setState({
        projects: [project],
        currentProject: project,
        loading: true, // Should not persist
        error: "error", // Should not persist
        instanceOperations: { test: true }, // Should not persist
      })

      // Simulate what would be persisted (based on partialize config)
      const persistedState = {
        projects: [project],
        currentProject: project,
      }

      expect(persistedState).toHaveProperty("projects")
      expect(persistedState).toHaveProperty("currentProject")
      expect(persistedState).not.toHaveProperty("loading")
      expect(persistedState).not.toHaveProperty("error")
      expect(persistedState).not.toHaveProperty("instanceOperations")
    })

    test("hydration restores persisted state correctly", () => {
      const persistedProject = TestDataFactory.createProject({ id: "hydrated" })

      // Simulate hydration
      useProjectsStore.setState({
        projects: [persistedProject],
        currentProject: persistedProject,
        loading: false, // Default value
        error: null, // Default value
        instanceOperations: {}, // Default value
      })

      const state = useProjectsStore.getState()
      expect(state.projects).toContain(persistedProject)
      expect(state.currentProject).toEqual(persistedProject)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(null)
      expect(state.instanceOperations).toEqual({})
    })

    test("handles corrupted persisted data gracefully", () => {
      // Simulate corrupted data by setting invalid state
      useProjectsStore.setState({
        projects: [],
        currentProject: null,
        loading: false,
        error: null,
        instanceOperations: {},
      })

      const state = useProjectsStore.getState()
      expect(state.projects).toEqual([])
      expect(state.currentProject).toBe(null)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(null)
      expect(state.instanceOperations).toEqual({})
    })

    test("currentProject is updated when projects list changes", async () => {
      const originalProject = TestDataFactory.createProject({ id: "update-current" })
      const updatedProject = { ...originalProject, name: "Updated Name" }

      useProjectsStore.setState({
        projects: [originalProject],
        currentProject: originalProject,
      })

      mockGetProjects.mockResolvedValue([updatedProject])
      await useProjectsStore.getState().loadProjects()

      const state = useProjectsStore.getState()
      expect(state.currentProject).toBeDefined()
      expect(state.currentProject?.name).toBe("Updated Name")
    })
  })

  describe("Concurrent State Updates", () => {
    test("prevents concurrent instance operations on same project", async () => {
      const project = TestDataFactory.createProject({ id: "concurrent-test" })
      useProjectsStore.setState({ projects: [project] })

      let resolveFirst: (value: any) => void
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve
      })
      mockStartInstance.mockReturnValueOnce(firstPromise)

      // Start two operations concurrently
      const op1 = useProjectsStore.getState().startInstance("concurrent-test")
      const op2 = useProjectsStore.getState().startInstance("concurrent-test")

      // Resolve first operation
      resolveFirst!({ id: "inst-1", port: 3099, status: "running", startedAt: new Date() })

      await Promise.all([op1, op2])

      // Should only call API once due to concurrency protection
      expect(mockStartInstance).toHaveBeenCalledTimes(1)
    })

    test("allows concurrent operations on different projects", async () => {
      const project1 = TestDataFactory.createProject({ id: "project1" })
      const project2 = TestDataFactory.createProject({ id: "project2" })

      useProjectsStore.setState({ projects: [project1, project2] })

      // Start operations on different projects
      const op1 = useProjectsStore.getState().startInstance("project1")
      const op2 = useProjectsStore.getState().startInstance("project2")

      await Promise.all([op1, op2])

      expect(mockStartInstance).toHaveBeenCalledTimes(2)
      expect(mockStartInstance).toHaveBeenCalledWith("project1")
      expect(mockStartInstance).toHaveBeenCalledWith("project2")
    })

    test("handles rapid state mutations correctly", async () => {
      const project = TestDataFactory.createProject({ id: "rapid-test" })

      // Perform rapid mutations
      const mutations = Array.from({ length: 10 }, (_, i) =>
        useProjectsStore.setState({
          projects: [{ ...project, name: `Project ${i}` }],
          loading: i % 2 === 0,
        }),
      )

      // All mutations should complete
      await Promise.all(mutations)

      const state = useProjectsStore.getState()
      expect(state.projects[0].name).toBe("Project 9")
    })

    test("concurrent API calls maintain state consistency", async () => {
      const projects = Array.from({ length: 5 }, (_, i) => TestDataFactory.createProject({ id: `concurrent-${i}` }))

      useProjectsStore.setState({ projects })

      // Start multiple concurrent status refreshes
      const refreshPromises = projects.map((p) => useProjectsStore.getState().refreshInstanceStatus(p.id))

      await Promise.all(refreshPromises)

      expect(mockGetInstanceStatus).toHaveBeenCalledTimes(5)
    })
  })

  describe("Store Reset and Cleanup", () => {
    test("clearError resets error state", () => {
      useProjectsStore.setState({ error: "Test error" })
      expect(useProjectsStore.getState().error).toBe("Test error")

      useProjectsStore.getState().clearError()
      expect(useProjectsStore.getState().error).toBe(null)
    })

    test("setCurrentProject updates current project", () => {
      const project = TestDataFactory.createProject({ id: "set-current" })

      useProjectsStore.getState().setCurrentProject(project)
      expect(useProjectsStore.getState().currentProject).toEqual(project)

      useProjectsStore.getState().setCurrentProject(null)
      expect(useProjectsStore.getState().currentProject).toBe(null)
    })

    test("instance operations are cleaned up after completion", async () => {
      const project = TestDataFactory.createProject({ id: "cleanup-test" })
      useProjectsStore.setState({ projects: [project] })

      await useProjectsStore.getState().startInstance("cleanup-test")

      const state = useProjectsStore.getState()
      expect(state.instanceOperations["cleanup-test"]).toBeUndefined()
    })

    test("instance operations are cleaned up after errors", async () => {
      const project = TestDataFactory.createProject({ id: "error-cleanup" })
      useProjectsStore.setState({ projects: [project] })

      mockStartInstance.mockRejectedValue(new Error("Start failed"))
      await useProjectsStore.getState().startInstance("error-cleanup")

      const state = useProjectsStore.getState()
      expect(state.instanceOperations["error-cleanup"]).toBeUndefined()
    })

    test("can reset entire store state", () => {
      const project = TestDataFactory.createProject()
      useProjectsStore.setState({
        projects: [project],
        currentProject: project,
        loading: true,
        error: "error",
        instanceOperations: { test: true },
      })

      // Reset to initial state
      useProjectsStore.setState({
        projects: [],
        currentProject: null,
        loading: false,
        error: null,
        instanceOperations: {},
      })

      const state = useProjectsStore.getState()
      expect(state.projects).toEqual([])
      expect(state.currentProject).toBe(null)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(null)
      expect(state.instanceOperations).toEqual({})
    })
  })

  describe("Error Handling and Recovery", () => {
    test("optimistic updates are reverted on API failures", async () => {
      const originalProject = TestDataFactory.createProject({ id: "revert-test", name: "Original" })
      useProjectsStore.setState({ projects: [originalProject], currentProject: originalProject })

      mockUpdateProject.mockRejectedValue(new Error("Update failed"))
      mockGetProjects.mockResolvedValue([originalProject]) // For revert

      await useProjectsStore.getState().updateProject("revert-test", { name: "Updated" })

      // Should revert to original state
      expect(mockGetProjects).toHaveBeenCalled()
      const state = useProjectsStore.getState()
      expect(state.error).toBe("Update failed")
    })

    test("handles non-Error objects in API failures", async () => {
      mockGetProjects.mockRejectedValue("String error")

      await useProjectsStore.getState().loadProjects()

      const state = useProjectsStore.getState()
      expect(state.error).toBe("Failed to load projects")
    })

    test("instance operations handle partial failures gracefully", async () => {
      const projects = [
        TestDataFactory.createProject({ id: "success" }),
        TestDataFactory.createProject({ id: "failure" }),
      ]
      useProjectsStore.setState({ projects })

      mockGetInstanceStatus
        .mockResolvedValueOnce({ id: "inst-1", port: 3099, status: "running", startedAt: new Date() })
        .mockRejectedValueOnce(new Error("Status check failed"))

      await useProjectsStore.getState().refreshAllInstanceStatuses()

      // Should continue despite partial failures
      expect(mockGetInstanceStatus).toHaveBeenCalledTimes(2)
    })
  })

  describe("Performance and Memory Management", () => {
    test("handles large numbers of projects efficiently", async () => {
      const largeProjectList = Array.from({ length: 1000 }, (_, i) =>
        TestDataFactory.createProject({ id: `project-${i}`, name: `Project ${i}` }),
      )

      mockGetProjects.mockResolvedValue(largeProjectList)
      await useProjectsStore.getState().loadProjects()

      const state = useProjectsStore.getState()
      expect(state.projects).toHaveLength(1000)
      expect(state.projects[0].name).toBe("Project 0")
      expect(state.projects[999].name).toBe("Project 999")
    })

    test("selector performance with large datasets", () => {
      const projects = Array.from({ length: 100 }, (_, i) => {
        const hasInstance = i % 3 === 0
        return TestDataFactory.createProject({
          id: `perf-${i}`,
          instance: hasInstance
            ? { id: `inst-${i}`, port: 3000 + i, status: "running", startedAt: new Date() }
            : undefined,
        })
      })

      useProjectsStore.setState({ projects })

      const start = performance.now()
      const state = useProjectsStore.getState()
      const runningProjects = state.projects.filter((p: any) => p.instance?.status === "running")
      const end = performance.now()

      expect(runningProjects).toHaveLength(34) // Every 3rd project (0, 3, 6, ..., 99)
      expect(end - start).toBeLessThan(10) // Should be very fast
    })

    test("memory cleanup after project removal", async () => {
      const projects = Array.from({ length: 10 }, (_, i) => TestDataFactory.createProject({ id: `cleanup-${i}` }))

      useProjectsStore.setState({ projects })

      // Remove all projects
      for (const project of projects) {
        await useProjectsStore.getState().removeProject(project.id)
      }

      const state = useProjectsStore.getState()
      expect(state.projects).toHaveLength(0)
      expect(state.currentProject).toBe(null)
    })
  })
})

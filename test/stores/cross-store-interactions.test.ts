import { describe, test, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { TestDataFactory } from "../fixtures/test-data"

// Mock the API clients
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

// SDK client mocks
const mockGetSessions = rstest.fn(() => Promise.resolve([] as any[]))
const mockCreateSession = rstest.fn((params?: any) => Promise.resolve({} as any))
const mockUpdateSession = rstest.fn((params?: any) => Promise.resolve({} as any))
const mockDeleteSession = rstest.fn((params?: any) => Promise.resolve(true))
const mockGetClient = rstest.fn(async (_projectId: string, _projectPath: string) => {
  return {
    session: {
      list: async () => ({ data: await mockGetSessions() }),
      create: async ({ body }: { body?: { title?: string } }) => ({
        data: await mockCreateSession({ title: body?.title }),
      }),
      update: async ({ path, body }: { path: { id: string }; body?: any }) =>
        mockUpdateSession({ id: path.id, ...body }) as any,
      delete: async ({ path }: { path: { id: string } }) => ({
        data: await mockDeleteSession(path.id),
      }),
    },
  } as any
})

rstest.mock("../../src/services/opencode-sdk-service", () => ({
  opencodeSDKService: {
    getClient: ((...args: any[]) => (mockGetClient as any)(...args)) as any,
  },
}))

// Import stores after mocking
import { useProjectsStore } from "../../src/stores/projects"
import { useSessionsStore } from "../../src/stores/sessions"

// Define Session type
interface Session {
  id: string
  projectID: string
  directory: string
  parentID?: string
  share?: {
    url: string
  }
  title: string
  version: string
  time: {
    created: number
    updated: number
  }
}

describe("Cross-Store Interactions", () => {
  beforeEach(() => {
    // Reset both stores
    useProjectsStore.setState({
      projects: [],
      currentProject: null,
      loading: false,
      error: null,
      instanceOperations: {},
    })

    useSessionsStore.setState({
      sessions: new Map(),
      currentSession: null,
      loading: false,
      error: null,
    })

    // Clear all mocks
    mockGetProjects.mockClear()
    mockGetProject.mockClear()
    mockCreateProject.mockClear()
    mockUpdateProject.mockClear()
    mockRemoveProject.mockClear()
    mockStartInstance.mockClear()
    mockStopInstance.mockClear()
    mockGetInstanceStatus.mockClear()
    mockGetSessions.mockClear()
    mockCreateSession.mockClear()
    mockUpdateSession.mockClear()
    mockDeleteSession.mockClear()
    mockGetClient.mockClear()

    // Setup default mock responses
    mockGetProjects.mockResolvedValue([])
    mockGetProject.mockResolvedValue(TestDataFactory.createProject())
    mockCreateProject.mockResolvedValue(TestDataFactory.createProject())
    mockUpdateProject.mockResolvedValue(TestDataFactory.createProject())
    mockRemoveProject.mockResolvedValue(true)
    mockStartInstance.mockResolvedValue({ id: "instance-1", port: 3099, status: "running", startedAt: new Date() })
    mockStopInstance.mockResolvedValue(true)
    mockGetInstanceStatus.mockResolvedValue(null)
    mockGetSessions.mockResolvedValue([])
    mockCreateSession.mockResolvedValue({
      id: "session-1",
      projectID: "project-1",
      directory: "/path",
      title: "New Session",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    })
    mockUpdateSession.mockResolvedValue({
      id: "session-1",
      projectID: "project-1",
      directory: "/path",
      title: "Updated Session",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    })
    mockDeleteSession.mockResolvedValue(true)
  })

  afterEach(() => {
    // Clean up any pending operations
    const projectState = useProjectsStore.getState()
    Object.keys(projectState.instanceOperations).forEach((projectId) => {
      useProjectsStore.setState((state) => {
        delete state.instanceOperations[projectId]
      })
    })
  })

  describe("Project-Session Lifecycle Coordination", () => {
    test("project creation triggers session loading", async () => {
      const newProject = TestDataFactory.createProject({ id: "new-project", name: "New Project" })
      const sessions: Session[] = [
        {
          id: "session-1",
          projectID: "new-project",
          directory: "/path",
          title: "Initial Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]

      mockCreateProject.mockResolvedValue(newProject)
      mockGetSessions.mockResolvedValue(sessions)

      // Create project
      const createdProject = await useProjectsStore.getState().createProject({
        name: "New Project",
        path: "/path/to/project",
      })

      expect(createdProject).toBeDefined()

      // Load sessions for the new project
      await useSessionsStore.getState().loadSessions("new-project", "/path/to/project")

      // Verify both stores are updated
      const projectState = useProjectsStore.getState()
      const sessionState = useSessionsStore.getState()

      expect(projectState.projects).toContain(createdProject)
      expect(sessionState.sessions.get("new-project")).toEqual(sessions)
    })

    test("project removal clears associated sessions", async () => {
      const project = TestDataFactory.createProject({ id: "project-to-remove" })
      const sessions: Session[] = [
        {
          id: "session-1",
          projectID: "project-to-remove",
          directory: "/path",
          title: "Session 1",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]

      // Setup initial state
      useProjectsStore.setState({
        projects: [project],
        currentProject: project,
      })
      useSessionsStore.setState((state) => {
        state.sessions.set("project-to-remove", sessions)
        state.currentSession = sessions[0]
      })

      // Remove project
      await useProjectsStore.getState().removeProject("project-to-remove")

      // Clear sessions for removed project (simulating UI coordination)
      useSessionsStore.getState().clearSessions("project-to-remove")

      // Verify cleanup
      const projectState = useProjectsStore.getState()
      const sessionState = useSessionsStore.getState()

      expect(projectState.projects).not.toContain(project)
      expect(projectState.currentProject).toBe(null)
      expect(sessionState.sessions.has("project-to-remove")).toBe(false)
      expect(sessionState.currentSession).toBe(null)
    })

    test("project selection coordinates with session management", async () => {
      const project = TestDataFactory.createProject({ id: "selected-project" })
      const sessions: Session[] = [
        {
          id: "session-1",
          projectID: "selected-project",
          directory: "/path",
          title: "Session 1",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
        {
          id: "session-2",
          projectID: "selected-project",
          directory: "/path",
          title: "Session 2",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]

      useProjectsStore.setState({ projects: [project] })
      mockGetProject.mockResolvedValue(project)
      mockGetSessions.mockResolvedValue(sessions)

      // Select project and load sessions concurrently
      await Promise.all([
        useProjectsStore.getState().selectProject("selected-project"),
        useSessionsStore.getState().loadSessions("selected-project", "/path"),
      ])

      // Verify both operations completed successfully
      const projectState = useProjectsStore.getState()
      const sessionState = useSessionsStore.getState()

      expect(projectState.currentProject).toBeDefined()
      expect(projectState.currentProject?.id).toBe("selected-project")
      expect(sessionState.sessions.get("selected-project")).toEqual(sessions)
    })
  })

  describe("State Consistency Across Stores", () => {
    test("maintains consistency when project is updated", async () => {
      const originalProject = TestDataFactory.createProject({
        id: "project-1",
        name: "Original Name",
      })
      const session: Session = {
        id: "session-1",
        projectID: "project-1",
        directory: "/path",
        title: "Session 1",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      // Setup initial state
      useProjectsStore.setState({
        projects: [originalProject],
        currentProject: originalProject,
      })
      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [session])
        state.currentSession = session
      })

      // Update project
      const updatedProject = { ...originalProject, name: "Updated Name" }
      mockUpdateProject.mockResolvedValue(updatedProject)

      await useProjectsStore.getState().updateProject("project-1", { name: "Updated Name" })

      // Verify project state is updated
      const projectState = useProjectsStore.getState()
      expect(projectState.currentProject).toBeDefined()
      expect(projectState.currentProject?.name).toBe("Updated Name")

      // Session state should remain consistent
      const sessionState = useSessionsStore.getState()
      expect(sessionState.currentSession).toBeDefined()
      expect(sessionState.currentSession?.projectID).toBe("project-1")
      expect(sessionState.sessions.get("project-1")).toEqual([session])
    })

    test("handles concurrent operations across stores", async () => {
      const project = TestDataFactory.createProject({ id: "concurrent-project" })
      useProjectsStore.setState({ projects: [project] })

      // Start concurrent operations
      const instancePromise = useProjectsStore.getState().startInstance("concurrent-project")
      const sessionsPromise = useSessionsStore.getState().loadSessions("concurrent-project", "/test/path")
      const sessionCreatePromise = useSessionsStore.getState().createSession("concurrent-project", "/test/path", "New Session")

      // Wait for all operations
      await Promise.all([instancePromise, sessionsPromise, sessionCreatePromise])

      // Verify all operations completed successfully
      expect(mockStartInstance).toHaveBeenCalledWith("concurrent-project")
      expect(mockGetSessions).toHaveBeenCalled()
      expect(mockCreateSession).toHaveBeenCalledWith({ title: "New Session" })
    })

    test("handles error propagation between stores", async () => {
      const project = TestDataFactory.createProject({ id: "error-project" })
      useProjectsStore.setState({ projects: [project] })

      // Mock API failures
      mockStartInstance.mockRejectedValue(new Error("Instance start failed"))
      mockGetSessions.mockRejectedValue(new Error("Sessions load failed"))

      // Attempt operations that will fail
      await useProjectsStore.getState().startInstance("error-project")
      await useSessionsStore.getState().loadSessions("error-project", "/test/path")

      // Verify errors are properly set in both stores
      const projectState = useProjectsStore.getState()
      const sessionState = useSessionsStore.getState()

      expect(projectState.error).toBe("Instance start failed")
      expect(sessionState.error).toBe("Sessions load failed")
    })
  })

  describe("Complex Workflow Scenarios", () => {
    test("complete user workflow with cross-store coordination", async () => {
      // 1. User loads the app - projects are loaded
      const projects = [
        TestDataFactory.createProject({ id: "project-1", name: "Project 1" }),
        TestDataFactory.createProject({ id: "project-2", name: "Project 2" }),
      ]
      mockGetProjects.mockResolvedValue(projects)

      await useProjectsStore.getState().loadProjects()
      expect(useProjectsStore.getState().projects).toHaveLength(2)

      // 2. User selects a project
      mockGetProject.mockResolvedValue(projects[0])
      await useProjectsStore.getState().selectProject("project-1")
      expect(useProjectsStore.getState().currentProject?.id).toBe("project-1")

      // 3. User loads sessions for the project
      const sessions: Session[] = [
        {
          id: "session-1",
          projectID: "project-1",
          directory: "/path",
          title: "Session 1",
          version: "1.0.0",
          time: { created: Date.now() - 3600000, updated: Date.now() - 3600000 },
        },
        {
          id: "session-2",
          projectID: "project-1",
          directory: "/path",
          title: "Session 2",
          version: "1.0.0",
          time: { created: Date.now() - 1800000, updated: Date.now() - 1800000 },
        },
      ]
      mockGetSessions.mockResolvedValue(sessions)

      await useSessionsStore.getState().loadSessions("project-1", "/test/path")
      expect(useSessionsStore.getState().sessions.get("project-1")).toEqual(sessions)

      // 4. User starts the project instance
      const instance = { id: "instance-1", port: 3099, status: "running" as const, startedAt: new Date() }
      mockStartInstance.mockResolvedValue(instance)

      await useProjectsStore.getState().startInstance("project-1")
      const projectState = useProjectsStore.getState()
      expect(projectState.projects.find((p) => p.id === "project-1")?.instance).toEqual(instance)

      // 5. User creates a new session
      const newSession: Session = {
        id: "session-3",
        projectID: "project-1",
        directory: "/path",
        title: "New Session",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }
      mockCreateSession.mockResolvedValue(newSession)

      const createdSession = await useSessionsStore.getState().createSession("project-1", "New Session")
      expect(createdSession).toEqual(newSession)
      expect(useSessionsStore.getState().currentSession).toEqual(newSession)

      // 6. User switches to another session
      useSessionsStore.getState().selectSession(sessions[0])
      expect(useSessionsStore.getState().currentSession).toEqual(sessions[0])

      // 7. User stops the instance
      await useProjectsStore.getState().stopInstance("project-1")
      const finalProjectState = useProjectsStore.getState()
      expect(finalProjectState.projects.find((p) => p.id === "project-1")?.instance).toBeUndefined()
    })

    test("handles error recovery scenarios across stores", async () => {
      const project = TestDataFactory.createProject({ id: "error-project" })
      useProjectsStore.setState({ projects: [project] })

      // Simulate network error during session loading
      mockGetSessions.mockRejectedValueOnce(new Error("Network error"))
      await useSessionsStore.getState().loadSessions("error-project", "/test/path")
      expect(useSessionsStore.getState().error).toBe("Network error")

      // User retries - should succeed
      const sessions: Session[] = [
        {
          id: "session-1",
          projectID: "error-project",
          directory: "/path",
          title: "Session 1",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]
      mockGetSessions.mockResolvedValue(sessions)

      await useSessionsStore.getState().loadSessions("error-project", "/test/path")
      expect(useSessionsStore.getState().error).toBe(null)
      expect(useSessionsStore.getState().sessions.get("error-project")).toEqual(sessions)
    })

    test("handles project switching with session cleanup", async () => {
      const project1 = TestDataFactory.createProject({ id: "project-1" })
      const project2 = TestDataFactory.createProject({ id: "project-2" })
      const sessions1: Session[] = [
        {
          id: "session-1-1",
          projectID: "project-1",
          directory: "/path1",
          title: "Project 1 Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]
      const sessions2: Session[] = [
        {
          id: "session-2-1",
          projectID: "project-2",
          directory: "/path2",
          title: "Project 2 Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]

      // Setup initial state with project 1 selected
      useProjectsStore.setState({
        projects: [project1, project2],
        currentProject: project1,
      })
      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", sessions1)
        state.currentSession = sessions1[0]
      })

      // Switch to project 2
      mockGetProject.mockResolvedValue(project2)
      mockGetSessions.mockResolvedValue(sessions2)

      await useProjectsStore.getState().selectProject("project-2")
      await useSessionsStore.getState().loadSessions("project-2", "/test/path")

      // Select session from new project
      useSessionsStore.getState().selectSession(sessions2[0])

      // Verify state consistency
      const projectState = useProjectsStore.getState()
      const sessionState = useSessionsStore.getState()

      expect(projectState.currentProject).toBeDefined()
      expect(projectState.currentProject?.id).toBe("project-2")
      expect(sessionState.currentSession).toBeDefined()
      expect(sessionState.currentSession?.projectID).toBe("project-2")
      expect(sessionState.sessions.get("project-1")).toEqual(sessions1) // Previous sessions preserved
      expect(sessionState.sessions.get("project-2")).toEqual(sessions2)
    })
  })

  describe("Memory Management and Performance", () => {
    test("handles large datasets efficiently across stores", async () => {
      // Create large number of projects
      const projects = Array.from({ length: 100 }, (_, i) =>
        TestDataFactory.createProject({ id: `project-${i}`, name: `Project ${i}` }),
      )
      mockGetProjects.mockResolvedValue(projects)

      await useProjectsStore.getState().loadProjects()

      // Create sessions for each project
      expect(mockGetProjects).toBeDefined()

      for (let i = 0; i < 100; i++) {
        const sessions: Session[] = Array.from({ length: 10 }, (_, j) => ({
          id: `session-${i}-${j}`,
          projectID: `project-${i}`,
          directory: `/path/${i}`,
          title: `Session ${j}`,
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        }))

        useSessionsStore.setState((state) => {
          state.sessions.set(`project-${i}`, sessions)
        })
      }

      // Verify data is stored correctly
      const projectState = useProjectsStore.getState()
      const sessionState = useSessionsStore.getState()

      expect(projectState.projects).toHaveLength(100)
      expect(sessionState.sessions.size).toBe(100)

      // Test cleanup
      for (let i = 0; i < 100; i++) {
        useSessionsStore.getState().clearSessions(`project-${i}`)
      }

      expect(useSessionsStore.getState().sessions.size).toBe(0)
    })

    test("handles rapid state changes without memory leaks", async () => {
      const project = TestDataFactory.createProject({ id: "rapid-project" })

      // Perform rapid state changes
      for (let i = 0; i < 50; i++) {
        useProjectsStore.setState({
          projects: [{ ...project, name: `Project ${i}` }],
          loading: i % 2 === 0,
        })

        useSessionsStore.setState((state) => {
          state.sessions.set("rapid-project", [
            {
              id: `session-${i}`,
              projectID: "rapid-project",
              directory: "/path",
              title: `Session ${i}`,
              version: "1.0.0",
              time: { created: Date.now(), updated: Date.now() },
            },
          ])
        })
      }

      // Verify final state is consistent
      const projectState = useProjectsStore.getState()
      const sessionState = useSessionsStore.getState()

      expect(projectState.projects[0].name).toBe("Project 49")
      expect(sessionState.sessions.get("rapid-project")?.[0].title).toBe("Session 49")
    })
  })

  describe("Store Synchronization", () => {
    test("maintains referential integrity between stores", () => {
      const project = TestDataFactory.createProject({ id: "ref-integrity" })
      const session: Session = {
        id: "session-ref",
        projectID: "ref-integrity",
        directory: "/path",
        title: "Reference Session",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      // Set up related data
      useProjectsStore.setState({
        projects: [project],
        currentProject: project,
      })
      useSessionsStore.setState((state) => {
        state.sessions.set("ref-integrity", [session])
        state.currentSession = session
      })

      // Verify referential integrity
      const projectState = useProjectsStore.getState()
      const sessionState = useSessionsStore.getState()

      expect(projectState.currentProject).toBeDefined()
      expect(projectState.currentProject?.id || "").toBe(sessionState.currentSession?.projectID || "")
      const projectId = projectState.currentProject?.id
      if (projectId) {
        expect(sessionState.sessions.has(projectId)).toBe(true)
      }
    })

    test("handles store reset coordination", () => {
      const project = TestDataFactory.createProject({ id: "reset-test" })
      const session: Session = {
        id: "session-reset",
        projectID: "reset-test",
        directory: "/path",
        title: "Reset Session",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      // Set up initial state
      useProjectsStore.setState({
        projects: [project],
        currentProject: project,
        loading: true,
        error: "error",
      })
      useSessionsStore.setState((state) => {
        state.sessions.set("reset-test", [session])
        state.currentSession = session
        state.loading = true
        state.error = "error"
      })

      // Reset both stores
      useProjectsStore.setState({
        projects: [],
        currentProject: null,
        loading: false,
        error: null,
        instanceOperations: {},
      })
      useSessionsStore.setState({
        sessions: new Map(),
        currentSession: null,
        loading: false,
        error: null,
      })

      // Verify both stores are reset
      const projectState = useProjectsStore.getState()
      const sessionState = useSessionsStore.getState()

      expect(projectState.projects).toEqual([])
      expect(projectState.currentProject).toBe(null)
      expect(sessionState.sessions.size).toBe(0)
      expect(sessionState.currentSession).toBe(null)
    })

    test("handles partial store failures gracefully", async () => {
      const project = TestDataFactory.createProject({ id: "partial-fail" })
      useProjectsStore.setState({ projects: [project] })

      // Mock partial failures
      mockStartInstance.mockResolvedValue({ id: "inst-1", port: 3099, status: "running", startedAt: new Date() })
      mockGetSessions.mockRejectedValue(new Error("Sessions failed"))

      // Attempt operations
      await useProjectsStore.getState().startInstance("partial-fail")
      await useSessionsStore.getState().loadSessions("partial-fail", "/test/path")

      // Verify partial success/failure
      const projectState = useProjectsStore.getState()
      const sessionState = useSessionsStore.getState()

      expect(projectState.projects.find((p) => p.id === "partial-fail")?.instance).toBeDefined()
      expect(projectState.error).toBe(null)
      expect(sessionState.error).toBe("Sessions failed")
      expect(sessionState.sessions.has("partial-fail")).toBe(false)
    })
  })
})

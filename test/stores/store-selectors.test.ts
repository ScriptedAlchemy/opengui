import { describe, test, expect, beforeEach } from "@rstest/core"
import { renderHook } from "@testing-library/react"
import { TestDataFactory } from "../fixtures/test-data"
import {
  useProjectsStore,
  useProjects,
  useCurrentProject,
  useProjectsLoading,
  useProjectsError,
  useInstanceOperations,
} from "../../src/stores/projects"
import {
  useSessionsStore,
  useSessionsForProject,
  useCurrentSession,
  useSessionsLoading,
  useSessionsError,
} from "../../src/stores/sessions"

describe("Store Selectors", () => {
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
      listLoading: false,
      createLoading: false,
      error: null,
    })
  })

  describe("Project Store Selectors", () => {
    test("useProjects returns projects array", () => {
      const project1 = TestDataFactory.createProject({ id: "project-1", name: "Project 1" })
      const project2 = TestDataFactory.createProject({ id: "project-2", name: "Project 2" })

      useProjectsStore.setState({ projects: [project1, project2] })

      const { result } = renderHook(() => useProjects())

      expect(result.current).toHaveLength(2)
      expect(result.current[0].name).toBe("Project 1")
      expect(result.current[1].name).toBe("Project 2")
    })

    test("useCurrentProject returns current project", () => {
      const project = TestDataFactory.createProject({ id: "current-project" })

      useProjectsStore.setState({ currentProject: project })

      const { result } = renderHook(() => useCurrentProject())

      expect(result.current).toBeDefined()
      expect(result.current?.id).toBe("current-project")
    })

    test("useProjectsLoading returns loading state", () => {
      useProjectsStore.setState({ loading: true })

      const { result } = renderHook(() => useProjectsLoading())

      expect(result.current).toBe(true)
    })

    test("useProjectsError returns error state", () => {
      useProjectsStore.setState({ error: "Test error" })

      const { result } = renderHook(() => useProjectsError())

      expect(result.current).toBe("Test error")
    })

    test("useInstanceOperations returns instance operations", () => {
      useProjectsStore.setState({ instanceOperations: { "project-1": true } })

      const { result } = renderHook(() => useInstanceOperations())

      expect(result.current["project-1"]).toBe(true)
    })

    test("computed selectors work with direct state access", () => {
      const runningProject = TestDataFactory.createProject({
        id: "running-project",
        instance: { id: "instance-1", port: 3001, status: "running", startedAt: new Date() },
      })
      const stoppedProject = TestDataFactory.createProject({ id: "stopped-project" })

      useProjectsStore.setState({ projects: [runningProject, stoppedProject] })

      // Test the selector logic directly
      const state = useProjectsStore.getState()
      const runningProjects = state.projects.filter((p: any) => p.instance?.status === "running")

      expect(runningProjects).toHaveLength(1)
      expect(runningProjects[0].id).toBe("running-project")
    })
  })

  describe("Session Store Selectors", () => {
    test("useSessionsForProject returns sessions for specific project", () => {
      const session1 = {
        id: "session-1",
        projectID: "project-1",
        directory: "/path",
        title: "Session 1",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }
      const session2 = {
        id: "session-2",
        projectID: "project-1",
        directory: "/path",
        title: "Session 2",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [session1, session2])
      })

      const { result } = renderHook(() => useSessionsForProject("project-1"))

      expect(result.current).toHaveLength(2)
      expect(result.current[0].title).toBe("Session 1")
      expect(result.current[1].title).toBe("Session 2")
    })

    test("useSessionsForProject returns empty array for non-existent project", () => {
      const { result } = renderHook(() => useSessionsForProject("non-existent"))

      expect(result.current).toEqual([])
    })

    test("useCurrentSession returns current session", () => {
      const session = {
        id: "current-session",
        projectID: "project-1",
        directory: "/path",
        title: "Current Session",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState({ currentSession: session })

      const { result } = renderHook(() => useCurrentSession())

      expect(result.current).toBeDefined()
      expect(result.current?.id).toBe("current-session")
    })

    test("useSessionsLoading returns loading state", () => {
      // Sessions store exposes separate loading flags; selector ORs them
      useSessionsStore.setState({ listLoading: true, createLoading: false })

      const { result } = renderHook(() => useSessionsLoading())

      expect(result.current).toBe(true)
    })

    test("useSessionsError returns error state", () => {
      useSessionsStore.setState({ error: "Session error" })

      const { result } = renderHook(() => useSessionsError())

      expect(result.current).toBe("Session error")
    })
  })

  describe("Selector Performance", () => {
    test("selectors return stable references for same data", () => {
      const project = TestDataFactory.createProject({ id: "project-1" })
      useProjectsStore.setState({ projects: [project] })

      const { result: result1 } = renderHook(() => useProjects())
      const { result: result2 } = renderHook(() => useProjects())

      // Should return the same reference for same data
      expect(result1.current).toBe(result2.current)
    })

    test("selectors update when relevant data changes", () => {
      const project1 = TestDataFactory.createProject({ id: "project-1" })
      useProjectsStore.setState({ projects: [project1] })

      const { result, rerender } = renderHook(() => useProjects())

      expect(result.current).toHaveLength(1)

      const project2 = TestDataFactory.createProject({ id: "project-2" })
      useProjectsStore.setState({ projects: [project1, project2] })

      rerender()

      expect(result.current).toHaveLength(2)
    })

    test("selectors don't update when unrelated data changes", () => {
      const project = TestDataFactory.createProject({ id: "project-1" })
      useProjectsStore.setState({ projects: [project] })

      const { result } = renderHook(() => useProjects())
      const initialReference = result.current

      // Change unrelated state
      useProjectsStore.setState({ loading: true })

      // Projects reference should remain the same
      expect(result.current).toBe(initialReference)
    })
  })

  describe("Edge Cases", () => {
    test("selectors handle empty state gracefully", () => {
      const { result: projectsResult } = renderHook(() => useProjects())
      const { result: currentProjectResult } = renderHook(() => useCurrentProject())
      const { result: sessionsResult } = renderHook(() => useSessionsForProject("project-1"))
      const { result: currentSessionResult } = renderHook(() => useCurrentSession())

      expect(projectsResult.current).toEqual([])
      expect(currentProjectResult.current).toBe(null)
      expect(sessionsResult.current).toEqual([])
      expect(currentSessionResult.current).toBe(null)
    })

    test("selectors handle null/undefined values", () => {
      useProjectsStore.setState({
        projects: [],
        currentProject: null,
        error: null,
      })

      useSessionsStore.setState({
        currentSession: null,
        error: null,
      })

      const { result: errorResult } = renderHook(() => useProjectsError())
      const { result: sessionErrorResult } = renderHook(() => useSessionsError())

      expect(errorResult.current).toBe(null)
      expect(sessionErrorResult.current).toBe(null)
    })
  })
})

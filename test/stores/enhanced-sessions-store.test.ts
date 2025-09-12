import { describe, expect, test, beforeEach, afterEach, rstest } from "@rstest/core"
import { renderHook } from "@testing-library/react"
import type { Session } from "@opencode-ai/sdk"

// Create mock functions for SDK session methods
const mockGetSessions = rstest.fn((): Promise<Session[]> => Promise.resolve([]))
const mockCreateSession = rstest.fn((params?: { title?: string }): Promise<Session> =>
  Promise.resolve({} as Session)
)
const mockUpdateSession = rstest.fn((): Promise<Session> => Promise.resolve({} as Session))
const mockDeleteSession = rstest.fn((): Promise<boolean> => Promise.resolve(true))

// Mock the opencode SDK service getClient -> returns a fake SDK client with session methods
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
    // Defer reading mockGetClient until invocation to avoid TDZ issues
    getClient: ((...args: any[]) => (mockGetClient as any)(...args)) as any,
  },
}))

// Import store after mocking
import {
  useSessionsStore,
  useSessionsForProject,
  useCurrentSession,
  useSessionsLoading,
  useSessionsError,
  useRecentSessions,
  useSessionById,
} from "../../src/stores/sessions"

describe("Enhanced Sessions Store", () => {
  beforeEach(() => {
    // Reset all mocks
    mock.restore()

    // Reset mock call counts
    mockGetSessions.mockClear()
    mockCreateSession.mockClear()
    mockUpdateSession.mockClear()
    mockDeleteSession.mockClear()
    mockGetClient.mockClear()

    // Ensure SDK service mock is active
    rstest.mock("../../src/services/opencode-sdk-service", () => ({
      opencodeSDKService: {
        getClient: ((...args: any[]) => (mockGetClient as any)(...args)) as any,
      },
    }))

    // Reset store state before each test
    useSessionsStore.setState({
      sessions: new Map(),
      currentSession: null,
      listLoading: false,
      createLoading: false,
      error: null,
    })

    // Setup default mock responses
    mockGetSessions.mockResolvedValue([])
    mockCreateSession.mockResolvedValue({
      id: "new-session",
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
    // Clean up any remaining state
    useSessionsStore.setState({
      sessions: new Map(),
      currentSession: null,
      listLoading: false,
      createLoading: false,
      error: null,
    })
  })

  describe("Store Actions and Mutations", () => {
    test("all store actions are available and callable", () => {
      const state = useSessionsStore.getState()

      expect(typeof state.loadSessions).toBe("function")
      expect(typeof state.createSession).toBe("function")
      expect(typeof state.selectSession).toBe("function")
      expect(typeof state.updateSession).toBe("function")
      expect(typeof state.deleteSession).toBe("function")
      expect(typeof state.clearSessions).toBe("function")
      expect(typeof state.clearError).toBe("function")
    })

    test("loadSessions mutation updates state correctly", async () => {
      const sessions: Session[] = [
        {
          id: "session-1",
          projectID: "project-1",
          directory: "/path",
          title: "Session 1",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
        {
          id: "session-2",
          projectID: "project-1",
          directory: "/path",
          title: "Session 2",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]
      mockGetSessions.mockResolvedValue(sessions)

      // Test loading state
      const loadPromise = useSessionsStore.getState().loadSessions("project-1", "/test/path")
      expect(useSessionsStore.getState().listLoading).toBe(true)
      expect(useSessionsStore.getState().error).toBe(null)

      await loadPromise

      const state = useSessionsStore.getState()
      expect(state.listLoading).toBe(false)
      expect(state.sessions.get("project-1")).toEqual(sessions)
      expect(state.error).toBe(null)
    })

    test("createSession mutation adds session to state", async () => {
      const newSession: Session = {
        id: "new-session",
        projectID: "project-1",
        directory: "/path",
        title: "New Session",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }
      mockCreateSession.mockResolvedValue(newSession)

      const result = await useSessionsStore.getState().createSession("project-1", "/test/path", "New Session")

      expect(result).toEqual(newSession)
      const state = useSessionsStore.getState()
      expect(state.sessions.get("project-1")).toContain(newSession)
      expect(state.currentSession).toEqual(newSession)
      expect(state.createLoading).toBe(false)
    })

    test("updateSession mutation modifies existing session", async () => {
      const originalSession: Session = {
        id: "update-test",
        projectID: "project-1",
        directory: "/path",
        title: "Original Title",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }
      const updatedSession = { ...originalSession, title: "Updated Title" }

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [originalSession])
        state.currentSession = originalSession
      })
      mockUpdateSession.mockResolvedValue(updatedSession)

      await useSessionsStore.getState().updateSession("project-1", "/test/path", "update-test", { title: "Updated Title" })

      const state = useSessionsStore.getState()
      const sessions = state.sessions.get("project-1")
      const found = sessions?.find((s) => s.id === "update-test")
      expect(found).toBeDefined()
      expect(found?.title).toBe("Updated Title")
      expect(state.currentSession).toBeDefined()
      expect(state.currentSession?.title).toBe("Updated Title")
    })

    test("deleteSession mutation removes session from state", async () => {
      const session1: Session = {
        id: "delete1",
        projectID: "project-1",
        directory: "/path",
        title: "Session 1",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }
      const session2: Session = {
        id: "delete2",
        projectID: "project-1",
        directory: "/path",
        title: "Session 2",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [session1, session2])
        state.currentSession = session1
      })

      await useSessionsStore.getState().deleteSession("project-1", "/test/path", "delete1")

      const state = useSessionsStore.getState()
      const sessions = state.sessions.get("project-1")
      expect(sessions).toHaveLength(1)
      expect(sessions).toBeDefined()
      expect(sessions?.[0].id).toBe("delete2")
      expect(state.currentSession).toBe(null)
    })

    test("selectSession mutation updates current session", () => {
      const session: Session = {
        id: "select-test",
        projectID: "project-1",
        directory: "/path",
        title: "Selected Session",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.getState().selectSession(session)

      const state = useSessionsStore.getState()
      expect(state.currentSession).toEqual(session)
    })

    test("clearSessions mutation removes all sessions for project", () => {
      const sessions: Session[] = [
        {
          id: "clear1",
          projectID: "project-1",
          directory: "/path",
          title: "Session 1",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
        {
          id: "clear2",
          projectID: "project-1",
          directory: "/path",
          title: "Session 2",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", sessions)
        state.currentSession = sessions[0]
      })

      useSessionsStore.getState().clearSessions("project-1")

      const state = useSessionsStore.getState()
      expect(state.sessions.has("project-1")).toBe(false)
      expect(state.currentSession).toBe(null)
    })
  })

  describe("Computed Values and Selectors", () => {
    test("useSessionsForProject selector returns sessions for specific project", () => {
      const sessions: Session[] = [
        {
          id: "session-1",
          projectID: "project-1",
          directory: "/path",
          title: "Session 1",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
        {
          id: "session-2",
          projectID: "project-1",
          directory: "/path",
          title: "Session 2",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", sessions)
      })

      const { result } = renderHook(() => useSessionsForProject("project-1"))
      expect(result.current).toEqual(sessions)
    })

    test("useSessionsForProject returns empty array for non-existent project", () => {
      const { result } = renderHook(() => useSessionsForProject("non-existent"))
      expect(result.current).toEqual([])
    })

    test("useRecentSessions selector returns sessions sorted by updated time", () => {
      const now = Date.now()
      const sessions: Session[] = [
        {
          id: "old",
          projectID: "project-1",
          directory: "/path",
          title: "Old Session",
          version: "1.0.0",
          time: { created: now - 10000, updated: now - 10000 },
        },
        {
          id: "recent",
          projectID: "project-1",
          directory: "/path",
          title: "Recent Session",
          version: "1.0.0",
          time: { created: now - 5000, updated: now - 1000 },
        },
        {
          id: "newest",
          projectID: "project-1",
          directory: "/path",
          title: "Newest Session",
          version: "1.0.0",
          time: { created: now - 3000, updated: now - 500 },
        },
      ]

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", sessions)
      })

      const { result } = renderHook(() => useRecentSessions("project-1", 2))
      expect(result.current).toHaveLength(2)
      expect(result.current[0].id).toBe("newest")
      expect(result.current[1].id).toBe("recent")
    })

    test("useSessionById selector returns specific session", () => {
      const sessions: Session[] = [
        {
          id: "find-me",
          projectID: "project-1",
          directory: "/path",
          title: "Find Me",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
        {
          id: "not-me",
          projectID: "project-1",
          directory: "/path",
          title: "Not Me",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", sessions)
      })

      const { result: foundResult } = renderHook(() => useSessionById("project-1", "find-me"))
      expect(foundResult.current).toBeDefined()
      expect(foundResult.current?.id).toBe("find-me")

      const { result: notFoundResult } = renderHook(() => useSessionById("project-1", "missing"))
      expect(notFoundResult.current).toBeUndefined()
    })

    test("basic selectors return correct values", () => {
      const session: Session = {
        id: "current",
        projectID: "project-1",
        directory: "/path",
        title: "Current Session",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState({
        currentSession: session,
        listLoading: false,
        createLoading: true,
        error: "Test error",
      })

      const { result: currentResult } = renderHook(() => useCurrentSession())
      const { result: loadingResult } = renderHook(() => useSessionsLoading())
      const { result: errorResult } = renderHook(() => useSessionsError())

      expect(currentResult.current).toEqual(session)
      expect(loadingResult.current).toBe(true)
      expect(errorResult.current).toBe("Test error")
    })

    test("selectors are memoized and stable", () => {
      const sessions: Session[] = [
        {
          id: "stable",
          projectID: "project-1",
          directory: "/path",
          title: "Stable Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", sessions)
      })

      const { result: result1 } = renderHook(() => useSessionsForProject("project-1"))
      const { result: result2 } = renderHook(() => useSessionsForProject("project-1"))

      // Should return same reference for same data
      expect(result1.current).toBe(result2.current)
    })
  })

  describe("Store Persistence and Hydration", () => {
    test("sessions are not persisted (ephemeral state)", () => {
      const sessions: Session[] = [
        {
          id: "ephemeral",
          projectID: "project-1",
          directory: "/path",
          title: "Ephemeral Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", sessions)
        state.currentSession = sessions[0]
        state.listLoading = true
        state.error = "error"
      })

      // Sessions store doesn't use persistence, so all state is ephemeral
      const state = useSessionsStore.getState()
      expect(state.sessions.get("project-1")).toEqual(sessions)
      expect(state.currentSession).toEqual(sessions[0])
      expect(state.listLoading || state.createLoading).toBe(true)
      expect(state.error).toBe("error")
    })

    test("hydration starts with empty state", () => {
      // Sessions always start empty on app load
      const initialState = useSessionsStore.getState()

      expect(initialState.sessions.size).toBe(0)
      expect(initialState.currentSession).toBe(null)
      expect(initialState.listLoading).toBe(false)
      expect(initialState.createLoading).toBe(false)
      expect(initialState.error).toBe(null)
    })

    test("handles Map structure correctly during state updates", () => {
      const session1: Session = {
        id: "map-test-1",
        projectID: "project-1",
        directory: "/path",
        title: "Session 1",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }
      const session2: Session = {
        id: "map-test-2",
        projectID: "project-2",
        directory: "/path",
        title: "Session 2",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [session1])
        state.sessions.set("project-2", [session2])
      })

      const state = useSessionsStore.getState()
      expect(state.sessions.size).toBe(2)
      expect(state.sessions.get("project-1")).toEqual([session1])
      expect(state.sessions.get("project-2")).toEqual([session2])
    })
  })

  describe("Concurrent State Updates", () => {
    test("handles concurrent session loading for same project", async () => {
      const sessions: Session[] = [
        {
          id: "concurrent-1",
          projectID: "project-1",
          directory: "/path",
          title: "Concurrent Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        },
      ]

      mockGetSessions.mockResolvedValue(sessions)

      // Start concurrent loads
      const load1 = useSessionsStore.getState().loadSessions("project-1", "/test/path")
      const load2 = useSessionsStore.getState().loadSessions("project-1", "/test/path")

      await Promise.all([load1, load2])

      // Both calls complete (no concurrency protection in sessions store)
      expect(mockGetSessions).toHaveBeenCalledTimes(2)

      const state = useSessionsStore.getState()
      expect(state.sessions.get("project-1")).toEqual(sessions)
    })

    test("handles concurrent session creation", async () => {
      const session1: Session = {
        id: "create-1",
        projectID: "project-1",
        directory: "/path",
        title: "Create 1",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }
      const session2: Session = {
        id: "create-2",
        projectID: "project-1",
        directory: "/path",
        title: "Create 2",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      mockCreateSession.mockResolvedValueOnce(session1).mockResolvedValueOnce(session2)

      // Create sessions concurrently
      const create1 = useSessionsStore.getState().createSession("project-1", "/test/path", "Create 1")
      const create2 = useSessionsStore.getState().createSession("project-1", "/test/path", "Create 2")

      const results = await Promise.all([create1, create2])

      expect(results[0]).toEqual(session1)
      expect(results[1]).toEqual(session2)
      expect(mockCreateSession).toHaveBeenCalledTimes(2)

      const state = useSessionsStore.getState()
      const projectSessions = state.sessions.get("project-1")
      expect(projectSessions).toHaveLength(2)
    })

    test("handles rapid state mutations correctly", () => {
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        id: `rapid-${i}`,
        projectID: "project-1",
        directory: "/path",
        title: `Session ${i}`,
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }))

      // Perform rapid mutations
      sessions.forEach((session, i) => {
        useSessionsStore.setState((state) => {
          state.sessions.set("project-1", [session])
          state.listLoading = i % 2 === 0
        })
      })

      const state = useSessionsStore.getState()
      expect(state.sessions.get("project-1")?.[0].title).toBe("Session 9")
    })

    test("concurrent update and delete operations", async () => {
      const session: Session = {
        id: "concurrent-ops",
        projectID: "project-1",
        directory: "/path",
        title: "Concurrent Ops",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [session])
        state.currentSession = session
      })

      mockUpdateSession.mockResolvedValue({ ...session, title: "Updated" })
      mockDeleteSession.mockResolvedValue(true)

      // Try to update and delete concurrently
      const updatePromise = useSessionsStore.getState().updateSession("project-1", "/test/path", "concurrent-ops", { title: "Updated" })
      const deletePromise = useSessionsStore.getState().deleteSession("project-1", "/test/path", "concurrent-ops")

      await Promise.all([updatePromise, deletePromise])

      // Both operations should complete
      expect(mockUpdateSession).toHaveBeenCalled()
      expect(mockDeleteSession).toHaveBeenCalled()
    })
  })

  describe("Store Reset and Cleanup", () => {
    test("clearError resets error state", () => {
      useSessionsStore.setState({ error: "Test error" })
      expect(useSessionsStore.getState().error).toBe("Test error")

      useSessionsStore.getState().clearError()
      expect(useSessionsStore.getState().error).toBe(null)
    })

    test("clearSessions removes project sessions and updates current", () => {
      const session1: Session = {
        id: "cleanup-1",
        projectID: "project-1",
        directory: "/path",
        title: "Session 1",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }
      const session2: Session = {
        id: "cleanup-2",
        projectID: "project-2",
        directory: "/path",
        title: "Session 2",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [session1])
        state.sessions.set("project-2", [session2])
        state.currentSession = session1
      })

      useSessionsStore.getState().clearSessions("project-1")

      const state = useSessionsStore.getState()
      expect(state.sessions.has("project-1")).toBe(false)
      expect(state.sessions.has("project-2")).toBe(true)
      expect(state.currentSession).toBe(null)
    })

    test("can reset entire store state", () => {
      const session: Session = {
        id: "reset-test",
        projectID: "project-1",
        directory: "/path",
        title: "Reset Test",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [session])
        state.currentSession = session
        state.listLoading = true
        state.error = "error"
      })

      // Reset to initial state
      useSessionsStore.setState({
        sessions: new Map(),
        currentSession: null,
        listLoading: false,
        createLoading: false,
        error: null,
      })

      const state = useSessionsStore.getState()
      expect(state.sessions.size).toBe(0)
      expect(state.currentSession).toBe(null)
      expect(state.listLoading).toBe(false)
      expect(state.createLoading).toBe(false)
      expect(state.error).toBe(null)
    })

    test("handles cleanup when current session is from different project", () => {
      const session1: Session = {
        id: "different-1",
        projectID: "project-1",
        directory: "/path",
        title: "Session 1",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }
      const session2: Session = {
        id: "different-2",
        projectID: "project-2",
        directory: "/path",
        title: "Session 2",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [session1])
        state.sessions.set("project-2", [session2])
        state.currentSession = session2
      })

      useSessionsStore.getState().clearSessions("project-1")

      const state = useSessionsStore.getState()
      expect(state.sessions.has("project-1")).toBe(false)
      expect(state.currentSession).toEqual(session2) // Should remain unchanged
    })
  })

  describe("Error Handling and Recovery", () => {
    test("optimistic updates are reverted on API failures", async () => {
      const originalSession: Session = {
        id: "revert-test",
        projectID: "project-1",
        directory: "/path",
        title: "Original Title",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [originalSession])
        state.currentSession = originalSession
      })

      mockUpdateSession.mockRejectedValue(new Error("Update failed"))
      mockGetSessions.mockResolvedValue([originalSession]) // For revert

      try {
        await useSessionsStore.getState().updateSession("project-1", "/test/path", "revert-test", { title: "New Title" })
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }

      // Should revert to original state
      expect(mockGetSessions).toHaveBeenCalled()
    })

    test("handles non-Error objects in API failures", async () => {
      mockGetSessions.mockRejectedValue("String error")

      await useSessionsStore.getState().loadSessions("project-1", "/test/path")

      const state = useSessionsStore.getState()
      expect(state.error).toBe("Failed to load sessions")
    })

    test("handles session creation failure", async () => {
      mockCreateSession.mockRejectedValue(new Error("Creation failed"))

      try {
        await useSessionsStore.getState().createSession("project-1", "/test/path", "New Session")
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe("Creation failed")
      }

      const state = useSessionsStore.getState()
      expect(state.error).toBe("Creation failed")
      expect(state.createLoading).toBe(false)
    })

    test("handles delete failure and revert state", async () => {
      const session: Session = {
        id: "delete-fail",
        projectID: "project-1",
        directory: "/path",
        title: "Delete Fail",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [session])
      })

      mockDeleteSession.mockRejectedValue(new Error("Delete failed"))
      mockGetSessions.mockResolvedValue([session]) // For revert

      try {
        await useSessionsStore.getState().deleteSession("project-1", "/test/path", "delete-fail")
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }

      // Should revert to original state
      expect(mockGetSessions).toHaveBeenCalled()
    })

    test("handles update without current session", async () => {
      useSessionsStore.setState({ currentSession: null })

      // Should not throw or make API calls
      await useSessionsStore.getState().updateSession("project-1", "/test/path", "session-123", { title: "New Title" })

      expect(mockUpdateSession).not.toHaveBeenCalled()
    })

    test("handles operations on non-existent projects", async () => {
      mockGetSessions.mockResolvedValue([])

      await useSessionsStore.getState().loadSessions("non-existent-project", "/test/path")

      const state = useSessionsStore.getState()
      expect(state.sessions.get("non-existent-project")).toEqual([])
      expect(state.error).toBe(null)
    })
  })

  describe("Performance and Memory Management", () => {
    test("handles large numbers of sessions efficiently", async () => {
      const largeSessions: Session[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `session-${i}`,
        projectID: "project-1",
        directory: "/path",
        title: `Session ${i}`,
        version: "1.0.0",
        time: { created: Date.now() - i * 1000, updated: Date.now() - i * 1000 },
      }))

      mockGetSessions.mockResolvedValue(largeSessions)

      await useSessionsStore.getState().loadSessions("project-1", "/test/path")

      const state = useSessionsStore.getState()
      const projectSessions = state.sessions.get("project-1")
      expect(projectSessions).toHaveLength(1000)
      expect(projectSessions).toBeDefined()
      expect(projectSessions?.[0].id).toBe("session-0")
      expect(projectSessions).toBeDefined()
      expect(projectSessions?.[999].id).toBe("session-999")
    })

    test("selector performance with large datasets", () => {
      const sessions: Session[] = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-${i}`,
        projectID: "project-1",
        directory: "/path",
        title: `Session ${i}`,
        version: "1.0.0",
        time: { created: Date.now() - i * 1000, updated: Date.now() - i * 1000 },
      }))

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", sessions)
      })

      const start = performance.now()
      const { result } = renderHook(() => useRecentSessions("project-1", 10))
      const end = performance.now()

      expect(result.current).toHaveLength(10)
      expect(end - start).toBeLessThan(10) // Should be very fast
    })

    test("memory cleanup after session removal", async () => {
      const sessions: Session[] = Array.from({ length: 10 }, (_, i) => ({
        id: `cleanup-${i}`,
        projectID: "project-1",
        directory: "/path",
        title: `Session ${i}`,
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }))

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", sessions)
      })

      // Remove all sessions
      for (const session of sessions) {
        await useSessionsStore.getState().deleteSession("project-1", "/test/path", session.id)
      }

      const state = useSessionsStore.getState()
      expect(state.sessions.get("project-1")).toHaveLength(0)
    })

    test("handles Map operations correctly with immer", () => {
      const session1: Session = {
        id: "immer-1",
        projectID: "project-1",
        directory: "/path",
        title: "Session 1",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }
      const session2: Session = {
        id: "immer-2",
        projectID: "project-1",
        directory: "/path",
        title: "Session 2",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      // Add first session
      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [session1])
      })

      // Add second session to same project
      useSessionsStore.setState((state) => {
        const existing = state.sessions.get("project-1") || []
        state.sessions.set("project-1", [...existing, session2])
      })

      const state = useSessionsStore.getState()
      const projectSessions = state.sessions.get("project-1")
      expect(projectSessions).toHaveLength(2)
      expect(projectSessions).toBeDefined()
      expect(projectSessions?.[0].id).toBe("immer-1")
      expect(projectSessions).toBeDefined()
      expect(projectSessions?.[1].id).toBe("immer-2")
    })
  })

  describe("Integration with OpenCodeClient", () => {
    test("passes correct parameters to OpenCodeClient", async () => {
      await useSessionsStore.getState().loadSessions("test-project", "/test/path")

      expect(mockGetClient).toHaveBeenCalledWith("test-project", "/test/path")
      expect(mockGetSessions).toHaveBeenCalled()
    })

    test("handles different project IDs correctly", async () => {
      await useSessionsStore.getState().loadSessions("project-1", "/test/path")
      await useSessionsStore.getState().loadSessions("project-2", "/test/path")

      expect(mockGetClient).toHaveBeenCalledWith("project-1", "/test/path")
      expect(mockGetClient).toHaveBeenCalledWith("project-2", "/test/path")
    })

    test("handles client creation failures", async () => {
      mockGetClient.mockRejectedValueOnce(new Error("Client creation failed"))

      await useSessionsStore.getState().loadSessions("project-1", "/test/path")

      const state = useSessionsStore.getState()
      expect(state.error).toBe("Client creation failed")
      expect(state.listLoading).toBe(false)
    })

    test("handles API method failures gracefully", async () => {
      mockGetSessions.mockRejectedValue(new Error("API method failed"))

      await useSessionsStore.getState().loadSessions("project-1", "/test/path")

      const state = useSessionsStore.getState()
      expect(state.error).toBe("API method failed")
      expect(state.listLoading).toBe(false)
    })
  })

  describe("Session Lifecycle Management", () => {
    test("properly manages session creation lifecycle", async () => {
      const newSession: Session = {
        id: "lifecycle-new",
        projectID: "project-1",
        directory: "/path",
        title: "Lifecycle Session",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      mockCreateSession.mockResolvedValue(newSession)

      // Check loading state during creation
      let loadingDuringCreation = false
      const createPromise = useSessionsStore.getState().createSession("project-1", "/test/path", "Lifecycle Session")

      // Check if loading state was set
      if (useSessionsStore.getState().createLoading) {
        loadingDuringCreation = true
      }

      const result = await createPromise

      expect(loadingDuringCreation).toBe(true)
      expect(result).toEqual(newSession)
      expect(useSessionsStore.getState().createLoading).toBe(false)
      expect(useSessionsStore.getState().currentSession).toEqual(newSession)
    })

    test("handles session updates with optimistic updates", async () => {
      const originalSession: Session = {
        id: "lifecycle-update",
        projectID: "project-1",
        directory: "/path",
        title: "Original Title",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      }

      useSessionsStore.setState((state) => {
        state.sessions.set("project-1", [originalSession])
        state.currentSession = originalSession
      })

      // Mock slow update
      let resolveUpdate: (value: Session) => void
      const slowUpdatePromise = new Promise<Session>((resolve) => {
        resolveUpdate = resolve
      })
      mockUpdateSession.mockReturnValue(slowUpdatePromise)

      const updatePromise = useSessionsStore.getState().updateSession("project-1", "/test/path", "lifecycle-update", { title: "New Title" })

      // Check optimistic update
      let state = useSessionsStore.getState()
      expect(state.currentSession).toBeDefined()
      expect(state.currentSession?.title).toBe("New Title")

      // Complete the update
      resolveUpdate!({ ...originalSession, title: "New Title" })
      await updatePromise

      state = useSessionsStore.getState()
      expect(state.currentSession).toBeDefined()
      expect(state.currentSession?.title).toBe("New Title")
    })
  })
})

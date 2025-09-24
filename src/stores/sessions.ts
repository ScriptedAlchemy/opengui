import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { enableMapSet } from "immer"
import type { Session } from "@opencode-ai/sdk/client"
import type { OpencodeSDKService } from "../services/opencode-sdk-service"

// Enable MapSet plugin for Immer to handle Map data structures
enableMapSet()

// Re-export Session type from SDK
export type { Session }

// Lazily import the SDK service so test mocks can hook before first load
let __sdkService: OpencodeSDKService | null = null
const getSDKService = async (): Promise<OpencodeSDKService> => {
  if (__sdkService) return __sdkService
  const mod = await import("../services/opencode-sdk-service")
  __sdkService = mod.opencodeSDKService
  return __sdkService
}

interface SessionsState {
  // State
  sessions: Map<string, Session[]>
  currentSession: Session | null
  // Separate loading states for better UX and e2e stability
  listLoading: boolean
  createLoading: boolean
  error: string | null

  // Actions
  loadSessions: (projectId: string, projectPath: string) => Promise<void>
  createSession: (projectId: string, projectPath: string, title?: string) => Promise<Session>
  selectSession: (session: Session) => void
  updateSession: (
    projectId: string,
    projectPath: string,
    sessionId: string,
    updates: Partial<Session>
  ) => Promise<void>
  deleteSession: (projectId: string, projectPath: string, sessionId: string) => Promise<void>
  clearSessions: (projectId: string) => void
  clearError: () => void
}

const normalizeWorktreePath = (projectPath?: string) => {
  if (!projectPath) return ""
  const trimmed = projectPath.trim()
  if (!trimmed) return ""
  return trimmed.replace(/\\/g, "/").replace(/\/+$/, "")
}

const makeSessionKey = (projectId: string, projectPath?: string) => {
  const normalized = normalizeWorktreePath(projectPath)
  return normalized ? `${projectId}::${normalized}` : projectId
}

const rebuildAggregatedSessions = (state: SessionsState, projectId: string) => {
  const prefix = `${projectId}::`
  const aggregated: Session[] = []
  for (const [key, value] of state.sessions.entries()) {
    if (key.startsWith(prefix)) {
      aggregated.push(...value)
    }
  }
  if (aggregated.length > 0) {
    state.sessions.set(projectId, aggregated)
  } else {
    state.sessions.set(projectId, [])
  }
}

export const sessionKeyForProjectPath = makeSessionKey

export const useSessionsStore = create<SessionsState>()(
  immer((set, get) => ({
    // Initial state
    sessions: new Map(),
    currentSession: null,
    listLoading: false,
    createLoading: false,
    error: null,

    // Load sessions for a project
    loadSessions: async (projectId: string, projectPath: string) => {
      set((state) => {
        state.listLoading = true
        state.error = null
      })

      try {
        const sdk = await getSDKService()
        const client = await sdk.getClient(projectId, projectPath)
        const response = await client.session.list({ query: { directory: projectPath } })
        const sessions = response.data || []
        const key = makeSessionKey(projectId, projectPath)

        set((state) => {
          state.sessions.set(key, sessions)
          state.listLoading = false
          if (key !== projectId) {
            rebuildAggregatedSessions(state as unknown as SessionsState, projectId)
          }
        })
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to load sessions"
          state.listLoading = false
        })
      }
    },

    // Create a new session
    createSession: async (projectId: string, projectPath: string, title?: string) => {
      set((state) => {
        state.createLoading = true
        state.error = null
      })

      try {
        const sdk = await getSDKService()
        const client = await sdk.getClient(projectId, projectPath)
        const response = await client.session.create({
          body: { title },
          query: { directory: projectPath },
        })
        const session = response.data

        if (!session) {
          const errorMessage = "No session returned from server"
          set((state) => {
            state.error = errorMessage
            state.createLoading = false
          })
          throw new Error(errorMessage)
        }

        if (!session.id) {
          const errorMessage = "Session created but has no ID"
          set((state) => {
            state.error = errorMessage
            state.createLoading = false
          })
          throw new Error(errorMessage)
        }

        const key = makeSessionKey(projectId, projectPath)
        set((state) => {
          const projectSessions = state.sessions.get(key) || []
          state.sessions.set(key, [...projectSessions, session])
          state.currentSession = session
          state.createLoading = false
          if (key !== projectId) {
            rebuildAggregatedSessions(state as unknown as SessionsState, projectId)
          }
        })

        return session
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create session"
        set((state) => {
          state.error = errorMessage
          state.createLoading = false
        })
        throw new Error(errorMessage)
      }
    },

    // Select a session as current
    selectSession: (session: Session) => {
      set((state) => {
        state.currentSession = session
      })
    },

    // Update a session
    updateSession: async (
      projectId: string,
      projectPath: string,
      sessionId: string,
      updates: Partial<Session>
    ) => {
      // Determine if this session exists locally to decide whether to call API
      const prevState = get()
      const key = makeSessionKey(projectId, projectPath)
      const existsInList = !!prevState.sessions.get(key)?.some((s) => s.id === sessionId)
      const isCurrent = prevState.currentSession?.id === sessionId
      const shouldCallApi = existsInList || isCurrent

      // Optimistic update (only if we have a local reference)
      if (shouldCallApi) {
        set((state) => {
          if (state.currentSession?.id === sessionId) {
            Object.assign(state.currentSession, updates)
          }

          const sessions = state.sessions.get(key)
          if (sessions) {
            const index = sessions.findIndex((s) => s.id === sessionId)
            if (index !== -1) {
              Object.assign(sessions[index], updates)
            }
          }
          if (key !== projectId) {
            rebuildAggregatedSessions(state as unknown as SessionsState, projectId)
          }
        })
      }

      // If we don't have the session locally, do not perform a remote update
      if (!shouldCallApi) return

      try {
        const sdk = await getSDKService()
        const client = await sdk.getClient(projectId, projectPath)
        // Note: OpenCode API might not support all field updates
        await client.session.update({
          path: { id: sessionId },
          body: { title: updates.title },
          query: { directory: projectPath },
        })
      } catch (error) {
        // Revert on error
        await get().loadSessions(projectId, projectPath)
        throw error
      }
    },

    // Delete a session
    deleteSession: async (projectId: string, projectPath: string, sessionId: string) => {
      // Optimistic update
      set((state) => {
        const key = makeSessionKey(projectId, projectPath)
        const sessions = state.sessions.get(key)
        if (sessions) {
          state.sessions.set(
            key,
            sessions.filter((s) => s.id !== sessionId)
          )
        }

        if (state.currentSession?.id === sessionId) {
          state.currentSession = null
        }
        if (key !== projectId) {
          rebuildAggregatedSessions(state as unknown as SessionsState, projectId)
        }
      })

      try {
        const sdk = await getSDKService()
        const client = await sdk.getClient(projectId, projectPath)
        await client.session.delete({ path: { id: sessionId }, query: { directory: projectPath } })
      } catch (error) {
        // Revert on error
        await get().loadSessions(projectId, projectPath)
        throw error
      }
    },

    // Clear sessions for a project
    clearSessions: (projectId: string) => {
      set((state) => {
        const keys = Array.from(state.sessions.keys()).filter(
          (key) => key === projectId || key.startsWith(`${projectId}::`)
        )
        keys.forEach((key) => state.sessions.delete(key))
        if (state.currentSession?.projectID === projectId) {
          state.currentSession = null
        }
      })
    },

    // Clear error
    clearError: () => {
      set((state) => {
        state.error = null
      })
    },
  }))
)

// Stable empty array reference to avoid infinite loops
const EMPTY_SESSIONS: Session[] = []

// Selector hooks
export const useSessionsForProject = (projectId: string, projectPath?: string) =>
  useSessionsStore(
    (state) => state.sessions.get(makeSessionKey(projectId, projectPath)) || EMPTY_SESSIONS
  )

export const useCurrentSession = () => useSessionsStore((state) => state.currentSession)

// Backwards compatible: any loading
export const useSessionsLoading = () =>
  useSessionsStore((state) => state.listLoading || state.createLoading)

export const useSessionsListLoading = () => useSessionsStore((state) => state.listLoading)

export const useSessionsCreateLoading = () => useSessionsStore((state) => state.createLoading)

export const useSessionsError = () => useSessionsStore((state) => state.error)

// Utility selectors - simplified to avoid infinite loops
export const useRecentSessions = (
  projectId: string,
  limit = 10,
  projectPath?: string
): Session[] => {
  const sessions = useSessionsForProject(projectId, projectPath)

  // Return stable empty array if no sessions
  if (!sessions || sessions.length === 0) return EMPTY_SESSIONS

  // Filter out invalid sessions and sort by updated time
  return [...sessions]
    .filter((s) => s && s.time && typeof s.time.updated === "number")
    .sort((a, b) => b.time.updated - a.time.updated)
    .slice(0, limit)
}

export const useSessionById = (projectId: string, sessionId: string, projectPath?: string) =>
  useSessionsStore((state) => {
    const sessions = state.sessions.get(makeSessionKey(projectId, projectPath)) || EMPTY_SESSIONS
    return sessions.find((s) => s.id === sessionId)
  })

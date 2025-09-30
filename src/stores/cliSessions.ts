import { create } from "zustand"
import { immer } from "zustand/middleware/immer"

export type CliToolId = "codex" | "claude" | "opencode"

export interface CliTool {
  id: CliToolId
  name: string
  command: string
  description: string
  defaultArgs: string[]
}

export interface CliSession {
  id: string
  title: string
  projectId: string
  worktreeId: string
  cwd: string
  tool: CliToolId
  status: "starting" | "running" | "exited" | "error"
  createdAt: string
  updatedAt: string
  wsToken?: string
}

export interface CreateCliSessionParams {
  projectId: string
  worktreeId: string
  tool: string
  title?: string
  commandArgs?: string[]
}

interface CliSessionsState {
  sessions: CliSession[]
  tools: CliTool[]
  loading: boolean
  error: string | null
  activeSessionId: string | null
  loadSessions: () => Promise<void>
  loadTools: () => Promise<void>
  createSession: (params: CreateCliSessionParams) => Promise<CliSession | null>
  closeSession: (id: string) => Promise<void>
  setActiveSession: (id: string | null) => void
  updateSessionStatus: (id: string, status: CliSession["status"]) => void
}

const parseError = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unexpected error"
}

export const useCliSessionsStore = create<CliSessionsState>()(
  immer((set) => ({
    sessions: [],
    tools: [],
    loading: false,
    error: null,
    activeSessionId: null,

    loadSessions: async () => {
      set((state) => {
        state.loading = true
        state.error = null
      })
      try {
        const response = await fetch("/api/cli/sessions")
        if (!response.ok) {
          throw new Error(`Failed to load sessions (${response.status})`)
        }
        const data = (await response.json()) as { sessions: CliSession[] }
        set((state) => {
          state.sessions = data.sessions ?? []
          state.loading = false
          if (state.activeSessionId) {
            const exists = state.sessions.some((session) => session.id === state.activeSessionId)
            if (!exists) {
              state.activeSessionId = null
            }
          }
        })
      } catch (error) {
        set((state) => {
          state.loading = false
          state.error = parseError(error)
        })
      }
    },

    loadTools: async () => {
      try {
        const response = await fetch("/api/cli/tools")
        if (!response.ok) {
          throw new Error(`Failed to load CLI tools (${response.status})`)
        }
        const data = (await response.json()) as { tools: CliTool[] }
        set((state) => {
          state.tools = data.tools ?? []
        })
      } catch (error) {
        set((state) => {
          state.error = parseError(error)
        })
      }
    },

    createSession: async (params: CreateCliSessionParams) => {
      try {
        const response = await fetch("/api/cli/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        })
        if (!response.ok) {
          const text = await response.text().catch(() => "")
          throw new Error(text || "Failed to create session")
        }
        const data = (await response.json()) as { session: CliSession; wsToken: string }
        const sessionWithToken = { ...data.session, wsToken: data.wsToken }
        set((state) => {
          state.sessions.unshift(sessionWithToken)
          state.activeSessionId = sessionWithToken.id
          state.error = null
        })
        return sessionWithToken
      } catch (error) {
        set((state) => {
          state.error = parseError(error)
        })
        return null
      }
    },

    closeSession: async (id: string) => {
      try {
        const response = await fetch(`/api/cli/sessions/${encodeURIComponent(id)}`, {
          method: "DELETE",
        })
        if (!response.ok) {
          const text = await response.text().catch(() => "")
          throw new Error(text || "Failed to close session")
        }
        set((state) => {
          state.sessions = state.sessions.filter((session) => session.id !== id)
          if (state.activeSessionId === id) {
            state.activeSessionId = null
          }
        })
      } catch (error) {
        set((state) => {
          state.error = parseError(error)
        })
      }
    },

    setActiveSession: (id) => {
      set((state) => {
        state.activeSessionId = id
      })
    },

    updateSessionStatus: (id, status) => {
      set((state) => {
        const session = state.sessions.find((item) => item.id === id)
        if (session) {
          session.status = status
          session.updatedAt = new Date().toISOString()
        }
      })
    },
  }))
)

import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { enableMapSet } from "immer"
import type { CreateWorktreeParams, Worktree } from "@/lib/api/project-manager"
import { projectManager } from "@/lib/api/project-manager"

enableMapSet()

// Stable empty array to avoid re-renders
const EMPTY_WORKTREES: Worktree[] = []

interface WorktreeState {
  worktreesByProject: Map<string, Worktree[]>
  loadingByProject: Map<string, boolean>
  errorByProject: Map<string, string | null>
  loadWorktrees: (projectId: string) => Promise<void>
  createWorktree: (projectId: string, params: CreateWorktreeParams) => Promise<Worktree>
  updateWorktreeTitle: (projectId: string, worktreeId: string, title: string) => Promise<Worktree>
  removeWorktree: (projectId: string, worktreeId: string, force?: boolean) => Promise<void>
  clearError: (projectId: string) => void
}

const ensureProjectInitialized = (state: WorktreeState, projectId: string) => {
  if (!state.worktreesByProject.has(projectId)) {
    state.worktreesByProject.set(projectId, [])
  }
  if (!state.loadingByProject.has(projectId)) {
    state.loadingByProject.set(projectId, false)
  }
  if (!state.errorByProject.has(projectId)) {
    state.errorByProject.set(projectId, null)
  }
}

export const useWorktreesStore = create<WorktreeState>()(
  immer((set) => ({
    worktreesByProject: new Map(),
    loadingByProject: new Map(),
    errorByProject: new Map(),

    loadWorktrees: async (projectId: string) => {
      set((state) => {
        ensureProjectInitialized(state, projectId)
        state.loadingByProject.set(projectId, true)
        state.errorByProject.set(projectId, null)
      })

      try {
        const data = await projectManager.getWorktrees(projectId)
        set((state) => {
          ensureProjectInitialized(state, projectId)
          state.worktreesByProject.set(projectId, data)
          state.loadingByProject.set(projectId, false)
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load worktrees"
        set((state) => {
          ensureProjectInitialized(state, projectId)
          state.errorByProject.set(projectId, message)
          state.loadingByProject.set(projectId, false)
        })
      }
    },

    createWorktree: async (projectId: string, params: CreateWorktreeParams) => {
      set((state) => {
        ensureProjectInitialized(state, projectId)
        state.loadingByProject.set(projectId, true)
        state.errorByProject.set(projectId, null)
      })

      try {
        const worktree = await projectManager.createWorktree(projectId, params)
        set((state) => {
          ensureProjectInitialized(state, projectId)
          const existing = state.worktreesByProject.get(projectId) || []
          state.worktreesByProject.set(projectId, [...existing, worktree])
          state.loadingByProject.set(projectId, false)
        })
        return worktree
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create worktree"
        set((state) => {
          ensureProjectInitialized(state, projectId)
          state.errorByProject.set(projectId, message)
          state.loadingByProject.set(projectId, false)
        })
        throw error
      }
    },

    updateWorktreeTitle: async (projectId: string, worktreeId: string, title: string) => {
      set((state) => {
        ensureProjectInitialized(state, projectId)
        state.loadingByProject.set(projectId, true)
      })

      try {
        const updated = await projectManager.updateWorktree(projectId, worktreeId, { title })
        set((state) => {
          ensureProjectInitialized(state, projectId)
          const current = state.worktreesByProject.get(projectId) || []
          state.worktreesByProject.set(
            projectId,
            current.map((worktree) => (worktree.id === updated.id ? updated : worktree))
          )
          state.loadingByProject.set(projectId, false)
        })
        return updated
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update worktree"
        set((state) => {
          ensureProjectInitialized(state, projectId)
          state.errorByProject.set(projectId, message)
          state.loadingByProject.set(projectId, false)
        })
        throw error
      }
    },

    removeWorktree: async (projectId: string, worktreeId: string, force?: boolean) => {
      set((state) => {
        ensureProjectInitialized(state, projectId)
        state.loadingByProject.set(projectId, true)
      })

      try {
        await projectManager.removeWorktree(projectId, worktreeId, { force })
        set((state) => {
          ensureProjectInitialized(state, projectId)
          const current = state.worktreesByProject.get(projectId) || []
          state.worktreesByProject.set(
            projectId,
            current.filter((worktree) => worktree.id !== worktreeId)
          )
          state.loadingByProject.set(projectId, false)
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to remove worktree"
        set((state) => {
          ensureProjectInitialized(state, projectId)
          state.errorByProject.set(projectId, message)
          state.loadingByProject.set(projectId, false)
        })
        throw error
      }
    },

    clearError: (projectId: string) => {
      set((state) => {
        ensureProjectInitialized(state, projectId)
        state.errorByProject.set(projectId, null)
      })
    },
  }))
)

export const useWorktreesForProject = (projectId: string) =>
  useWorktreesStore((state) => {
    const worktrees = state.worktreesByProject.get(projectId)
    return worktrees || EMPTY_WORKTREES
  })

export const useWorktreeById = (projectId: string, worktreeId: string | undefined) =>
  useWorktreesStore((state) =>
    (state.worktreesByProject.get(projectId) || []).find((worktree) => worktree.id === worktreeId)
  )

export const useWorktreesLoading = (projectId: string) =>
  useWorktreesStore((state) => state.loadingByProject.get(projectId) || false)

export const useWorktreesError = (projectId: string) =>
  useWorktreesStore((state) => state.errorByProject.get(projectId) || null)

export const getWorktreeById = (projectId: string, worktreeId: string | undefined) => {
  const state = useWorktreesStore.getState()
  const list = state.worktreesByProject.get(projectId) || EMPTY_WORKTREES
  if (!worktreeId || worktreeId === "default") {
    return list.find((worktree) => worktree.id === "default") || null
  }
  return list.find((worktree) => worktree.id === worktreeId) || null
}

export const getWorktreePath = (projectId: string, worktreeId: string | undefined) => {
  const worktree = getWorktreeById(projectId, worktreeId)
  return worktree?.path || null
}

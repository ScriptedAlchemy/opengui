import { create } from "zustand"
import { persist } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import type { Project, CreateProjectParams, UpdateProjectParams, ProjectManagerClient } from "@/lib/api/project-manager"
// Note: Do not import ProjectManagerClient as a runtime value here.
// We use dynamic import inside actions to allow tests to mock the module
// before the first load and to avoid eager module caching between test files.

// Lazily load and cache the ProjectManagerClient after tests have a chance to mock it
let __pmc: ProjectManagerClient | null = null
const getProjectClient = async (): Promise<ProjectManagerClient> => {
  if (__pmc) return __pmc
  const mod = await import("../lib/api/project-manager")
  __pmc = new mod.ProjectManagerClient()
  return __pmc
}

interface ProjectsState {
  projects: Project[]
  currentProject: Project | null
  loading: boolean
  error: string | null
}

interface ProjectsActions {
  // Core project operations
  loadProjects: () => Promise<void>
  selectProject: (id: string) => Promise<Project | undefined>
  createProject: (params: CreateProjectParams) => Promise<Project | null>
  updateProject: (id: string, params: UpdateProjectParams) => Promise<void>
  removeProject: (id: string) => Promise<void>
  // Utility actions
  clearError: () => void
  setCurrentProject: (project: Project | null) => void
}

type ProjectsStore = ProjectsState & ProjectsActions

const detachImmerProxy = <T>(value: T): T => {
  if (value && typeof value === "object") {
    const candidate = value as { self?: unknown } & Record<string, unknown>
    if (candidate.self === value) {
      const { self: _self, ...rest } = candidate
      return rest as T
    }
  }
  return value
}

// Migrate legacy localStorage key once on module import (browser only)
(() => {
  if (typeof window !== "undefined") {
    try {
      const legacyKey = "opencode-projects"
      const nextKey = "agent-orange-projects"
      if (!window.localStorage.getItem(nextKey)) {
        const legacy = window.localStorage.getItem(legacyKey)
        if (legacy) {
          window.localStorage.setItem(nextKey, legacy)
        }
      }
    } catch {
      // ignore storage errors
    }
  }
})()

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      projects: [],
      currentProject: null,
      loading: false,
      error: null,

      // Load all projects from API
      loadProjects: async () => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const client = await getProjectClient()
          const projects = await client.getProjects()
          set((state) => {
            state.projects = projects
            state.loading = false

            // Sync currentProject with server list; clear if missing
            if (state.currentProject) {
              const updatedCurrent = projects.find(
                (p: Project) => p.id === state.currentProject?.id
              )
              state.currentProject = updatedCurrent || null
            }
            // Optionally set a default current project when none is selected
            if (!state.currentProject && projects.length > 0) {
              state.currentProject = projects[0]
            }
          })
        } catch (error) {
          set((state) => {
            state.loading = false
            state.error = error instanceof Error ? error.message : "Failed to load projects"
          })
        }
      },

      // Select and load a specific project
      selectProject: async (id: string) => {
        let { projects } = get()

        // If projects haven't been loaded yet, load them first
        if (projects.length === 0) {
          await get().loadProjects()
          projects = get().projects
        }

        const project = projects.find((p: Project) => p.id === id)

        if (!project) {
          // Fallback: choose the first available project
          const fallback = projects[0]
          set((state) => {
            state.error = "Project not found"
            state.currentProject = fallback || null
          })
          return fallback
        }

        // Optimistic update
        set((state) => {
          state.currentProject = project
          state.error = null
        })

        try {
          // Fetch latest project data and update lastOpened
          const client = await getProjectClient()
          const updatedProject = await client.getProject(id)

          set((state) => {
            state.currentProject = updatedProject
            // Update in projects list too
            const index = state.projects.findIndex((p: Project) => p.id === id)
            if (index !== -1) {
              state.projects[index] = updatedProject
            }
          })

          // Return the updated project so callers can use it
          return updatedProject
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : "Failed to select project"
          })
          // Still return the optimistic project if API fails
          return project
        }
      },

      // Create a new project
      createProject: async (params: CreateProjectParams) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const client = await getProjectClient()
          const newProject = await client.createProject(params)

          set((state) => {
            state.projects.push(newProject)
            state.loading = false
          })

          return newProject
        } catch (error) {
          set((state) => {
            state.loading = false
            state.error = error instanceof Error ? error.message : "Failed to create project"
          })
          return null
        }
      },

      // Update an existing project
      updateProject: async (id: string, params: UpdateProjectParams) => {
        // Optimistic update
        set((state) => {
          const index = state.projects.findIndex((p: Project) => p.id === id)
          if (index !== -1) {
            state.projects[index] = { ...state.projects[index], ...params }
          }
          if (state.currentProject?.id === id) {
            state.currentProject = { ...state.currentProject, ...params }
          }
          state.error = null
        })

        try {
          const client = await getProjectClient()
          const updatedProject = await client.updateProject(id, params)

          set((state) => {
            const index = state.projects.findIndex((p: Project) => p.id === id)
            if (index !== -1) {
              state.projects[index] = updatedProject
            }
            if (state.currentProject?.id === id) {
              state.currentProject = updatedProject
            }
          })
        } catch (error) {
          // Revert optimistic update on error
          await get().loadProjects()
          set((state) => {
            state.error = error instanceof Error ? error.message : "Failed to update project"
          })
        }
      },

      // Remove a project
      removeProject: async (id: string) => {
        // Optimistic update
        set((state) => {
          state.projects = state.projects.filter((p: Project) => p.id !== id)
          if (state.currentProject?.id === id) {
            state.currentProject = null
          }
          state.error = null
        })

        try {
          const client = await getProjectClient()
          await client.removeProject(id)
        } catch (error) {
          // Revert optimistic update on error
          await get().loadProjects()
          set((state) => {
            state.error = error instanceof Error ? error.message : "Failed to remove project"
          })
        }
      },

      // Utility actions
      clearError: () => {
        set((state) => {
          state.error = null
        })
      },

      setCurrentProject: (project: Project | null) => {
        set((state) => {
          state.currentProject = project
        })
      },
    })),
    {
      name: "agent-orange-projects",
      version: 2,
      partialize: (state: ProjectsStore) => {
        const safeProjects = state.projects.map((project) => detachImmerProxy(project))
        const safeCurrent = state.currentProject ? detachImmerProxy(state.currentProject) : null
        return {
          projects: safeProjects,
          currentProject: safeCurrent,
        }
      },
    }
  )
)

// Selector hooks for better performance
export const useProjects = () => useProjectsStore((state) => state.projects)
export const useCurrentProject = () => useProjectsStore((state) => state.currentProject)
export const useProjectsLoading = () => useProjectsStore((state) => state.loading)
export const useProjectsError = () => useProjectsStore((state) => state.error)
// Action hooks - return individual functions with stable references
export const useProjectsActions = () => {
  const loadProjects = useProjectsStore((state) => state.loadProjects)
  const selectProject = useProjectsStore((state) => state.selectProject)
  const createProject = useProjectsStore((state) => state.createProject)
  const updateProject = useProjectsStore((state) => state.updateProject)
  const removeProject = useProjectsStore((state) => state.removeProject)
  const clearError = useProjectsStore((state) => state.clearError)
  const setCurrentProject = useProjectsStore((state) => state.setCurrentProject)

  return {
    loadProjects,
    selectProject,
    createProject,
    updateProject,
    removeProject,
    clearError,
    setCurrentProject,
  }
}

// Computed selectors
export const useProjectById = (id: string) =>
  useProjectsStore((state) => state.projects.find((p: Project) => p.id === id))

export const useRecentProjects = (limit = 5) =>
  useProjectsStore((state) =>
    state.projects
      .filter((p: Project) => p.lastOpened)
      .sort((a: Project, b: Project) => {
        const dateA = new Date(a.lastOpened!).getTime()
        const dateB = new Date(b.lastOpened!).getTime()
        return dateB - dateA
      })
      .slice(0, limit)
  )

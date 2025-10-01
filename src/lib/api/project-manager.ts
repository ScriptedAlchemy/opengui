/**
 * Project Manager Client
 * Handles multi-project management in Operator Hub
 */

export interface Project {
  id: string
  name: string
  path: string
  type?: "git" | "local"
  addedAt?: string
  lastOpened?: string | null
  status?: "running" | "stopped"
  worktrees?: Worktree[]
}

export interface CreateProjectParams {
  path: string
  name?: string
}

export interface UpdateProjectParams {
  name?: string
}

export interface Worktree {
  id: string
  title: string
  path: string
  relativePath: string
  branch?: string
  head?: string
  isPrimary: boolean
  isDetached: boolean
  isLocked: boolean
  lockReason?: string
}

export interface CreateWorktreeParams {
  path: string
  title: string
  branch?: string
  baseRef?: string
  createBranch?: boolean
  force?: boolean
}

export interface GitBranchInfo {
  name: string
  checkedOut: boolean
}

export class ProjectManagerClient {
  constructor(private baseURL = "/api") {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseURL}${path}`

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      })

      if (!response.ok) {
        // Get response body for detailed error logging
        const responseClone = response.clone()
        const responseBody = await responseClone.text().catch(() => "Unable to read response body")
        let errorData: unknown
        try {
          errorData = JSON.parse(responseBody)
        } catch {
          errorData = { message: response.statusText }
        }

        // Log detailed HTTP error information
        console.error("HTTP Error Details:", {
          method: options?.method || "GET",
          url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          requestHeaders: options?.headers,
          requestBody: options?.body,
        })

        const errorMessage = (() => {
          if (
            typeof errorData === "object" &&
            errorData !== null &&
            "message" in errorData &&
            typeof (errorData as { message?: unknown }).message === "string"
          ) {
            return (errorData as { message: string }).message
          }
          if (
            typeof errorData === "object" &&
            errorData !== null &&
            "error" in errorData &&
            typeof (errorData as { error?: unknown }).error === "string"
          ) {
            return (errorData as { error: string }).error
          }
          return `HTTP ${response.status}: ${response.statusText}`
        })()
        throw new Error(`${errorMessage} (${options?.method || "GET"} ${url})`)
      }

      const data = await response.json()
      if ((options?.method || 'GET') === 'POST' && path === '/projects') {
        console.log('[pmc] createProject OK', data)
      }
      return data
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error("Unknown error occurred")
    }
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>("/projects")
  }

  /**
   * Get a specific project
   */
  async getProject(projectId: string): Promise<Project> {
    return this.request<Project>(`/projects/${projectId}`)
  }

  /**
   * Add a new project
   */
  async createProject(params: CreateProjectParams): Promise<Project> {
    return this.request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(params),
    })
  }

  /**
   * Update a project
   */
  async updateProject(projectId: string, params: UpdateProjectParams): Promise<Project> {
    return this.request<Project>(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(params),
    })
  }

  /**
   * Remove a project
   */
  async removeProject(projectId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/projects/${projectId}`, {
      method: "DELETE",
    })
  }

  /**
   * List worktrees for a project
   */
  async getWorktrees(projectId: string): Promise<Worktree[]> {
    return this.request<Worktree[]>(`/projects/${projectId}/worktrees`)
  }

  /**
   * Create a git worktree
   */
  async createWorktree(projectId: string, params: CreateWorktreeParams): Promise<Worktree> {
    return this.request<Worktree>(`/projects/${projectId}/worktrees`, {
      method: "POST",
      body: JSON.stringify(params),
    })
  }

  /**
   * List branches (local + remote-tracking) for a project and whether each is checked out by any worktree
   * Remote branches are reported as e.g. `origin/feature/foo` and are marked `checkedOut`
   * if their local counterpart (e.g. `feature/foo`) is currently checked out in a worktree.
   */
  async getBranches(projectId: string): Promise<GitBranchInfo[]> {
    return this.request<GitBranchInfo[]>(`/projects/${projectId}/git/branches`)
  }

  /**
   * Update worktree metadata
   */
  async updateWorktree(
    projectId: string,
    worktreeId: string,
    updates: { title: string }
  ): Promise<Worktree> {
    return this.request<Worktree>(`/projects/${projectId}/worktrees/${worktreeId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    })
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(projectId: string, worktreeId: string, options?: { force?: boolean }) {
    const query = options?.force ? `?force=${options.force}` : ""
    return this.request<{ success: boolean }>(
      `/projects/${projectId}/worktrees/${worktreeId}${query}`,
      {
        method: "DELETE",
      }
    )
  }
}

// Default instance
export const projectManager = new ProjectManagerClient()

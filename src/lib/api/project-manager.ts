/**
 * Project Manager Client
 * Handles multi-project management in OpenCode Web UI
 */

export interface Project {
  id: string
  name: string
  path: string
  type: "git" | "local"
  addedAt: string
  lastOpened: string | null
  instance?: ProjectInstance
}

export interface ProjectInfo {
  id: string
  name: string
  path: string
  port: number
  status: "stopped" | "starting" | "running" | "error"
  lastAccessed: number
  gitRoot?: string
  commitHash?: string
}

export interface ProjectInstance {
  id: string
  port: number
  status: "starting" | "running" | "stopped" | "error"
  startedAt: Date
}

export interface CreateProjectParams {
  path: string
  name?: string
}

export interface UpdateProjectParams {
  name?: string
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
        let responseBody: string
        let errorData: any
        
        try {
          responseBody = await response.text()
          errorData = JSON.parse(responseBody)
        } catch {
          responseBody = await response.text().catch(() => 'Unable to read response body')
          errorData = { message: response.statusText }
        }

        // Log detailed HTTP error information
        console.error('HTTP Error Details:', {
          method: options?.method || 'GET',
          url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          requestHeaders: options?.headers,
          requestBody: options?.body
        })

        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(`${errorMessage} (${options?.method || 'GET'} ${url})`)
      }

      return response.json()
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
   * Start a project instance
   */
  async startInstance(projectId: string): Promise<ProjectInstance> {
    const projectInfo = await this.request<ProjectInfo>(`/projects/${projectId}/start`, {
      method: "POST",
    })

    // Convert ProjectInfo to ProjectInstance for consistency
    return {
      id: projectInfo.id,
      port: projectInfo.port,
      status: projectInfo.status,
      startedAt: new Date(),
    }
  }

  /**
   * Stop a project instance
   */
  async stopInstance(projectId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/projects/${projectId}/stop`, {
      method: "POST",
    })
  }

  /**
   * Get project instance status
   */
  async getInstanceStatus(projectId: string): Promise<ProjectInstance | null> {
    try {
      return await this.request<ProjectInstance>(`/projects/${projectId}/status`)
    } catch {
      return null
    }
  }

  /**
   * Check if project is running
   */
  async isProjectRunning(projectId: string): Promise<boolean> {
    const status = await this.getInstanceStatus(projectId)
    return status?.status === "running"
  }

  /**
   * Import a git repository as a project
   */
  async importGitRepo(repoUrl: string, targetPath?: string): Promise<Project> {
    return this.request<Project>("/projects/import", {
      method: "POST",
      body: JSON.stringify({ repoUrl, targetPath }),
    })
  }

  /**
   * Scan a directory for potential projects
   */
  async scanDirectory(path: string): Promise<string[]> {
    return this.request<string[]>("/projects/scan", {
      method: "POST",
      body: JSON.stringify({ path }),
    })
  }

  /**
   * Get recent projects (sorted by lastOpened)
   */
  async getRecentProjects(limit = 10): Promise<Project[]> {
    const projects = await this.getProjects()
    return projects
      .filter((p) => p.lastOpened)
      .sort((a, b) => {
        const dateA = new Date(a.lastOpened!).getTime()
        const dateB = new Date(b.lastOpened!).getTime()
        return dateB - dateA
      })
      .slice(0, limit)
  }

  /**
   * Search projects by name or path
   */
  async searchProjects(query: string): Promise<Project[]> {
    const projects = await this.getProjects()
    const lowerQuery = query.toLowerCase()

    return projects.filter(
      (p) => p.name.toLowerCase().includes(lowerQuery) || p.path.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Start all recent projects
   */
  async startRecentProjects(limit = 3): Promise<void> {
    const recent = await this.getRecentProjects(limit)
    await Promise.all(recent.map((p) => this.startInstance(p.id).catch(() => null)))
  }

  /**
   * Stop all running instances
   */
  async stopAllInstances(): Promise<void> {
    const projects = await this.getProjects()
    await Promise.all(
      projects
        .filter((p) => p.instance?.status === "running")
        .map((p) => this.stopInstance(p.id).catch(() => null))
    )
  }

  /**
   * Health check for a project instance
   */
  async healthCheck(projectId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/projects/${projectId}/status`)
      if (!response.ok) {
        // Enhanced error logging for HTTP failures
        const responseText = await response.text().catch(() => 'Unable to read response body')
        const responseHeaders = Object.fromEntries(response.headers.entries())
        console.error('Health check failed:', {
          method: 'GET',
          url: `/api/projects/${projectId}/status`,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseText
        })
        return false
      }
      const data = await response.json()
      return data.status === "running"
    } catch (error) {
      console.error('Health check error:', error)
      return false
    }
  }
}

// Default instance
export const projectManager = new ProjectManagerClient()

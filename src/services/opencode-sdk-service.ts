/**
 * OpenCode SDK Service
 *
 * Manages OpenCode SDK client connections for each project.
 * The SDK clients connect to the OpenCode backend via the app server proxy
 * using a relative base path (e.g., "/opencode") to avoid CORS issues.
 */

import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/client"

import { createLogger } from "../util/logger"

const logger = createLogger("OpencodeSDKService")

export interface ProjectInstance {
  id: string
  path: string
  client: OpencodeClient
}

export class OpencodeSDKService {
  private instances = new Map<string, ProjectInstance>()
  private backendUrl: string | null = null
  private backendUrlPromise: Promise<string> | null = null

  /**
   * Get the backend URL (proxied) from the server
   */
  private async getBackendUrl(): Promise<string> {
    // Return cached URL if available
    if (this.backendUrl !== null) {
      return this.backendUrl
    }

    // If there's an ongoing request, wait for it
    if (this.backendUrlPromise !== null) {
      return this.backendUrlPromise
    }

    // Create a new promise and store it
    this.backendUrlPromise = this.fetchBackendUrl()
    
    try {
      const url = await this.backendUrlPromise
      this.backendUrl = url
      return url
    } catch (error) {
      // Clear the promise on error so it can be retried
      this.backendUrlPromise = null
      throw error
    }
  }

  /**
   * Actually fetch the backend URL from the server
   */
  private async fetchBackendUrl(): Promise<string> {
    try {
      // Fetch backend URL (the server returns a proxied path like "/opencode")
      const response = await fetch('/api/backend-url')
      if (!response.ok) {
        throw new Error(`Failed to fetch backend URL: ${response.statusText}`)
      }
      
      const data = await response.json()
      if (!data.url || typeof data.url !== 'string') {
        throw new Error('Invalid backend URL received from server')
      }
      logger.info("Fetched OpenCode backend URL", {
        sensitive: { baseUrl: data.url },
      })
      return data.url
    } catch (error) {
      logger.error("Failed to fetch backend URL", { error })
      throw new Error('Unable to connect to OpenCode backend. Please ensure the server is running.')
    }
  }

  /**
   * Get or create an SDK client for a project
   * The client connects to the OpenCode backend via the app server proxy
   */
  async getClient(projectId: string, projectPath: string): Promise<OpencodeClient> {
    // Check if instance exists
    const existing = this.instances.get(projectId)
    if (existing) {
      return existing.client
    }

    // Create new instance
    const instance = await this.createInstance(projectId, projectPath)
    return instance.client
  }

  /**
   * Create a new OpenCode client for a project
   * The client connects to the OpenCode backend via the app server proxy
   */
  private async createInstance(projectId: string, projectPath: string): Promise<ProjectInstance> {
    try {
      // Get the backend URL
      const baseUrl = await this.getBackendUrl()
      
      // Create SDK client with the proxied base URL
      const client = createOpencodeClient({ baseUrl })

      // Store instance
      const instance: ProjectInstance = {
        id: projectId,
        path: projectPath,
        client,
      }

      this.instances.set(projectId, instance)
      logger.info("Created OpenCode client for project", {
        context: { projectPath },
        sensitive: { projectId, baseUrl },
      })
      return instance
    } catch (error) {
      logger.error("Failed to create OpenCode client for project", {
        context: { projectPath },
        sensitive: { projectId },
        error,
      })
      throw error
    }
  }

  /**
   * Get or create an SDK client instance for a project
   */
  async getInstance(projectId: string, projectPath: string): Promise<ProjectInstance> {
    // Return existing instance if available
    const existing = this.instances.get(projectId)
    if (existing) {
      return existing
    }

    try {
      // Get the backend URL
      const baseUrl = await this.getBackendUrl()
      
      // Create SDK client with the proxied base URL
      const client = createOpencodeClient({ baseUrl })

      const instance: ProjectInstance = {
        id: projectId,
        path: projectPath,
        client,
      }

      this.instances.set(projectId, instance)
      logger.info("Created OpenCode client instance for project", {
        context: { projectPath },
        sensitive: { projectId, baseUrl },
      })
      return instance
    } catch (error) {
      logger.error("Failed to create OpenCode client for project", {
        context: { projectPath },
        sensitive: { projectId },
        error,
      })
      throw error
    }
  }

  /**
   * Clear all client instances
   */
  async stopAll(): Promise<void> {
    this.instances.clear()
    this.backendUrl = null
    this.backendUrlPromise = null
  }

  /**
   * Get all active instances
   */
  getActiveInstances(): ProjectInstance[] {
    return Array.from(this.instances.values())
  }

  /**
   * Check if an instance exists
   */
  hasInstance(projectId: string): boolean {
    return this.instances.has(projectId)
  }
}

// Export singleton instance
export const opencodeSDKService = new OpencodeSDKService()

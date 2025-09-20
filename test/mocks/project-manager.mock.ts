/**
 * Mock implementation of ProjectManager for testing
 * This ensures no real projects are created in the database
 */

import { createHash } from "crypto"

// Define types inline to avoid circular dependencies
interface WorktreeMetadata {
  id: string
  path: string
  title: string
}
interface WorktreeMetadata {
  id: string
  path: string
  title: string
}

interface WorktreeMetadata {
  id: string
  path: string
  title: string
}

interface ProjectInfo {
  id: string
  name: string
  path: string
  status: "stopped" | "running"
  lastAccessed: number
  gitRoot?: string
  commitHash?: string
  port?: number
  worktrees?: WorktreeMetadata[]
}

interface ProjectInstance {
  info: ProjectInfo
  sdk?: any
}

// Simple hash function to avoid circular dependencies
function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16)
}

export class MockProjectManager {
  private static instance: MockProjectManager
  private projects = new Map<string, ProjectInstance>()
  private nextPort = 8081
  private mockProcesses = new Map<string, any>()
  private mockSessions = new Map<string, any[]>() // projectId -> sessions[]
  private sessionMessages = new Map<string, number>() // sessionId -> message count
  private sessionMessageContent = new Map<string, any[]>() // sessionId -> actual messages

  static getInstance(): MockProjectManager {
    if (!MockProjectManager.instance) {
      MockProjectManager.instance = new MockProjectManager()
    }
    return MockProjectManager.instance
  }

  static resetInstance(): void {
    if (MockProjectManager.instance) {
      MockProjectManager.instance.projects.clear()
      MockProjectManager.instance.mockProcesses.clear()
      MockProjectManager.instance.mockSessions.clear()
      MockProjectManager.instance.sessionMessages.clear()
      MockProjectManager.instance.sessionMessageContent.clear()
    }
    MockProjectManager.instance = null as any
  }

  async addProject(path: string, name: string): Promise<ProjectInfo> {
    const id = await this.getGitProjectId(path)
    const port = this.nextPort++

    const projectInfo: ProjectInfo = {
      id,
      name,
      path,
      port,
      status: "stopped",
      lastAccessed: Date.now(),
      worktrees: [
        {
          id: "default",
          path,
          title: `${name} (default)`,
        },
      ],
    }

    this.projects.set(id, {
      info: projectInfo,
    })

    return projectInfo
  }

  async getGitProjectId(path: string): Promise<string> {
    // Simple hash for testing
    const hashValue = hash(path)
    return hashValue.substring(0, 16)
  }

  getProject(id: string): ProjectInfo | undefined {
    return this.projects.get(id)?.info
  }

  getAllProjects(): ProjectInfo[] {
    return Array.from(this.projects.values()).map((p) => p.info)
  }

  async removeProject(id: string): Promise<boolean> {
    const instance = this.projects.get(id)
    if (!instance) return false

    // Clean up mock process if exists
    if (this.mockProcesses.has(id)) {
      this.mockProcesses.delete(id)
    }

    // Clean up mock sessions
    this.mockSessions.delete(id)

    this.projects.delete(id)
    return true
  }

  async spawnInstance(id: string): Promise<boolean> {
    const instance = this.projects.get(id)
    if (!instance) return false

    // IMPORTANT: Never spawn real OpenCode instances in tests
    // Just simulate the state change
    instance.info.status = "running"
    instance.info.lastAccessed = Date.now()

    // Create mock process (no real subprocess)
    this.mockProcesses.set(id, {
      pid: Math.floor(Math.random() * 10000),
      kill: () => {},
      stdout: null,
      stderr: null,
    })

    console.log(`[MOCK] Simulated OpenCode instance start for project ${id} (no real process spawned)`)
    return true
  }

  async stopInstance(id: string): Promise<boolean> {
    const instance = this.projects.get(id)
    if (!instance) return false

    instance.info.status = "stopped"

    // Clean up mock process
    if (this.mockProcesses.has(id)) {
      this.mockProcesses.delete(id)
    }

    return true
  }

  getInstanceStatus(id: string): "stopped" | "starting" | "running" | "error" | undefined {
    return this.projects.get(id)?.info.status
  }

  async restartInstance(id: string): Promise<boolean> {
    await this.stopInstance(id)
    return this.spawnInstance(id)
  }

  // Mock save/load methods that do nothing
  async saveProjects(): Promise<void> {
    // No-op - don't save to real file
  }

  async loadProjects(): Promise<void> {
    // No-op - don't load from real file
  }

  async monitorHealth(): Promise<void> {
    // Mock implementation - just check status of all projects
    for (const instance of Array.from(this.projects.values())) {
      // Simulate health monitoring without real network calls
      if (instance.info.status === "running") {
        // Mock health check - always succeed
        instance.info.lastAccessed = Date.now()
      }
    }
  }

  async routeRequest(projectId: string, path: string, request: Request): Promise<Response> {
    const instance = this.projects.get(projectId)
    if (!instance) {
      return new Response("Project not found", { status: 404 })
    }

    // Mock response - don't make real network calls
    if (instance.info.status !== "running") {
      // Auto-start in mock
      await this.spawnInstance(projectId)
    }

    // Handle specific endpoints with mock data
    if (path === "/session/create") {
      const body = await request.json().catch(() => ({}))
      const session = {
        id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        name: body.name || "Test Session",
        metadata: body.metadata || {},
        createdAt: new Date().toISOString(),
      }

      // Store session for later retrieval
      if (!this.mockSessions.has(projectId)) {
        this.mockSessions.set(projectId, [])
      }
      // Add to beginning to simulate most recent first
      this.mockSessions.get(projectId)!.unshift(session)

      return new Response(JSON.stringify(session), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (path === "/session") {
      // Return list of mock sessions for this project with message counts
      const sessions = this.mockSessions.get(projectId) || []
      const sessionsWithCounts = sessions.map((session) => ({
        ...session,
        messageCount: this.sessionMessages.get(session.id) || 0,
      }))
      return new Response(JSON.stringify(sessionsWithCounts), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (path.startsWith("/session/") && path.includes("/messages")) {
      const sessionId = path.split("/")[2]

      // Return actual stored messages if available
      const storedMessages = this.sessionMessageContent.get(sessionId)
      if (storedMessages) {
        return new Response(JSON.stringify(storedMessages), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      // Fallback to generated messages
      const messageCount = this.sessionMessages.get(sessionId) || 2
      const messages = []
      for (let i = 0; i < messageCount / 2; i++) {
        messages.push({
          role: "user",
          content: { text: `Test message ${i + 1}` },
        })
        messages.push({
          role: "assistant",
          content: { text: `Test response ${i + 1}` },
        })
      }

      return new Response(JSON.stringify(messages), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (path.startsWith("/session/") && path.includes("/chat")) {
      // Handle streaming if requested
      const body = await request.json().catch(() => ({}))
      const sessionId = path.split("/")[2]

      // Track messages for this session (each chat adds 2 messages: user + assistant)
      const currentCount = this.sessionMessages.get(sessionId) || 0
      this.sessionMessages.set(sessionId, currentCount + 2)

      // Store actual message content
      if (!this.sessionMessageContent.has(sessionId)) {
        this.sessionMessageContent.set(sessionId, [])
      }
      this.sessionMessageContent
        .get(sessionId)!
        .push(
          { role: "user", content: { text: body.message || "Test message" } },
          { role: "assistant", content: { text: "Test response to: " + (body.message || "Test message") } },
        )

      if (body.stream) {
        // Return streaming response
        return new Response(
          new ReadableStream({
            start(controller) {
              // Send start chunk
              controller.enqueue(
                new TextEncoder().encode('data: {"type":"start","sessionId":"' + path.split("/")[2] + '"}\n\n'),
              )
              // Send content chunk
              controller.enqueue(
                new TextEncoder().encode('data: {"type":"content","content":"Test streaming response"}\n\n'),
              )
              // Send end chunk
              controller.enqueue(new TextEncoder().encode('data: {"type":"end"}\n\n'))
              controller.close()
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
            },
          },
        )
      }
      return new Response(
        JSON.stringify({
          message: {
            role: "user",
            content: {
              text: body.message || "Test message",
            },
          },
          response: {
            role: "assistant",
            content: {
              text: "This is a mock response from the test chat endpoint",
            },
          },
          sessionId: path.split("/")[2],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    if (
      path.startsWith("/session/") &&
      request.method === "GET" &&
      !path.includes("/messages") &&
      !path.includes("/chat")
    ) {
      // Return mock session details
      const sessionId = path.split("/")[2]
      // Find the session in our mock storage
      const sessions = this.mockSessions.get(projectId) || []
      const session = sessions.find((s) => s.id === sessionId)

      if (!session) {
        // Session not found (deleted or never existed)
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      }

      return new Response(
        JSON.stringify({
          ...session,
          messageCount: this.sessionMessages.get(sessionId) || 4,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    if (path.startsWith("/session/") && request.method === "DELETE") {
      // Mock delete response
      const sessionId = path.split("/")[2]
      // Mark session as deleted
      const sessions = this.mockSessions.get(projectId) || []
      const index = sessions.findIndex((s) => s.id === sessionId)
      if (index !== -1) {
        sessions.splice(index, 1)
      }
      // Remove messages too
      this.sessionMessages.delete(sessionId)
      this.sessionMessageContent.delete(sessionId)
      return new Response(null, { status: 204 })
    }

    // Default mock response
    return new Response(JSON.stringify({ mock: true, path, projectId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
}

// Export a singleton instance for import compatibility
export const mockProjectManager = MockProjectManager.getInstance()
interface WorktreeMetadata {
  id: string
  path: string
  title: string
}

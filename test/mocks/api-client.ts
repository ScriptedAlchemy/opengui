import { rstest } from "@rstest/core"

// Mock API responses
export const mockApiResponses = {
  projects: [
    {
      id: "project-1",
      name: "Test Project 1",
      path: "/path/to/project1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "project-2",
      name: "Test Project 2",
      path: "/path/to/project2",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  sessions: [
    {
      id: "session-1",
      title: "Test Session",
      projectId: "project-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  messages: [
    {
      id: "message-1",
      sessionId: "session-1",
      role: "user" as const,
      content: "Hello",
      createdAt: new Date(),
    },
    {
      id: "message-2",
      sessionId: "session-1",
      role: "assistant" as const,
      content: "Hi there!",
      createdAt: new Date(),
    },
  ],
}

// Mock fetch implementation for API calls
export const createMockFetch = () => {
  const fn = rstest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString()
    const method = init?.method || "GET"

    // Backend URL for OpencodeSDKProvider
    if (url.includes("/api/backend-url")) {
      const openCodeUrl = (globalThis as any).__OPENCODE_URL__ || "/opencode"
      return new Response(JSON.stringify({ url: openCodeUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Health check
    if (url.includes("/health")) {
      return new Response("OK", { status: 200 })
    }

    // Projects API
    if (url.includes("/api/projects")) {
      if (method === "GET") {
        return new Response(JSON.stringify(mockApiResponses.projects), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (method === "POST") {
        const newProject = {
          id: `project-${Date.now()}`,
          name: "New Project",
          path: "/path/to/new",
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        return new Response(JSON.stringify(newProject), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    // Sessions API
    if (url.includes("/api/sessions")) {
      if (method === "GET") {
        return new Response(JSON.stringify(mockApiResponses.sessions), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (method === "POST") {
        const newSession = {
          id: `session-${Date.now()}`,
          title: "New Session",
          projectId: "project-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        return new Response(JSON.stringify(newSession), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    // Messages API
    if (url.includes("/api/messages")) {
      return new Response(JSON.stringify(mockApiResponses.messages), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Default success response
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  })
  return fn as unknown as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

// Import the improved EventSource mock
import { MockEventSource } from "./sse"

// Global mock setup
export const setupApiMocks = () => {
  // Mock fetch globally with proper typing
  const mockFetch = createMockFetch()
  Object.assign(mockFetch, { preconnect: () => {} })
  global.fetch = mockFetch as unknown as typeof fetch

  // Mock EventSource globally
  global.EventSource = MockEventSource as any
}

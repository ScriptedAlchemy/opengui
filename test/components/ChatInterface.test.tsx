import { describe, test, expect, beforeEach, afterAll, rstest } from "@rstest/core"
import { render, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import ChatInterfaceV2 from "../../src/pages/ChatInterfaceV2"
import { opencodeSDKService } from "../../src/services/opencode-sdk-service"
// Mock react-router-dom hooks
const mockNavigate = rstest.fn(() => {})
let mockParams: any = { projectId: "test-project", sessionId: "test-session-1" }
rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => ({ pathname: "/projects/test-project/sessions/test-session-1/chat" }),
  }
})
// Mock project store
let mockCurrentProject: any = {
  id: "test-project",
  name: "Test Project",
  path: "/test/path",
  type: "git" as const,
  addedAt: new Date().toISOString(),
  lastOpened: new Date().toISOString(),
}
rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => mockCurrentProject,
}))
type InstanceStatus = "running" | "starting" | "stopped" | "error"
let mockProjectData: { id: string; path: string } | null = {
  id: "test-project",
  path: "/test/path",
}
let mockInstanceStatus: InstanceStatus = "running"
type MockSession = {
  id: string
  title: string
  projectID: string
  directory: string
  version: string
  time: {
    created: number
    updated: number
  }
}
type MockMessage = {
  id: string
  sessionID: string
  role?: "user" | "assistant" | "system"
  time: {
    created: number
  }
  parts?: Array<{
    id: string
    sessionID: string
    messageID: string
    type: "text"
    text: string
  }>
}
const createMockSession = (): MockSession => ({
  id: "test-session-1",
  title: "Test Session",
  projectID: "test-project",
  directory: "/test/path",
  version: "1",
  time: { created: Date.now() / 1000, updated: Date.now() / 1000 },
})
let mockSessions: MockSession[] = [createMockSession()]
let mockCurrentSession: MockSession | null = mockSessions[0] ?? null
let mockMessages: MockMessage[] = []
let mockIsStreaming = false
let mockInputValue = ""
const originalGetClient = opencodeSDKService.getClient
const originalStopAll = opencodeSDKService.stopAll
function createMockSdkClient() {
  return {
    project: {
      current: async () => ({ data: { id: "test-project", path: "/test/path" } }),
      list: async () => ({ data: [mockProjectData].filter(Boolean) }),
    },
    session: {
      list: async () => ({ data: mockSessions }),
      create: async ({ body }: { body: { title?: string } }) => {
        const newSession: MockSession = {
          id: `session-${Date.now()}`,
          title: body.title || "New Session",
          projectID: "test-project",
          directory: "/test/path",
          version: "1",
          time: { created: Date.now() / 1000, updated: Date.now() / 1000 },
        }
        mockSessions.push(newSession)
        mockCurrentSession = newSession
        return { data: newSession }
      },
      update: async ({ path, body }: { path: { id: string }; body: { title?: string } }) => {
        const target = mockSessions.find((s) => s.id === path.id)
        if (target && body.title) {
          target.title = body.title
          target.time.updated = Date.now() / 1000
        }
        return { data: target ?? null }
      },
      delete: async ({ path }: { path: { id: string } }) => {
        mockSessions = mockSessions.filter((s) => s.id !== path.id)
        if (mockCurrentSession?.id === path.id) {
          mockCurrentSession = mockSessions[0] ?? null
        }
        return { data: true }
      },
      messages: async () => ({ data: mockMessages }),
    },
    config: {
      get: async () => ({ data: {} }),
      providers: async () => ({
        data: {
          providers: [
            {
              id: "anthropic",
              name: "Anthropic",
              models: {
                "claude-sonnet-4-20250514": { name: "Claude Sonnet 4" },
                "claude-3-5-sonnet-20241022": { name: "Claude 3.5 Sonnet v2" },
              },
            },
          ],
          default: { anthropic: "claude-sonnet-4-20250514" },
        },
      }),
    },
  }
}
let mockSdkClient = createMockSdkClient()
function resetChatMocks() {
  mockProjectData = {
    id: "test-project",
    path: "/test/path",
  }
  mockInstanceStatus = "running"
  mockSessions = [createMockSession()]
  mockCurrentSession = mockSessions[0] ?? null
  mockMessages = []
  mockIsStreaming = false
  mockInputValue = ""
  mockSdkClient = createMockSdkClient()
}
// Test wrapper component with routes
function TestWrapper() {
  return (
    <MemoryRouter
      initialEntries={["/projects/test-project/sessions/test-session-1/chat"]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/projects/:projectId/sessions/:sessionId/chat" element={<ChatInterfaceV2 />} />
      </Routes>
    </MemoryRouter>
  )
}
// Mock fetch for backend URL
const originalFetch = global.fetch
describe("ChatInterface Component", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    resetChatMocks()
    mockParams = { projectId: "test-project", sessionId: "test-session-1" }
    mockCurrentProject = {
      id: "test-project",
      name: "Test Project",
      path: "/test/path",
      type: "git" as const,
      addedAt: new Date().toISOString(),
      lastOpened: new Date().toISOString(),
    }
    global.fetch = rstest.fn((input: any, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input?.url ?? ""
      if (typeof url === "string") {
        if (url.includes("/api/backend-url")) {
          return Promise.resolve(
            new Response(JSON.stringify({ url: "/opencode" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          )
        }
        if (url.startsWith("/opencode")) {
          const parsedUrl = new URL(url, "http://localhost")
          const baseResponse = { status: 200, headers: { "Content-Type": "application/json" } }
          if (parsedUrl.pathname === "/opencode/project/current") {
            return Promise.resolve(
              new Response(
                JSON.stringify({ data: { id: "test-project", path: "/test/path" } }),
                baseResponse
              )
            )
          }
          if (parsedUrl.pathname === "/opencode/session") {
            if ((init?.method ?? "GET").toUpperCase() === "POST") {
              return Promise.resolve(
                new Response(
                  JSON.stringify({ data: { id: "test-session-2" } }),
                  { ...baseResponse, status: 201 }
                )
              )
            }
            return Promise.resolve(new Response(JSON.stringify({ data: [] }), baseResponse))
          }
          if (parsedUrl.pathname.endsWith("/message")) {
            return Promise.resolve(new Response(JSON.stringify({ data: [] }), baseResponse))
          }
          if (parsedUrl.pathname === "/opencode/config") {
            return Promise.resolve(new Response(JSON.stringify({ data: {} }), baseResponse))
          }
          return Promise.resolve(new Response(JSON.stringify({ data: {} }), baseResponse))
        }
      }
      return originalFetch(input, init as any)
    }) as any
    ;(opencodeSDKService as any).getClient = rstest.fn(async () => mockSdkClient)
    ;(opencodeSDKService as any).stopAll = rstest.fn(async () => undefined)
  })
  afterAll(() => {
    global.fetch = originalFetch
    opencodeSDKService.getClient = originalGetClient
    opencodeSDKService.stopAll = originalStopAll
  })
  test("renders chat interface with core regions", async () => {
    const { getByTestId } = render(<TestWrapper />)
    await waitFor(() => {
      expect(getByTestId("chat-sidebar")).toBeTruthy()
      expect(getByTestId("chat-header")).toBeTruthy()
      expect(getByTestId("chat-main-area")).toBeTruthy()
      expect(getByTestId("chat-input")).toBeTruthy()
    })
  })
  test("shows fallback badge when project metadata is unavailable", async () => {
    mockCurrentProject = null
    mockProjectData = null
    const { findAllByText } = render(<TestWrapper />)
    const fallbackBadges = await findAllByText("Unknown")
    expect(fallbackBadges.length).toBeGreaterThan(0)
  })
  test("renders with new session route", async () => {
    mockParams = { projectId: "test-project", sessionId: "new" }
    const { getByTestId } = render(<TestWrapper />)
    await waitFor(() => {
      expect(getByTestId("chat-main-area")).toBeTruthy()
    })
  })
  test("displays empty state when no sessions exist", async () => {
    mockSessions = []
    mockCurrentSession = null
    const { findByTestId } = render(<TestWrapper />)
    const emptyState = await findByTestId("empty-sessions")
    expect(emptyState.textContent).toBe("No sessions yet")
  })
  test("renders messages returned by the SDK client", async () => {
    mockSessions = [createMockSession()]
    mockCurrentSession = mockSessions[0]
    mockMessages = [
      {
        id: "msg-1",
        sessionID: mockCurrentSession.id,
        role: "assistant",
        time: { created: Math.floor(Date.now() / 1000) },
        parts: [
          {
            id: "part-1",
            sessionID: mockCurrentSession.id,
            messageID: "msg-1",
            type: "text",
            text: "Hello",
          },
        ],
      },
    ]
    const { findByText } = render(<TestWrapper />)
    const message = await findByText("Hello")
    expect(message).toBeTruthy()
  })
})

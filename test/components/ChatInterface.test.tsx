
import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import { render, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import ChatInterfaceV2 from "../../src/pages/ChatInterfaceV2"

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

// Mock the OpenCode SDK service
rstest.mock("../../src/services/opencode-sdk-service", () => ({
  opencodeSDKService: {
    getClient: rstest.fn(() => Promise.resolve({
      project: {
        current: () => Promise.resolve({ data: { id: "test-project", path: "/test/path" } }),
      },
      session: {
        list: () => Promise.resolve({ data: [] }),
        messages: () => Promise.resolve({ data: [] }),
      },
      config: {
        get: () => Promise.resolve({ data: {} }),
        providers: () => Promise.resolve({ data: { providers: [], default: {} } }),
      },
    })),
    stopAll: rstest.fn(() => Promise.resolve()),
  },
}))

// Mock the SDK context provider to avoid HTTP requests
rstest.mock("../../src/contexts/OpencodeSDKContext", () => {
  const React = require("react")
  return {
    OpencodeSDKProvider: ({ children }: any) => React.createElement(React.Fragment, {}, children),
    useOpencodeSDK: () => ({
      getClient: rstest.fn(() => Promise.resolve(null)),
      currentClient: null,
      isLoading: false,
      error: null,
    }),
    useProjectSDK: () => ({
      client: null,
      isLoading: false,
      error: null,
    }),
  }
})

// Mock all SDK hooks to prevent infinite loops
rstest.mock("../../src/hooks/useProjectSDK", () => ({
  useProjectSDK: () => ({
    project: {
      id: "test-project",
      path: "/test/path",
    },
    instanceStatus: "running",
    client: null,
  }),
}))

rstest.mock("../../src/hooks/useProvidersSDK", () => ({
  useProvidersSDK: () => ({
    providers: [],
    selectedProvider: "anthropic",
    selectedModel: "claude-3",
    setSelectedProvider: rstest.fn(() => {}),
    setSelectedModel: rstest.fn(() => {}),
    availableModels: [],
  }),
}))

const mockSessions = [
  {
    id: "test-session-1",
    title: "Test Session",
    projectID: "test-project",
    directory: "/test/path",
    version: "1",
    time: { created: Date.now() / 1000, updated: Date.now() / 1000 },
  },
]

rstest.mock("../../src/hooks/useSessionsSDK", () => ({
  useSessionsSDK: () => ({
    sessions: mockSessions,
    currentSession: mockSessions[0],
    isLoading: false,
    handleCreateSession: rstest.fn(() => Promise.resolve()),
    handleRenameSession: rstest.fn(() => Promise.resolve()),
    handleDeleteSession: rstest.fn(() => Promise.resolve()),
  }),
}))

rstest.mock("../../src/hooks/useMessagesSDK", () => ({
  useMessagesSDK: () => ({
    messages: [],
    inputValue: "",
    setInputValue: rstest.fn(() => {}),
    isStreaming: false,
    setMessages: rstest.fn(() => {}),
    setIsStreaming: rstest.fn(() => {}),
    handleSendMessage: rstest.fn(() => Promise.resolve()),
    handleStopStreaming: rstest.fn(() => {}),
    loadMessages: rstest.fn(() => Promise.resolve()),
  }),
}))

rstest.mock("../../src/hooks/useSSESDK", () => ({
  useSSESDK: () => {},
}))



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
    mockParams = { projectId: "test-project", sessionId: "test-session-1" }
    mockCurrentProject = {
      id: "test-project",
      name: "Test Project",
      path: "/test/path",
      type: "git" as const,
      addedAt: new Date().toISOString(),
      lastOpened: new Date().toISOString(),
    }
    
    // Mock global fetch as well
    global.fetch = rstest.fn((url: any) => {
      if (typeof url === 'string' && url.includes("/api/backend-url")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "/opencode" }),
        } as Response)
      }
      return originalFetch(url)
    }) as any
  })

  test("renders chat interface with all components", async () => {
    const { getByTestId } = render(<TestWrapper />)

    await waitFor(() => {
      expect(getByTestId("chat-sidebar")).toBeDefined()
      expect(getByTestId("chat-header")).toBeDefined()
      expect(getByTestId("chat-main-area")).toBeDefined()
      expect(getByTestId("chat-input")).toBeDefined()
    })
  })

  test.skip("shows no project message when projectId is missing", async () => {
    // Set projectId to empty string
    mockParams = { projectId: "", sessionId: "test-session-1", worktreeId: "default" }
    mockCurrentProject = null

    const { container } = render(<TestWrapper />)

    await waitFor(() => {
      const noProjectText = container.querySelector(".text-muted-foreground")
      expect(noProjectText).toBeDefined()
      expect(noProjectText?.textContent).toBe("No project selected")
    })
  })

  test("renders with new session", async () => {
    mockParams = { projectId: "test-project", sessionId: "new" }

    const { getByTestId } = render(<TestWrapper />)

    await waitFor(() => {
      expect(getByTestId("chat-main-area")).toBeDefined()
    })
  })

  test.skip("handles different instance statuses", async () => {
    // Skip - can't re-mock modules during test execution with rstest
    const { getByTestId } = render(<TestWrapper />)

    await waitFor(() => {
      expect(getByTestId("chat-messages")).toBeDefined()
    })
  })

  test.skip("handles no session state", async () => {
    // Skip - can't re-mock modules during test execution with rstest
    const { getByText } = render(<TestWrapper />)

    // Should show no session message when currentSession is null
    await waitFor(() => {
      expect(getByText("No session selected")).toBeDefined()
    })
  })

  test.skip("handles streaming state", async () => {
    // Ensure we have a current session for streaming to work
    rstest.mock("../../src/hooks/useSessionsSDK", () => ({
      useSessionsSDK: () => ({
        sessions: mockSessions,
        currentSession: mockSessions[0],
        isLoading: false,
        handleCreateSession: rstest.fn(() => Promise.resolve()),
        handleRenameSession: rstest.fn(() => Promise.resolve()),
        handleDeleteSession: rstest.fn(() => Promise.resolve()),
      }),
    }))

    rstest.mock("../../src/hooks/useMessagesSDK", () => ({
      useMessagesSDK: () => ({
        messages: [
          {
            id: "msg-1",
            sessionID: "test-session-1",
            type: "text",
            content: "Hello",
            time: { created: Date.now() / 1000 },
          },
        ],
        inputValue: "",
        setInputValue: rstest.fn(() => {}),
        isStreaming: true,
        setMessages: rstest.fn(() => {}),
        setIsStreaming: rstest.fn(() => {}),
        handleSendMessage: rstest.fn(() => Promise.resolve()),
        handleStopStreaming: rstest.fn(() => {}),
        loadMessages: rstest.fn(() => Promise.resolve()),
      }),
    }))

    const { getByTestId } = render(<TestWrapper />)

    await waitFor(() => {
      expect(getByTestId("chat-messages")).toBeDefined()
    })
  })
})

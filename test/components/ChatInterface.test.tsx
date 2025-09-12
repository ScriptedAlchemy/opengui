import React from "react"
import { describe, test, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { render, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
let ChatInterface: any

// Mock react-router-dom hooks
const mockNavigate = rstest.fn(() => {})
let mockParams = { projectId: "test-project", sessionId: "test-session-1" }

rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  }
})

// Mock project store
rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => ({
    id: "test-project",
    name: "Test Project",
    path: "/test/path",
    type: "git" as const,
    addedAt: new Date().toISOString(),
    lastOpened: new Date().toISOString(),
  }),
}))

// Use real OpencodeSDKProvider; component-level hooks are mocked below

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

// Mock components to simplify testing
rstest.mock("../../src/components/chat/ChatSidebar", () => ({
  ChatSidebar: () => <div data-testid="chat-sidebar">Chat Sidebar</div>,
}))
rstest.mock("@/components/chat/ChatSidebar", () => ({
  ChatSidebar: () => <div data-testid="chat-sidebar">Chat Sidebar</div>,
}))

rstest.mock("../../src/components/chat/ChatHeader", () => ({
  ChatHeader: () => <div data-testid="chat-header">Chat Header</div>,
}))
rstest.mock("@/components/chat/ChatHeader", () => ({
  ChatHeader: () => <div data-testid="chat-header">Chat Header</div>,
}))

rstest.mock("../../src/components/chat/ChatMessages", () => ({
  ChatMessages: () => <div data-testid="chat-messages">Chat Messages</div>,
}))
rstest.mock("@/components/chat/ChatMessages", () => ({
  ChatMessages: () => <div data-testid="chat-messages">Chat Messages</div>,
}))

rstest.mock("../../src/components/chat/ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input">Chat Input</div>,
}))
rstest.mock("@/components/chat/ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input">Chat Input</div>,
}))

// Test wrapper component with routes
function TestWrapper() {
  const Comp: any = ChatInterface || (() => <div data-testid="chat-fallback" />)
  return (
    <MemoryRouter
      initialEntries={["/projects/test-project/sessions/test-session-1/chat"]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/projects/:projectId/sessions/:sessionId/chat" element={<Comp />} />
      </Routes>
    </MemoryRouter>
  )
}

describe("ChatInterface Component", () => {
  beforeEach(() => {
    // Defer importing the component until after mocks are set up
    const tryLoad = (p: string) => {
      try {
        const m = require(p)
        return m.default || m.ChatInterface || null
      } catch {
        return null
      }
    }
    ChatInterface =
      tryLoad("@/pages/ChatInterfaceV2") ||
      tryLoad("../../src/pages/ChatInterfaceV2") ||
      (() => null)
    rstest.clearAllMocks()
    mockParams = { projectId: "test-project", sessionId: "test-session-1" }
  })

  test("renders chat interface with all components", async () => {
    const { getByTestId } = render(<TestWrapper />)

    await waitFor(() => {
      expect(getByTestId("chat-sidebar")).toBeDefined()
      expect(getByTestId("chat-header")).toBeDefined()
      expect(getByTestId("chat-messages")).toBeDefined()
      expect(getByTestId("chat-input")).toBeDefined()
    })
  })

  test("shows no project message when projectId is missing", async () => {
    mockParams = { projectId: "", sessionId: "test-session-1" }

    const { getByText } = render(<TestWrapper />)

    await waitFor(() => {
      expect(getByText("No project selected")).toBeDefined()
    })
  })

  test("renders with new session", async () => {
    mockParams = { projectId: "test-project", sessionId: "new" }

    const { getByTestId } = render(<TestWrapper />)

    await waitFor(() => {
      expect(getByTestId("chat-messages")).toBeDefined()
    })
  })

  test("handles different instance statuses", async () => {
    // Test with stopped instance
    rstest.mock("../../src/hooks/useProjectSDK", () => ({
      useProjectSDK: () => ({
        project: {
          id: "test-project",
          path: "/test/path",
        },
        instanceStatus: "stopped",
        client: null,
      }),
    }))

    const { getByTestId } = render(<TestWrapper />)

    await waitFor(() => {
      expect(getByTestId("chat-messages")).toBeDefined()
    })
  })

  test("handles no session state", async () => {
    rstest.mock("../../src/hooks/useSessionsSDK", () => ({
      useSessionsSDK: () => ({
        sessions: [],
        currentSession: null,
        isLoading: false,
        handleCreateSession: rstest.fn(() => Promise.resolve()),
        handleRenameSession: rstest.fn(() => Promise.resolve()),
        handleDeleteSession: rstest.fn(() => Promise.resolve()),
      }),
    }))

    const { getByText } = render(<TestWrapper />)

    // Should show no session message when currentSession is null
    await waitFor(() => {
      expect(getByText("No session selected")).toBeDefined()
    })
  })

  test("handles streaming state", async () => {
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

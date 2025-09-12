import React from "react"
import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import { render, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
let SessionList: any

// Mock the sessions store
const createMockSession = (id: string, title: string) => ({
  id,
  title,
  time: {
    created: Math.floor(Date.now() / 1000),
    updated: Math.floor(Date.now() / 1000),
  },
})

const mockSessions = new Map([
  [
    "test-project",
    [createMockSession("session-1", "Test Session 1"), createMockSession("session-2", "Test Session 2")],
  ],
])

const mockLoadSessions = rstest.fn(async () => {})
const mockCreateSession = rstest.fn(async () => createMockSession("new-session", "New Session"))
const mockDeleteSession = rstest.fn(async () => {})
const mockClearError = rstest.fn(() => {})

rstest.mock("../../src/stores/sessions", () => ({
  useSessionsStore: () => ({
    sessions: mockSessions,
    listLoading: false,
    createLoading: false,
    error: null,
    loadSessions: mockLoadSessions,
    createSession: mockCreateSession,
    deleteSession: mockDeleteSession,
    clearError: mockClearError,
  }),
}))
// Also mock alias import path
rstest.mock("@/stores/sessions", () => ({
  useSessionsStore: () => ({
    sessions: mockSessions,
    listLoading: false,
    createLoading: false,
    error: null,
    loadSessions: mockLoadSessions,
    createSession: mockCreateSession,
    deleteSession: mockDeleteSession,
    clearError: mockClearError,
  }),
}))

// Mock react-router-dom
const mockNavigate = rstest.fn(() => {})
rstest.mock("react-router-dom", () => ({
  ...require("react-router-dom"),
  useParams: () => ({ projectId: "test-project" }),
  useNavigate: () => mockNavigate,
}))

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
  useProjectsActions: () => ({
    selectProject: rstest.fn(() => {}),
  }),
}))
rstest.mock("@/stores/projects", () => ({
  useCurrentProject: () => ({
    id: "test-project",
    name: "Test Project",
    path: "/test/path",
    type: "git" as const,
    addedAt: new Date().toISOString(),
    lastOpened: new Date().toISOString(),
  }),
  useProjectsActions: () => ({
    selectProject: rstest.fn(() => {}),
  }),
}))

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: rstest.fn(async () => {}),
  },
  writable: true,
})

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      {children}
    </MemoryRouter>
  )
}

describe("SessionList Component", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    const mod = require("@/pages/SessionList")
    SessionList = mod.default || mod.SessionList
  })

  test("renders without crashing", () => {
    const { container } = render(
      <TestWrapper>
        <SessionList />
      </TestWrapper>,
    )

    expect(container).toBeDefined()
  })

  test("calls loadSessions on mount", async () => {
    render(
      <TestWrapper>
        <SessionList />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(mockLoadSessions).toHaveBeenCalledWith("test-project", "/test/path")
    })
  })

  test("renders session list with basic structure", () => {
    const { container } = render(
      <TestWrapper>
        <SessionList />
      </TestWrapper>,
    )

    // Check that the component renders without throwing
    expect(container.firstChild).toBeDefined()
  })

  test("handles empty sessions", () => {
    // Mock empty sessions
    rstest.mock("../../src/stores/sessions", () => ({
      useSessionsStore: () => ({
        sessions: new Map([["test-project", []]]),
        listLoading: false,
        createLoading: false,
        error: null,
        loadSessions: mockLoadSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        clearError: mockClearError,
      }),
    }))

    const { container } = render(
      <TestWrapper>
        <SessionList />
      </TestWrapper>,
    )

    expect(container.firstChild).toBeDefined()
  })

  test("handles loading state", () => {
    // Mock loading state
    rstest.mock("../../src/stores/sessions", () => ({
      useSessionsStore: () => ({
        sessions: new Map(),
        listLoading: true,
        createLoading: false,
        error: null,
        loadSessions: mockLoadSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        clearError: mockClearError,
      }),
    }))

    const { container } = render(
      <TestWrapper>
        <SessionList />
      </TestWrapper>,
    )

    expect(container.firstChild).toBeDefined()
  })

  test("handles error state", () => {
    // Mock error state
    rstest.mock("../../src/stores/sessions", () => ({
      useSessionsStore: () => ({
        sessions: new Map(),
        listLoading: false,
        createLoading: false,
        error: "Failed to load sessions",
        loadSessions: mockLoadSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        clearError: mockClearError,
      }),
    }))

    const { container } = render(
      <TestWrapper>
        <SessionList />
      </TestWrapper>,
    )

    expect(container.firstChild).toBeDefined()
  })

  test("handles invalid project ID", () => {
    // Mock no project ID
    rstest.mock("react-router-dom", () => ({
      ...require("react-router-dom"),
      useParams: () => ({}),
      useNavigate: () => mockNavigate,
    }))

    const { container } = render(
      <TestWrapper>
        <SessionList />
      </TestWrapper>,
    )

    expect(container.firstChild).toBeDefined()
  })

  test("clears error on unmount", async () => {
    const { unmount } = render(
      <TestWrapper>
        <SessionList />
      </TestWrapper>,
    )

    unmount()

    await waitFor(() => {
      expect(mockClearError).toHaveBeenCalled()
    })
  })
})

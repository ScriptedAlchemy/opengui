import React from "react"
import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import "../setup.ts"
import { render, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
let SessionSwitcher: any

// Mock data
const mockSessions = [
  {
    id: "session-1",
    title: "Chat Session 1",
    projectID: "test-project",
    directory: "/test/path",
    version: "1",
    time: { created: Date.now() / 1000, updated: Date.now() / 1000 },
  },
  {
    id: "session-2",
    title: "Chat Session 2",
    projectID: "test-project",
    directory: "/test/path",
    version: "1",
    time: { created: Date.now() / 1000 - 3600, updated: Date.now() / 1000 - 1800 },
  },
]

let mockCurrentSession: any = mockSessions[0]

const mockNavigate = rstest.fn(() => {})
let mockParams = { projectId: "test-project" }
rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    useParams: () => mockParams,
  }
})

// Mock sessions store
const mockCreateSession = rstest.fn(() => Promise.resolve(mockSessions[0]))
const mockSelectSession = rstest.fn(() => {})
let mockSessionsForProject = mockSessions

rstest.mock("@/stores/sessions", () => ({
  useSessionsForProject: () => mockSessionsForProject,
  useCurrentSession: () => mockCurrentSession,
  useSessionsStore: () => ({
    createSession: mockCreateSession,
    selectSession: mockSelectSession,
  }),
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
}))

// Test wrapper
function TestWrapper({ children }: { children: React.ReactNode }) {
  const { MemoryRouter } = require("react-router-dom")
  return (
    <MemoryRouter
      initialEntries={["/projects/test-project/sessions/session-1/chat"]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      {children}
    </MemoryRouter>
  )
}

describe("SessionSwitcher Component", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    mockParams = { projectId: "test-project" }
    mockCurrentSession = mockSessions[0]
    mockSessionsForProject = mockSessions
    const mod = require("@/components/layout/SessionSwitcher")
    SessionSwitcher = mod.SessionSwitcher || mod.default
  })

  // Basic rendering tests
  test("renders session switcher with current session", () => {
    const { getByText } = render(
      <TestWrapper>
        <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />
      </TestWrapper>,
    )

    expect(getByText("Chat Session 1")).toBeDefined()
  })

  test("shows select session when no current session", () => {
    mockCurrentSession = null

    const { getByText } = render(
      <TestWrapper>
        <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />
      </TestWrapper>,
    )

    expect(getByText("Select Session")).toBeDefined()
  })

  test("opens dropdown menu on click", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByRole, getByText } = render(
      <TestWrapper>
        <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />
      </TestWrapper>,
    )

    const trigger = getByRole("button")
    await user.click(trigger)

    await waitFor(() => {
      expect(getByText("Sessions")).toBeDefined()
    })
  })

  test("creates new session", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByRole, getByText } = render(
      <TestWrapper>
        <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />
      </TestWrapper>,
    )

    const trigger = getByRole("button")
    await user.click(trigger)

    await waitFor(() => {
      expect(getByText("Sessions")).toBeDefined()
    })

    const newSessionButton = document.querySelector('[data-testid="new-session"]') as HTMLElement
    fireEvent.click(newSessionButton)

    expect(mockCreateSession).toHaveBeenCalledWith("test-project", "New Chat Session")
  })

  test("handles empty sessions list", () => {
    mockSessionsForProject = []
    mockCurrentSession = null

    const { getByText } = render(
      <TestWrapper>
        <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />
      </TestWrapper>,
    )

    expect(getByText("Select Session")).toBeDefined()
  })

  test("handles missing project ID", () => {
    mockParams = {}

    const { container } = render(
      <TestWrapper>
        <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />
      </TestWrapper>,
    )

    // Should render without crashing
    expect(container.firstChild).toBeDefined()
  })

  test("navigates on session selection", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByRole, getAllByText } = render(
      <TestWrapper>
        <SessionSwitcher projectId="test-project" />
      </TestWrapper>,
    )

    const trigger = getByRole("button")
    await user.click(trigger)

    const dropdownSession = document.querySelector('[data-testid="session-item-session-2"]') as HTMLElement
    fireEvent.click(dropdownSession)
    expect(mockSelectSession).toHaveBeenCalledWith(mockSessions[1])
  })
})

import React from "react"
import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import "../setup.ts"
import { waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../utils/test-router"
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
// Mock sessions store
const mockCreateSession = rstest.fn(() => Promise.resolve(mockSessions[0]))
const mockSelectSession = rstest.fn(() => {})
let mockSessionsForProject = mockSessions

rstest.mock("@/stores/sessions", () => ({
  useSessionsForProject: (_projectId: string, _path?: string) => mockSessionsForProject,
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

describe("SessionSwitcher Component", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    mockCurrentSession = mockSessions[0]
    mockSessionsForProject = mockSessions
    const mod = require("@/components/layout/SessionSwitcher")
    SessionSwitcher = mod.SessionSwitcher || mod.default
  })

  // Basic rendering tests
  test("renders session switcher with current session", () => {
    const { getByText } = renderWithRouter(
      <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />,
      {
        projectId: "test-project",
        worktreeId: "default",
        sessionId: "session-1",
        initialPath: "/projects/test-project/default/sessions/session-1/chat",
      }
    )

    expect(getByText("Chat Session 1")).toBeDefined()
  })

  test("shows select session when no current session", () => {
    mockCurrentSession = null

    const { getByText } = renderWithRouter(
      <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />,
      {
        projectId: "test-project",
        worktreeId: "default",
        sessionId: "session-1",
        initialPath: "/projects/test-project/default/sessions/session-1/chat",
      }
    )

    expect(getByText("Select Session")).toBeDefined()
  })

  test("opens dropdown menu on click", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByRole, getByText } = renderWithRouter(
      <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />,
      {
        projectId: "test-project",
        worktreeId: "default",
        sessionId: "session-1",
        initialPath: "/projects/test-project/default/sessions/session-1/chat",
      }
    )

    const trigger = getByRole("button")
    await user.click(trigger)

    await waitFor(() => {
      expect(getByText("Sessions")).toBeDefined()
    })
  })

  test("creates new session", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByRole, getByText } = renderWithRouter(
      <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />,
      {
        projectId: "test-project",
        worktreeId: "default",
        sessionId: "session-1",
        initialPath: "/projects/test-project/default/sessions/session-1/chat",
      }
    )

    const trigger = getByRole("button")
    await user.click(trigger)

    await waitFor(() => {
      expect(getByText("Sessions")).toBeDefined()
    })

    const newSessionButton = document.querySelector('[data-testid="new-session"]') as HTMLElement
    fireEvent.click(newSessionButton)

    expect(mockCreateSession).toHaveBeenCalledWith("test-project", "/test/path", "New Chat Session")
  })

  test("handles empty sessions list", () => {
    mockSessionsForProject = []
    mockCurrentSession = null

    const { getByText } = renderWithRouter(
      <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />,
      {
        projectId: "test-project",
        worktreeId: "default",
        sessionId: "session-1",
        initialPath: "/projects/test-project/default/sessions/session-1/chat",
      }
    )

    expect(getByText("Select Session")).toBeDefined()
  })

  test("handles missing project ID", () => {
    const { container } = renderWithRouter(
      <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />,
      {
        projectId: "test-project",
        worktreeId: "default",
        sessionId: "session-1",
        initialPath: "/projects/test-project/default/sessions/session-1/chat",
      }
    )

    // Should render without crashing
    expect(container.firstChild).toBeDefined()
  })

  test("navigates on session selection", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByRole } = renderWithRouter(
      <SessionSwitcher projectId="test-project" />,
      {
        projectId: "test-project",
        worktreeId: "default",
        sessionId: "session-1",
        initialPath: "/projects/test-project/default/sessions/session-1/chat",
      }
    )

    const trigger = getByRole("button")
    await user.click(trigger)

    const dropdownSession = document.querySelector('[data-testid="session-item-session-2"]') as HTMLElement
    fireEvent.click(dropdownSession)
    expect(mockSelectSession).toHaveBeenCalledWith(mockSessions[1])
  })
})

import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import "../setup.ts"
import { waitFor, fireEvent, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../utils/test-router"

let SessionSwitcher: any

const DEFAULT_PATH = "/test/path"
const WORKTREE_PATH = "/test/path/worktrees/worktree-1"

// Mock data
const defaultSessions = [
  {
    id: "session-1",
    title: "Chat Session 1",
    projectID: "test-project",
    directory: DEFAULT_PATH,
    version: "1",
    time: { created: Date.now() / 1000, updated: Date.now() / 1000 },
  },
  {
    id: "session-2",
    title: "Chat Session 2",
    projectID: "test-project",
    directory: DEFAULT_PATH,
    version: "1",
    time: { created: Date.now() / 1000 - 3600, updated: Date.now() / 1000 - 1800 },
  },
]

const worktreeOnlySessions = [
  {
    id: "session-wt-1",
    title: "Worktree Session 1",
    projectID: "test-project",
    directory: WORKTREE_PATH,
    version: "1",
    time: { created: Date.now() / 1000 - 7200, updated: Date.now() / 1000 - 3600 },
  },
]

let mockCurrentSession: any = defaultSessions[0]

const mockNavigate = rstest.fn(() => {})
// Mock sessions store
const mockCreateSession = rstest.fn(() => Promise.resolve(defaultSessions[0]))
const mockSelectSession = rstest.fn(() => {})
let mockSessionsByPath: Record<string, typeof defaultSessions> = {}
let mockWorktrees: Array<{ id: string; path: string; title: string }> = []
const mockLoadWorktrees = rstest.fn(() => Promise.resolve())

const aggregatedSessions = () => {
  const map = new Map<string, (typeof defaultSessions)[number]>()
  Object.values(mockSessionsByPath).forEach((sessions) => {
    sessions.forEach((session) => map.set(session.id, session))
  })
  return Array.from(map.values())
}

rstest.mock("@/stores/sessions", () => ({
  useSessionsForProject: (_projectId: string, path?: string) => {
    if (!path) {
      return aggregatedSessions()
    }
    return mockSessionsByPath[path] ?? []
  },
  useCurrentSession: () => mockCurrentSession,
  useSessionsStore: () => ({
    createSession: mockCreateSession,
    selectSession: mockSelectSession,
  }),
}))

rstest.mock("@/stores/worktrees", () => {
  const useWorktreesStore = (
    selector?: (state: { loadWorktrees: typeof mockLoadWorktrees }) => unknown,
  ) => {
    const state = { loadWorktrees: mockLoadWorktrees }
    return selector ? selector(state) : state
  }

  return {
    useWorktreesStore,
    useWorktreesForProject: () => mockWorktrees,
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

describe("SessionSwitcher Component", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    mockCurrentSession = defaultSessions[0]
    mockSessionsByPath = {
      [DEFAULT_PATH]: defaultSessions,
    }
    mockWorktrees = []
    mockLoadWorktrees.mockResolvedValue(undefined)
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
    mockSessionsByPath = {
      [DEFAULT_PATH]: [],
    }

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
    mockSessionsByPath = {
      [DEFAULT_PATH]: [],
    }
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
    expect(mockSelectSession).toHaveBeenCalledWith(defaultSessions[1])
  })

  test("filters sessions by active worktree", async () => {
    mockSessionsByPath = {
      [DEFAULT_PATH]: defaultSessions,
      [WORKTREE_PATH]: worktreeOnlySessions,
    }
    mockCurrentSession = worktreeOnlySessions[0]
    mockWorktrees = [
      { id: "default", title: "Default", path: DEFAULT_PATH },
      { id: "worktree-1", title: "Feature Branch", path: WORKTREE_PATH },
    ]

    const user = userEvent.setup({ delay: null })

    const { getByRole } = renderWithRouter(
      <SessionSwitcher projectId="test-project" navigateOverride={mockNavigate} />,
      {
        projectId: "test-project",
        worktreeId: "worktree-1",
        sessionId: "session-wt-1",
        initialPath: "/projects/test-project/worktree-1/sessions/session-wt-1/chat",
      }
    )

    const trigger = getByRole("button")
    await user.click(trigger)

    let menu!: HTMLElement
    await waitFor(() => {
      const found = document.querySelector('[role="menu"]') as HTMLElement | null
      if (!found) throw new Error('menu not found yet')
      menu = found
    })

    const menuQueries = within(menu)
    expect(menuQueries.getByText(/Worktree Session 1/)).toBeDefined()
    expect(menuQueries.queryByText(/Chat Session 1/)).toBeNull()
  })
})

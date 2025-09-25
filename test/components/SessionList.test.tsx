import "../setup.ts"
import {
  describe,
  test,
  beforeEach,
  expect,
  rstest,
} from "@rstest/core"
import { renderWithRouter } from "../utils/test-router"
import { screen, act } from "@testing-library/react"

const mockNavigate = rstest.fn(() => {})

rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockProject = {
  id: "test-project",
  name: "Test Project",
  path: "/test/path",
  type: "git" as const,
  addedAt: new Date().toISOString(),
  lastOpened: new Date().toISOString(),
  instance: {
    id: "instance-1",
    port: 3099,
    status: "running" as const,
    startedAt: new Date(),
  },
}

const createMockSession = (id: string, title: string) => ({
  id,
  title,
  projectID: "test-project",
  directory: "/test/path",
  version: "1",
  time: {
    created: Date.now() / 1000,
    updated: Date.now() / 1000,
  },
  metadata: {},
})

const mockSessions = [createMockSession("session-1", "First Session"), createMockSession("session-2", "Second Session")]

const mockLoadSessions = rstest.fn(async () => {})
const mockCreateSession = rstest.fn(async () => createMockSession("session-new", "New Session"))
const mockDeleteSession = rstest.fn(async () => {})
const mockClearError = rstest.fn(() => {})

const sessionsStoreMock = {
  sessions: new Map([["test-project", mockSessions]]),
  listLoading: false,
  createLoading: false,
  error: null,
  loadSessions: mockLoadSessions,
  createSession: mockCreateSession,
  deleteSession: mockDeleteSession,
  clearError: mockClearError,
}

rstest.mock("../../src/stores/sessions", () => ({
  useSessionsStore: () => sessionsStoreMock,
  useSessionsForProject: () => mockSessions,
}))
rstest.mock("@/stores/sessions", () => ({
  useSessionsStore: () => sessionsStoreMock,
  useSessionsForProject: () => mockSessions,
}))

rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => mockProject,
  useProjectsActions: () => ({
    selectProject: rstest.fn(async () => {}),
  }),
  useProjectsStore: { getState: () => ({ currentProject: mockProject, projects: [mockProject] }) },
}))
rstest.mock("@/stores/projects", () => ({
  useCurrentProject: () => mockProject,
  useProjectsActions: () => ({
    selectProject: rstest.fn(async () => {}),
  }),
  useProjectsStore: { getState: () => ({ currentProject: mockProject, projects: [mockProject] }) },
}))

const mockWorktrees = [
  { id: "default", path: "/test/path", title: "Main" },
  { id: "feature", path: "/feature", title: "Feature" },
]

const mockLoadWorktrees = rstest.fn(async () => {})
const worktreesStoreMock = {
  loadWorktrees: mockLoadWorktrees,
}

rstest.mock("../../src/stores/worktrees", () => ({
  useWorktreesStore: (selector?: any) => (selector ? selector(worktreesStoreMock) : worktreesStoreMock),
  useWorktreesForProject: () => mockWorktrees,
}))
rstest.mock("@/stores/worktrees", () => ({
  useWorktreesStore: (selector?: any) => (selector ? selector(worktreesStoreMock) : worktreesStoreMock),
  useWorktreesForProject: () => mockWorktrees,
}))

// Clipboard API stub
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: rstest.fn(async () => {}),
  },
  writable: true,
})

let SessionList: any

const renderSessions = async () => {
  await act(async () => {
    renderWithRouter(<SessionList />, {
      projectId: "test-project",
      worktreeId: "default",
      initialPath: "/projects/test-project/default/sessions",
    })
  })
}

describe("SessionList", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    sessionsStoreMock.sessions = new Map([["test-project", mockSessions]])
    const mod = require("../../src/pages/SessionList")
    SessionList = mod.default || mod.SessionList
  })

  test("renders session cards and loads data", async () => {
    await renderSessions()

    await renderSessions()

    const headings = await screen.findAllByText(/Chat Sessions/i)
    expect(headings.length).toBeGreaterThan(0)
    const firstLabels = await screen.findAllByText("First Session")
    expect(firstLabels.length).toBeGreaterThan(0)
    const secondLabels = await screen.findAllByText("Second Session")
    expect(secondLabels.length).toBeGreaterThan(0)
  })

  test("shows toolbar actions", async () => {
    await renderSessions()

    await screen.findByTestId("new-session-button")
    expect(screen.getByPlaceholderText(/search sessions/i)).toBeDefined()
  })
})

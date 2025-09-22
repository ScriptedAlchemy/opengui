import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import "../setup.ts"
import { render, fireEvent, waitFor, act, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom"
import { useEffect } from "react"
import type { ComponentType, ReactNode } from "react"

 // Mock data
const baseProject = () => ({
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
})

type ProjectShape = ReturnType<typeof baseProject>

let currentProject: ProjectShape | null = baseProject()
let projectsList: ProjectShape[] = currentProject ? [currentProject] : []

const defaultSessions = [
  {
    id: "session-1",
    title: "Default Session 1",
    projectID: "test-project",
    directory: "/test/path",
    version: "1",
    time: { created: Date.now() / 1000, updated: Date.now() / 1000 },
  },
  {
    id: "session-2",
    title: "Default Session 2",
    projectID: "test-project",
    directory: "/test/path",
    version: "1",
    time: { created: Date.now() / 1000 - 3600, updated: Date.now() / 1000 - 1800 },
  },
]

const worktreeSessions = [
  {
    id: "session-3",
    title: "Worktree Session",
    projectID: "test-project",
    directory: "/test/path/worktrees/worktree-1",
    version: "1",
    time: { created: Date.now() / 1000 - 7200, updated: Date.now() / 1000 - 3600 },
  },
]

const getSessionsForPath = (path?: string) => {
  if (!path || path === "/test/path") {
    return defaultSessions
  }
  if (path.includes("worktrees/worktree-1")) {
    return worktreeSessions
  }
  return []
}

// Mock router hooks
let mockParams = { projectId: "test-project", worktreeId: "default" }

rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    useParams: () => mockParams,
  }
})

// Mock project store
const mockSelectProject = rstest.fn(() => Promise.resolve(currentProject ?? undefined))
const mockStartInstance = rstest.fn(() => Promise.resolve())
const mockStopInstance = rstest.fn(() => Promise.resolve())

rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => currentProject,
  useProjects: () => projectsList,
  useProjectsActions: () => ({
    selectProject: mockSelectProject,
    startInstance: mockStartInstance,
    stopInstance: mockStopInstance,
  }),
  useProjectsStore: {
    getState: () => ({ currentProject, projects: projectsList }),
  },
}))

rstest.mock("@/stores/projects", () => ({
  useCurrentProject: () => currentProject,
  useProjects: () => projectsList,
  useProjectsActions: () => ({
    selectProject: mockSelectProject,
    startInstance: mockStartInstance,
    stopInstance: mockStopInstance,
  }),
  useProjectsStore: {
    getState: () => ({ currentProject, projects: projectsList }),
  },
}))

// Mock sessions store
let mockLoadSessions: ReturnType<typeof rstest.fn>
let mockCreateSession: ReturnType<typeof rstest.fn>

function createSessionsMock() {
  return {
    useSessionsForProject: (_projectId: string, projectPath?: string) =>
      getSessionsForPath(projectPath),
    useRecentSessions: (_projectId: string, limit = 10, projectPath?: string) =>
      getSessionsForPath(projectPath).slice(0, limit),
    useSessionsStore: () => ({
      loadSessions: mockLoadSessions,
      createSession: mockCreateSession,
    }),
  }
}

let mockLoadWorktrees: ReturnType<typeof rstest.fn>
let mockCreateWorktree: ReturnType<typeof rstest.fn>
let mockRemoveWorktree: ReturnType<typeof rstest.fn>
let mockWorktrees: Array<{ id: string; path: string; title: string }> = []
let mockWorktreesLoading = false

function createWorktreesMock() {
  const getSelectorState = () => ({
    loadWorktrees: mockLoadWorktrees,
    createWorktree: mockCreateWorktree,
    removeWorktree: mockRemoveWorktree,
    worktreesByProject: new Map([[mockParams.projectId ?? "test-project", mockWorktrees]]),
    loadingByProject: new Map([[mockParams.projectId ?? "test-project", mockWorktreesLoading]]),
    errorByProject: new Map([[mockParams.projectId ?? "test-project", null]]),
  })

  const useWorktreesStore = (selector?: (state: ReturnType<typeof getSelectorState>) => unknown) => {
    const state = getSelectorState()
    return selector ? selector(state) : state
  }

  ;(useWorktreesStore as any).getState = getSelectorState

  return {
    useWorktreesStore,
    useWorktreesForProject: () => mockWorktrees,
    useWorktreesLoading: () => mockWorktreesLoading,
  }
}

// Mock SDK service client used by context
const mockSessionList = rstest.fn((options?: { query?: { directory?: string } }) =>
  Promise.resolve({ data: getSessionsForPath(options?.query?.directory) }),
)
const mockConfigGet = rstest.fn(() => Promise.resolve({ data: {} }))
const mockProviders = rstest.fn(() =>
  Promise.resolve({ data: { providers: [{ id: "anthropic", name: "Anthropic", models: {} }], default: {} } }),
)
const mockProjectCurrent = rstest.fn(() => Promise.resolve({ data: { id: "test-project", path: "/test/path" } }))
const mockShell = rstest.fn((options: { body?: { command?: string }; query?: { directory?: string } }) => {
  const command = options?.body?.command ?? ""
  const directory = options?.query?.directory ?? ""
  const isSecondaryWorktree = typeof directory === "string" && directory.includes("worktrees")

  if (command.includes("git status")) {
    const branchLine = isSecondaryWorktree ? "## somthing" : "## main"
    const fileSection = isSecondaryWorktree ? " M src/feature.ts\n" : " M src/index.ts\n?? README.md\n"
    return Promise.resolve({
      data: {
        parts: [
          {
            type: "text",
            text: `${branchLine}\n${fileSection}`,
          },
        ],
      },
    })
  }

  if (command.includes("git log")) {
    const message = isSecondaryWorktree ? "Worktree commit" : "Connect git status"
    return Promise.resolve({
      data: {
        parts: [
          {
            type: "text",
            text: `abc123\x1fDeveloper\x1f2025-09-15T12:00:00Z\x1f${message}`,
          },
        ],
      },
    })
  }

  return Promise.resolve({
    data: {
      parts: [
        {
          type: "text",
          text: "",
        },
      ],
    },
  })
})

rstest.mock("../../src/services/opencode-sdk-service", () => ({
  opencodeSDKService: {
    getClient: async () => ({
      session: {
        list: (options: any) => mockSessionList(options),
        shell: (options: any) => mockShell(options),
      },
      config: {
        get: () => mockConfigGet(),
        providers: () => mockProviders(),
      },
      project: { current: () => mockProjectCurrent() },
    }),
    stopAll: async () => {},
  },
}))

// Use real OpencodeSDKProvider; client creation is mocked via opencodeSDKService

// Mock fetch endpoints used by dashboard
const mockFetch = rstest.fn((url: string) => {
  if (url.includes("/git/status")) {
    const parsed = new URL(url, "http://localhost")
    const worktree = parsed.searchParams.get("worktree")
    const isWorktree = Boolean(worktree && worktree !== "default")

    const branch = isWorktree ? "somthing" : "main"
    const changedFiles = isWorktree ? 1 : 2
    const message = isWorktree ? "Worktree commit" : "Connect git status"

    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () =>
        Promise.resolve({
          branch,
          changedFiles,
          ahead: 0,
          behind: 0,
          stagedCount: isWorktree ? 1 : 2,
          unstagedCount: isWorktree ? 0 : 1,
          untrackedCount: isWorktree ? 0 : 1,
          staged: [],
          modified: [],
          untracked: [],
          lastCommit: {
            hash: isWorktree ? "def456" : "abc123",
            message,
            author: isWorktree ? "Feature Dev" : "ScriptedAlchemy",
            date: isWorktree ? "2025-09-15T11:00:00Z" : "2025-09-15T12:00:00Z",
          },
          recentCommits: [
            {
              hash: isWorktree ? "def456" : "abc123",
              message,
              author: isWorktree ? "Feature Dev" : "ScriptedAlchemy",
              date: isWorktree ? "2025-09-15T11:00:00Z" : "2025-09-15T12:00:00Z",
            },
            {
              hash: isWorktree ? "def455" : "abc122",
              message: isWorktree ? "feat: update worktree support" : "chore: tidy dashboard mocks",
              author: isWorktree ? "Feature Dev" : "QA Bot",
              date: isWorktree ? "2025-09-14T10:00:00Z" : "2025-09-14T15:00:00Z",
            },
            {
              hash: isWorktree ? "def454" : "abc121",
              message: isWorktree ? "fix: address lint issues" : "docs: refresh readme",
              author: isWorktree ? "Feature Dev" : "Docs Writer",
              date: isWorktree ? "2025-09-13T09:00:00Z" : "2025-09-13T09:30:00Z",
            },
          ],
        }),
    } as Response)
  }

  if (url.includes("/resources")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ memory: { used: 128, total: 512 }, port: 3099 }),
    } as Response)
  }
  if (url.includes("/activity")) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          { id: "1", type: "session_created", message: "New chat session created", timestamp: new Date().toISOString() },
        ]),
    } as Response)
  }
  return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
})

// Test wrapper
let ProjectDashboard: ComponentType
let OpencodeSDKProvider: ComponentType
let currentLocation: ReturnType<typeof useLocation> | null = null

function LocationTracker() {
  const location = useLocation()
  useEffect(() => {
    currentLocation = location
  }, [location])
  return null
}

function TestWrapper({ children, initialEntry = "/projects/test-project/default" }: { children: ReactNode; initialEntry?: string }) {
  return (
    <OpencodeSDKProvider>
      <MemoryRouter
        initialEntries={[initialEntry]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <LocationTracker />
        <Routes>
          <Route path="/projects/:projectId/:worktreeId" element={children} />
        </Routes>
      </MemoryRouter>
    </OpencodeSDKProvider>
  )
}

describe("ProjectDashboard", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    mockParams = { projectId: "test-project", worktreeId: "default" }
    currentLocation = null
    currentProject = baseProject()
    projectsList = [currentProject]
    mockWorktrees = []
    mockWorktreesLoading = false
    mockLoadWorktrees = rstest.fn(() => Promise.resolve())
    mockCreateWorktree = rstest.fn(() => Promise.resolve({ id: "wt-1" }))
    mockRemoveWorktree = rstest.fn(() => Promise.resolve())
    mockLoadSessions = rstest.fn(() => Promise.resolve())
    mockCreateSession = rstest.fn((_projectId, projectPath) => {
      const [first] = getSessionsForPath(projectPath)
      return Promise.resolve(first ?? defaultSessions[0])
    })

    // Reset DOM (commented out for Bun test compatibility)
    // document.body.innerHTML = ""
    // const root = document.createElement("div")
    // root.id = "root"
    // document.body.appendChild(root)

    // Reset fetch mock
    ;(globalThis as any).fetch = mockFetch as any

    rstest.mock("@/stores/sessions", createSessionsMock)
    rstest.mock("../../src/stores/sessions", createSessionsMock)
    rstest.mock("@/stores/worktrees", createWorktreesMock)
    rstest.mock("../../src/stores/worktrees", createWorktreesMock)

    // Load the component after mocks are ready
    const mod = require("../../src/pages/ProjectDashboard")
    ProjectDashboard = mod.default || mod.ProjectDashboard
    const contextMod = require("../../src/contexts/OpencodeSDKContext")
    OpencodeSDKProvider = contextMod.OpencodeSDKProvider || contextMod.default

  })

  test("renders project dashboard with header", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      const headers = result.getAllByText("Test Project")
      expect(headers.length).toBeGreaterThan(0)
    })

    await waitFor(() => {
      expect(result.getByText("/test/path")).toBeDefined()
    })
    // Status badge shows "Ready" in current UI
    await waitFor(() => {
      expect(result.getByText(/ready/i)).toBeDefined()
    })
  })

  test("shows loading indicator while project data loads", async () => {
    mockLoadSessions.mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 50)))

    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Loading project dashboard...")).toBeTruthy()
    })
  })

  test("displays project stats cards", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Total Sessions")).toBeDefined()
    })

    await waitFor(() => {
      expect(result.getAllByText("Changed Files").length).toBeGreaterThan(0)
      expect(result.queryByText("Memory Usage")).toBeNull()
      expect(result.queryByText("Port")).toBeNull()
      expect(result.queryByText("Server Port")).toBeNull()
    })
  })

  test("shows git summary data", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      const gitCard = result.getByTestId("git-status-section")
      expect(within(gitCard).getByText("Git Status")).toBeDefined()
      expect(within(gitCard).getByText("2")).toBeDefined()
      expect(within(gitCard).getByText("main")).toBeDefined()
      expect(within(gitCard).getByText("Connect git status")).toBeDefined()
      expect(within(gitCard).getByText(/ScriptedAlchemy/)).toBeDefined()
      expect(within(gitCard).getByText("Recent Commits")).toBeDefined()
      expect(within(gitCard).getByText("chore: tidy dashboard mocks")).toBeDefined()
      expect(within(gitCard).getByText("docs: refresh readme")).toBeDefined()
    })
  })

  test("updates git summary when switching worktrees", async () => {
    mockWorktrees = [
      {
        id: "default",
        title: "Default",
        path: "/test/path",
        relativePath: ".",
        branch: "main",
        head: "abc123",
        isPrimary: true,
        isDetached: false,
        isLocked: false,
      },
      {
        id: "worktree-1",
        title: "Feature Branch",
        path: "/test/path/worktrees/worktree-1",
        relativePath: "worktrees/worktree-1",
        branch: "somthing",
        head: "def456",
        isPrimary: false,
        isDetached: false,
        isLocked: false,
      },
    ]

    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      const gitCard = result.getByTestId("git-status-section")
      expect(within(gitCard).getByText("main")).toBeDefined()
      expect(within(gitCard).getByText("chore: tidy dashboard mocks")).toBeDefined()
    })

    await waitFor(() => {
      const totalCard = result.getByTestId("total-sessions-stat")
      expect(within(totalCard).getByText("2")).toBeDefined()
      expect(result.getByText("Default Session 1")).toBeDefined()
      expect(result.getByText("Default Session 2")).toBeDefined()
    })

    await act(async () => {
      result.unmount()
    })

    await act(async () => {
      mockParams = { projectId: "test-project", worktreeId: "worktree-1" }
      result = render(
        <TestWrapper initialEntry="/projects/test-project/worktree-1">
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      const gitCard = result.getByTestId("git-status-section")
      expect(within(gitCard).getByText("somthing")).toBeDefined()
      expect(within(gitCard).getByText("Worktree commit")).toBeDefined()
      expect(within(gitCard).getByText("Recent Commits")).toBeDefined()
      expect(within(gitCard).getByText("feat: update worktree support")).toBeDefined()
      expect(within(gitCard).queryByText("chore: tidy dashboard mocks")).toBeNull()
    })

    await waitFor(() => {
      const totalCard = result.getByTestId("total-sessions-stat")
      expect(within(totalCard).getByText("1")).toBeDefined()
      expect(result.getByText("Worktree Session")).toBeDefined()
    })

    await waitFor(() => {
      expect(result.queryByText("Default Session 1")).toBeNull()
      expect(result.queryByText("Default Session 2")).toBeNull()
    })
  })

  test("shows quick actions", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByTestId("quick-actions-section")).toBeDefined()
    })

    await waitFor(() => {
      expect(result.getAllByText("New Chat").length).toBeGreaterThan(0)
      expect(result.getAllByText("File Browser").length).toBeGreaterThan(0)
      const gitLabels = result.getAllByText("Git Status")
      expect(gitLabels.length).toBeGreaterThan(0)
      expect(result.getAllByText("Manage Agents").length).toBeGreaterThan(0)
      expect(result.getAllByText("Settings").length).toBeGreaterThan(0)
    })
  })

  test("displays recent sessions", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Recent Sessions")).toBeDefined()
    })

    await waitFor(() => {
      expect(result.getByText("Default Session 1")).toBeDefined()
      expect(result.getByText("Default Session 2")).toBeDefined()
    })
  })

  test("shows status for stopped project (no start/stop controls)", async () => {
    const stopped = baseProject()
    currentProject = {
      ...stopped,
      instance: { ...stopped.instance, status: "stopped" as const },
    }
    projectsList = [currentProject]

    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      const badge = result.getByTestId("badge-project-status")
      expect(badge).toBeDefined()
    })
  })

  test("handles new session creation", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByTestId("quick-actions-section")).toBeDefined()
    })

    await waitFor(() => {
      expect(result.getByTestId("quick-action-new-chat")).toBeDefined()
    })

    const newChatButton = result.getByTestId("quick-action-new-chat") as HTMLElement
    const user = userEvent.setup()
    await user.click(newChatButton)

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith("test-project", "/test/path", "New Chat")
    })

    await waitFor(() => {
      expect(currentLocation?.pathname).toBe(
        "/projects/test-project/default/sessions/session-1/chat",
      )
    })
  })

  test("navigates to session on click", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    // Wait for loading to complete and sessions to appear
    await waitFor(
      () => {
    const sessionItem = result.getByText("Default Session 1")
        expect(sessionItem).toBeDefined()
      },
      { timeout: 5000 },
    )

    const sessionLabel = result.getByText("Default Session 1")
    await act(async () => {
      // Clicking the label should bubble to the clickable container
      fireEvent.click(sessionLabel)
    })

    await waitFor(() => {
      expect(currentLocation?.pathname).toBe(
        "/projects/test-project/default/sessions/session-1/chat",
      )
    })
  })

  test("shows project not found when project is missing", async () => {
    // Re-mock the module before requiring the component
    currentProject = null
    projectsList = []

    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(currentLocation?.pathname).toBe("/")
    })
  })

  test("displays git status when available", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })



    // Card is present (may appear multiple times in quick actions and section)
    await waitFor(() => {
      const labels = result.getAllByText("Git Status")
      expect(labels.length).toBeGreaterThan(0)
    })

    // Should eventually show git information after loading
    // The component shows "main" as the branch
    await waitFor(
      () => {
        expect(result.getByText("main")).toBeDefined()
      },
      { timeout: 5000 },
    )
  })

  test("displays agent summary", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByTestId("agents-metric")).toBeDefined()
    })

    // Card should be present with title
    await waitFor(() => {
      expect(result.getByText("Agent Summary")).toBeDefined()
    })
  })

  test("omits resource usage when metrics unavailable", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.queryByTestId("project-metrics-section")).toBeNull()
      expect(result.queryByText("Memory Usage")).toBeNull()
    })
  })

  test("handles project switcher", async () => {
    currentProject = baseProject()
    const secondProject = { ...baseProject(), id: "project-2", name: "Project 2" }
    projectsList = [currentProject, secondProject]

    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      const selectTrigger = result.container.querySelector('[role="combobox"]')
      expect(selectTrigger).toBeDefined()
    })
  })

  test("shows activity feed", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Recent Activity")).toBeDefined()
    })

    // Should show mock activity after loading
    await waitFor(
      () => {
        expect(result.getByText("New chat session created")).toBeDefined()
      },
      { timeout: 8000 },
    )
  })
})

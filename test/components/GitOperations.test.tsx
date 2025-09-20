import { describe, test, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { waitFor, act, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
let GitOperations: any
let OpencodeSDKProvider: any
import { renderWithRouter } from "../utils/test-router"

const originalFetch = globalThis.fetch
const defaultFetchHandler = (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input)

  if (url.includes("/git/status")) {
    const parsed = new URL(url, "http://localhost")
    const worktree = parsed.searchParams.get("worktree")
    const isWorktree = Boolean(worktree && worktree !== "default")

    const branch = isWorktree ? "feature" : "main"
    const changedFiles = isWorktree ? 3 : 4

    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () =>
        Promise.resolve({
          branch,
          changedFiles,
          ahead: 1,
          behind: 0,
          stagedCount: 2,
          unstagedCount: 1,
          untrackedCount: 1,
          staged: [
            { path: "src/test.ts", status: "M", staged: true },
            { path: "package.json", status: "A", staged: true },
          ],
          modified: [{ path: "README.md", status: "M", staged: false }],
          untracked: [{ path: "temp.log", status: "??", staged: false }],
          remoteUrl: "git@github.com:user/repo.git",
          lastCommit: {
            hash: "deadbeef",
            message: "Commit message",
            author: "Dev",
            date: new Date().toISOString(),
          },
          recentCommits: [
            {
              hash: "deadbeef",
              message: "Commit message",
              author: "Dev",
              date: new Date().toISOString(),
            },
            {
              hash: "abc123",
              message: "Refactor git operations UI",
              author: "Reviewer",
              date: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            },
            {
              hash: "ffeedd",
              message: "docs: refresh contributing guide",
              author: "Docs Writer",
              date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            },
          ],
        }),
    } as Response)
  }

  return Promise.resolve({ ok: true, status: 200, statusText: "OK", json: async () => ({}) } as Response)
}

const mockFetch = rstest.fn(defaultFetchHandler)

// Mock router hooks
const mockNavigate = rstest.fn(() => {})

rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockContextValue = {
  client: {
    session: {
      shell: (args: any) => mockShell(args),
    },
  },
  instanceStatus: "running",
}

rstest.mock("../../src/contexts/OpencodeSDKContext", () => ({
  OpencodeSDKProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProjectSDK: () => ({
    client: mockContextValue.client,
    instanceStatus: mockContextValue.instanceStatus,
    isLoading: false,
    error: null,
  }),
}))

rstest.mock("@/contexts/OpencodeSDKContext", () => ({
  OpencodeSDKProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProjectSDK: () => ({
    client: mockContextValue.client,
    instanceStatus: mockContextValue.instanceStatus,
    isLoading: false,
    error: null,
  }),
}))

// Mock project store
const mockProject = {
  id: "test-project",
  name: "Test Project",
  path: "/project",
  type: "git" as const,
  addedAt: new Date().toISOString(),
  lastOpened: new Date().toISOString(),
}
rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => mockProject,
}))
rstest.mock("@/stores/projects", () => ({
  useCurrentProject: () => mockProject,
}))

// Mock worktrees store
const mockLoadWorktrees = rstest.fn(() => Promise.resolve())
const mockWorktrees = [
  { id: "default", path: "/project", title: "Main" },
  { id: "feature", path: "/project-feature", title: "Feature Branch" }
]

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

// Mock SDK service client used by context
const defaultShellHandler = (args: any) => {
  const cmd = args?.body?.command || ""
  if (cmd.includes("git status")) {
    return Promise.resolve({
      data: {
        parts: [
          {
            type: "text",
            text: "## main...origin/main [ahead 2]\nM  src/test.ts\nA  package.json\n M README.md\n?? src/new.ts\n?? temp.log",
          },
        ],
      },
    })
  }
  if (cmd.includes("git remote get-url origin")) {
    return Promise.resolve({ data: { parts: [{ type: "text", text: "git@github.com:user/repo.git" }] } })
  }
  if (cmd.includes("git branch -vv")) {
    return Promise.resolve({ data: { parts: [{ type: "text", text: "* main 1234 [origin/main] Initial" }] } })
  }
  if (cmd.includes("git log")) {
    const now = new Date().toISOString()
    return Promise.resolve({
      data: {
        parts: [
          { type: "text", text: `deadbeef|dead|Dev|dev@example.com|${now}|Commit message` },
        ],
      },
    })
  }
  if (cmd.includes("git diff")) {
    return Promise.resolve({ data: { parts: [{ type: "text", text: "diff --git a/file b/file" }] } })
  }
  // For push/pull/fetch or anything else
  return Promise.resolve({ data: { parts: [{ type: "text", text: "" }] } })
}

const mockShell = rstest.fn(defaultShellHandler)

rstest.mock("../../src/services/opencode-sdk-service", () => ({
  opencodeSDKService: {
    getClient: async () => ({
      session: {
        shell: mockShell,
      },
    }),
    stopAll: async () => {},
  },
}))

// Mock sessions store with worktree-aware signature
const mockLoadSessions = rstest.fn(() => Promise.resolve())
const mockCreateSession = rstest.fn((projectId: string, worktreePath: string, title: string) => 
  Promise.resolve({ 
    id: "session-1", 
    title, 
    projectID: projectId, 
    directory: worktreePath,
    version: "1",
    time: { created: Date.now() / 1000, updated: Date.now() / 1000 }
  })
)
rstest.mock("../../src/stores/sessions", () => ({
  useSessionsStore: () => ({
    loadSessions: mockLoadSessions,
    createSession: mockCreateSession,
  }),
  useSessionsForProject: () => [],
}))
rstest.mock("@/stores/sessions", () => ({
  useSessionsStore: () => ({
    loadSessions: mockLoadSessions,
    createSession: mockCreateSession,
  }),
  useSessionsForProject: () => [],
}))

// Mock SDK hooks
rstest.mock("../../src/hooks/useProjectSDK", () => ({
  useProjectSDK: () => ({
    client: {
      session: {
        shell: mockShell,
      },
    },
    instanceStatus: "running",
  }),
}))
rstest.mock("@/hooks/useProjectSDK", () => ({
  useProjectSDK: () => ({
    client: {
      session: {
        shell: mockShell,
      },
    },
    instanceStatus: "running",
  }),
}))

// Helper to render with SDK context
const renderWithSDK = (ui: React.ReactElement, routerOptions: any = {}) => {
  return renderWithRouter(
    <OpencodeSDKProvider>{ui}</OpencodeSDKProvider>,
    routerOptions
  )
}

describe("GitOperations Component", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    mockFetch.mockClear()
    mockFetch.mockImplementation(defaultFetchHandler)
    ;(globalThis as any).fetch = mockFetch as any
    mockShell.mockImplementation(defaultShellHandler)
    const componentModule = require("../../src/pages/GitOperations")
    GitOperations = componentModule.default || componentModule.GitOperations
    const contextModule = require("../../src/contexts/OpencodeSDKContext")
    OpencodeSDKProvider = contextModule.OpencodeSDKProvider
  })

  afterEach(async () => {
    ;(globalThis as any).fetch = originalFetch
    await act(async () => {})
  })

  // Basic rendering tests
  test("renders git operations interface", async () => {
    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "default" })

    await waitFor(() => {
      expect(screen.getByText("Git Operations")).toBeDefined()
      expect(screen.getByRole("tab", { name: /Status/i })).toBeDefined()
      expect(screen.getByRole("tab", { name: /Branches/i })).toBeDefined()
      expect(screen.getByRole("tab", { name: /Commits/i })).toBeDefined()
    })
  })

  // Status tab tests
  test("displays git status", async () => {
    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "default" })

    const statusSection = await screen.findByTestId("git-status")

    await screen.findByText("git@github.com:user/repo.git")
    await within(statusSection).findByText("src/test.ts")
    await within(statusSection).findByText("package.json")
    await within(statusSection).findByText("README.md")
  })

  // File operations tests
  test("stages and unstages files", async () => {
    const user = userEvent.setup()
    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "default" })

    await waitFor(() => expect(screen.getByText("README.md")).toBeDefined())

    // Stage a specific file
    const stageButton = await screen.findByRole("button", { name: /Stage README\.md/i })
    await user.click(stageButton)

    await waitFor(() => {
      expect(
        mockShell.mock.calls.some(([args]) =>
          args?.body?.command?.includes('git add "README.md"') &&
          args?.query?.directory === "/project"
        )
      ).toBe(true)
    })
  })

  // Commit functionality tests
  test("commits staged changes", async () => {
    const user = userEvent.setup()
    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "default" })

    await waitFor(() => expect(screen.getByText("package.json")).toBeDefined())

    // Open commit dialog
    const commitButton = screen.getByRole("button", { name: /^Commit$/i })
    await user.click(commitButton)

    // Enter commit message - find the visible input
    const messageInputs = await screen.findAllByTestId("commit-message-input")
    const visibleInput = messageInputs.find(input => {
      const style = window.getComputedStyle(input)
      return style.pointerEvents !== 'none' && !input.hasAttribute('disabled')
    })
    if (!visibleInput) {
      throw new Error('No visible commit message input found')
    }
    await user.type(visibleInput, "Test commit message")

    // Submit commit
    const submitButton = screen.getByTestId("commit-submit-button")
    await user.click(submitButton)

    await waitFor(() => {
      expect(
        mockShell.mock.calls.some(([args]) =>
          args?.body?.command?.includes('git commit -m "Test commit message"') &&
          args?.query?.directory === "/project"
        )
      ).toBe(true)
    })
  })

  // Branch operations tests
  test("navigates to branches tab and shows branches", async () => {
    const user = userEvent.setup()
    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "default" })

    const branchTab = await screen.findByRole("tab", { name: /Branches/i })
    await user.click(branchTab)

    const branchContainer = await screen.findByTestId("branch-selector")
    expect(within(branchContainer).getAllByText(/main/).length).toBeGreaterThan(0)
    expect(within(branchContainer).getByText(/current/i)).toBeDefined()
  })

  // Push/pull operations tests
  test("performs git pull", async () => {
    const user = userEvent.setup()
    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "default" })

    await waitFor(() => expect(screen.getByRole("button", { name: /Pull/i })).toBeDefined())

    const pullButton = screen.getByRole("button", { name: /Pull/i })
    await user.click(pullButton)

    await waitFor(() => {
      expect(mockShell).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            command: "git pull",
          }),
          query: expect.objectContaining({
            directory: "/project",
          }),
        })
      )
    })
  })

  test("performs git push", async () => {
    const user = userEvent.setup()
    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "default" })

    await waitFor(() => expect(screen.getByRole("button", { name: /Push/i })).toBeDefined())

    const pushButton = screen.getByRole("button", { name: /Push/i })
    await user.click(pushButton)

    await waitFor(() => {
      expect(mockShell).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            command: "git push origin HEAD",
          }),
          query: expect.objectContaining({
            directory: "/project",
          }),
        })
      )
    })
  })

  // Worktree awareness tests
  test("uses correct worktree path for git operations", async () => {
    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "feature" })

    await waitFor(() => {
      expect(mockShell).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            directory: "/project-feature",
          }),
        })
      )
    })
  })

  test("redirects to default worktree when invalid worktree provided", async () => {
    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "invalid" })

    await screen.findByText("Test Project (default)")
    expect(screen.queryByText(/Worktree:\s*invalid/i)).toBeNull()
  })

  test("renders recent commits sidebar", async () => {
    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "default" })

    const commitPanel = await screen.findByTestId("commit-history")
    await within(commitPanel).findByText("Commit message")
    await within(commitPanel).findByText("Dev")
    await within(commitPanel).findByText("Refactor git operations UI")
    await within(commitPanel).findByText("docs: refresh contributing guide")
  })

  test("falls back to git log commits when status summary is empty", async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input)
      if (url.includes("/git/status")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () =>
            Promise.resolve({
              branch: "main",
              changedFiles: 0,
              ahead: 0,
              behind: 0,
              stagedCount: 0,
              unstagedCount: 0,
              untrackedCount: 0,
              staged: [],
              modified: [],
              untracked: [],
              recentCommits: [],
            }),
        } as Response)
      }
      return defaultFetchHandler(input)
    })

    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "default" })

    const commitPanel = await screen.findByTestId("commit-history")
    await within(commitPanel).findByText("Commit message")
    await within(commitPanel).findByText("Dev")
    await waitFor(() => {
      expect(within(commitPanel).queryByText("dead")).not.toBeNull()
    })

    mockFetch.mockImplementation(defaultFetchHandler)
  })

  // Error handling tests
  test("handles git command errors gracefully", async () => {
    mockShell.mockImplementation((args: any) => {
      const command = args?.body?.command || ""
      if (command.includes("git pull")) {
        return Promise.reject(new Error("Git command failed"))
      }
      return defaultShellHandler(args)
    })

    const user = userEvent.setup()
    renderWithSDK(<GitOperations />, { projectId: "test-project", worktreeId: "default" })

    await waitFor(() => expect(screen.getByRole("button", { name: /Pull/i })).toBeDefined())

    const pullButton = screen.getByRole("button", { name: /Pull/i })
    await user.click(pullButton)

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeDefined()
    })
  })
})

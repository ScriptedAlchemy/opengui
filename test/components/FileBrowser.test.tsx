import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import { fireEvent, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../utils/test-router"

let FileBrowser: any

// Mock data
const mockFiles = [
  {
    name: "src",
    type: "directory",
    path: "/project/src",
    size: 0,
    modified: new Date().toISOString(),
  },
  {
    name: "package.json",
    type: "file",
    path: "/project/package.json",
    size: 1024,
    modified: new Date().toISOString(),
  },
  {
    name: "README.md",
    type: "file",
    path: "/project/README.md",
    size: 2048,
    modified: new Date().toISOString(),
  },
]

const mockProject = {
  id: "test-project",
  name: "Test Project",
  path: "/project",
  type: "git" as const,
  addedAt: new Date().toISOString(),
  lastOpened: new Date().toISOString(),
  instance: {
    id: "instance-1",
    port: 3001,
    status: "running" as const,
    startedAt: new Date(),
  },
}

const mockWorktrees = [
  { id: "default", path: "/project", title: "Main" },
  { id: "feature", path: "/project-feature", title: "Feature Branch" }
]

const OpencodeSDKProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

// Mock router hooks
const mockNavigate = rstest.fn(() => {})

rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock project store
rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => mockProject,
}))
rstest.mock("@/stores/projects", () => ({
  useCurrentProject: () => mockProject,
}))

// Mock worktrees store
const mockLoadWorktrees = rstest.fn(() => Promise.resolve())
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
const mockFileList = rstest.fn(() => Promise.resolve({ data: mockFiles }))
const mockFileRead = rstest.fn(() => Promise.resolve({ data: { content: "file content" } }))
const mockSessionCreate = rstest.fn(() => Promise.resolve({ data: { id: "session-1" } }))
const mockSessionPrompt = rstest.fn(() => Promise.resolve({ data: {} }))

rstest.mock("../../src/services/opencode-sdk-service", () => ({
  opencodeSDKService: {
    getClient: async () => ({
      file: {
        list: mockFileList,
        read: mockFileRead,
      },
      session: {
        create: mockSessionCreate,
        prompt: mockSessionPrompt,
      },
      instance: {
        status: () => Promise.resolve({ data: { status: "running" } }),
      },
    }),
    getBackendUrl: () => "http://localhost:3001",
  },
}))

const mockContextValue = {
  client: {
    file: {
      list: mockFileList,
      read: mockFileRead,
    },
    session: {
      create: mockSessionCreate,
      prompt: mockSessionPrompt,
    },
    instance: {
      status: () => Promise.resolve({ data: { status: "running" } }),
    },
  },
  instanceStatus: "running" as const,
  isLoading: false,
  error: null,
}

rstest.mock("../../src/contexts/OpencodeSDKContext", () => ({
  OpencodeSDKProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProjectSDK: () => ({
    client: mockContextValue.client,
    instanceStatus: mockContextValue.instanceStatus,
    isLoading: mockContextValue.isLoading,
    error: mockContextValue.error,
  }),
}))
rstest.mock("@/contexts/OpencodeSDKContext", () => ({
  OpencodeSDKProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProjectSDK: () => ({
    client: mockContextValue.client,
    instanceStatus: mockContextValue.instanceStatus,
    isLoading: mockContextValue.isLoading,
    error: mockContextValue.error,
  }),
}))

// Mock sessions store with worktree-aware signature
const mockLoadSessions = rstest.fn(() => Promise.resolve())
const mockCreateSession = rstest.fn((projectId: string, worktreePath: string, title: string) =>
  Promise.resolve({ id: "session-1", title, projectID: projectId, directory: worktreePath })
)

function createSessionsStoreExports() {
  const getState = () => ({
    loadSessions: mockLoadSessions,
    createSession: mockCreateSession,
  })

  const useSessionsStore = (selector?: (state: ReturnType<typeof getState>) => unknown) => {
    const state = getState()
    return selector ? selector(state) : state
  }

  ;(useSessionsStore as any).getState = getState

  return {
    useSessionsStore,
    useSessionsForProject: () => [],
  }
}

rstest.mock("../../src/stores/sessions", createSessionsStoreExports)
rstest.mock("@/stores/sessions", createSessionsStoreExports)

// Mock hooks
// Helper to render with SDK context
const renderWithSDK = (ui: React.ReactElement, routerOptions: any = {}) => {
  return renderWithRouter(
    <OpencodeSDKProvider>{ui}</OpencodeSDKProvider>,
    routerOptions
  )
}

describe("FileBrowser Component", () => {
  beforeEach(() => {
    mockFileList.mockClear()
    mockFileRead.mockClear()
    mockSessionCreate.mockClear()
    mockSessionPrompt.mockClear()
    mockLoadSessions.mockClear()
    mockCreateSession.mockClear()
    mockLoadWorktrees.mockClear()
    mockNavigate.mockClear()

    const componentModule = require("../../src/pages/FileBrowser")
    FileBrowser = componentModule.default || componentModule.FileBrowser
  })

  test("renders file browser interface", async () => {
    const { getByText, getByPlaceholderText } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => {
      expect(getByPlaceholderText("Search files...")).toBeDefined()
      expect(getByText("package.json")).toBeDefined()
      expect(getByText("README.md")).toBeDefined()
      expect(getByText("src")).toBeDefined()
    })

    expect(mockLoadWorktrees).toHaveBeenCalledWith("test-project")
  })

  test("loads files on mount", async () => {
    renderWithSDK(<FileBrowser />, { projectId: "test-project", worktreeId: "default" })

    await waitFor(() => {
      expect(mockFileList).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({ path: "", directory: "/project" }),
        })
      )
    })
  })

  test("navigates into directory", async () => {
    const { getByText } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => expect(getByText("src")).toBeDefined())
    fireEvent.click(getByText("src"))

    await waitFor(() => {
      expect(mockFileList).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({ path: "/project/src", directory: "/project" }),
        })
      )
    })
  })

  test("selects and reads file", async () => {
    const { getByText } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => expect(getByText("package.json")).toBeDefined())
    fireEvent.click(getByText("package.json"))

    await waitFor(() => {
      expect(mockFileRead).toHaveBeenCalledWith({
        query: { path: "/project/package.json", directory: "/project" },
      })
    })
  })

  test("filters files by search term", async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => expect(getByText("package.json")).toBeDefined())

    const searchInput = getByPlaceholderText("Search files...") as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: "README" } })

    await waitFor(() => {
      expect(getByText("README.md")).toBeDefined()
      expect(queryByText("package.json")).toBeNull()
    })
  })

  test("toggles between list and grid view", async () => {
    const { getByRole, getByTestId, findByTestId } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    const fileTree = (await findByTestId("file-tree")) as HTMLElement
    expect(fileTree.className).toContain("space-y-1")

    fireEvent.click(getByRole("button", { name: /grid view/i }))
    await waitFor(() => {
      expect(getByTestId("file-tree").className).toContain("grid")
    })

    fireEvent.click(getByRole("button", { name: /list view/i }))
    await waitFor(() => {
      expect(getByTestId("file-tree").className).toContain("space-y-1")
    })
  })

  test("toggles hidden files visibility", async () => {
    const { getByLabelText } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => expect(mockFileList).toHaveBeenCalled())
    mockFileList.mockClear()

    fireEvent.click(getByLabelText("Show hidden files"))

    await waitFor(() => {
      expect(mockFileList).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({ directory: "/project", showHidden: true }),
        })
      )
    })
  })

  test("navigates using breadcrumb path", async () => {
    mockFileList.mockClear()
    mockFileList.mockImplementationOnce(() =>
      Promise.resolve({ data: mockFiles })
    )
    mockFileList.mockImplementationOnce(() =>
      Promise.resolve({
        data: [
          {
            name: "index.js",
            type: "file",
            path: "/project/src/index.js",
            size: 512,
            modified: new Date().toISOString(),
          },
        ],
      })
    )

    const { getByText } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => expect(getByText("src")).toBeDefined())
    fireEvent.click(getByText("src"))

    await waitFor(() => {
      expect(mockFileList).toHaveBeenLastCalledWith({
        query: { path: "/project/src", directory: "/project", showHidden: false },
      })
    })
  })

  test("opens context menu for file entries", async () => {
    const { findAllByTestId, findByText } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    const [firstFile] = await findAllByTestId("file-item")
    fireEvent.contextMenu(firstFile)

    expect(await findByText("New File")).toBeTruthy()
  })

  test("asks AI about selected file", async () => {
    const { getByText, getByRole } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => expect(getByText("package.json")).toBeDefined())
    fireEvent.click(getByText("package.json"))

    await waitFor(() => expect(mockFileRead).toHaveBeenCalled())
    mockFileRead.mockClear()

    const askAIButton = await waitFor(() => getByRole("button", { name: /ask ai/i }))
    await userEvent.click(askAIButton)

    await waitFor(() => {
      if (mockCreateSession.mock.calls.length === 0) {
        throw new Error("createSession not called yet")
      }
    })
    const [projectArg, pathArg, titleArg] = mockCreateSession.mock.calls.at(-1) ?? []
    expect(projectArg).toBe("test-project")
    expect(pathArg).toBe("/project")
    expect(typeof titleArg).toBe("string")

    await waitFor(() => {
      const promptArgs = mockSessionPrompt.mock.calls.at(-1)?.[0]
      expect(promptArgs?.query?.directory).toBe("/project")
    })
  })

  test("creates session with worktree path when asking AI", async () => {
    mockFileList.mockClear()
    mockFileList.mockImplementationOnce(({ query }) => {
      const directory = query?.directory ?? "/project-feature"
      return Promise.resolve({
        data: mockFiles.map((file) => ({
          ...file,
          path: file.path.replace("/project", directory),
        })),
      })
    })

    const { getByText, getByRole } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "feature" }
    )

    await waitFor(() => expect(getByText("package.json")).toBeDefined())
    fireEvent.click(getByText("package.json"))

    await waitFor(() => expect(mockFileRead).toHaveBeenCalled())
    mockFileRead.mockClear()

    const askAIButton = await waitFor(() => getByRole("button", { name: /ask ai/i }))
    await userEvent.click(askAIButton)

    await waitFor(() => {
      if (mockCreateSession.mock.calls.length === 0) {
        throw new Error("createSession not called yet")
      }
    })
    const [projectArg, pathArg] = mockCreateSession.mock.calls.at(-1) ?? []
    expect(projectArg).toBe("test-project")
    expect(pathArg).toBe("/project-feature")

    await waitFor(() => {
      const promptArgs = mockSessionPrompt.mock.calls.at(-1)?.[0]
      expect(promptArgs?.query?.directory).toBe("/project-feature")
    })
  })

  test("handles file loading error", async () => {
    mockFileList.mockRejectedValueOnce(new Error("Failed to load files"))

    const { getByRole } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => {
      expect(getByRole("heading", { name: /failed to load files/i })).toBeDefined()
    })
  })

  test("loads files from correct worktree path", async () => {
    renderWithSDK(<FileBrowser />, { projectId: "test-project", worktreeId: "feature" })

    await waitFor(() => {
      expect(mockFileList).toHaveBeenCalledWith({
        query: { path: "", directory: "/project-feature", showHidden: false },
      })
    })
  })

  test("supports keyboard navigation for files", async () => {
    const { getByText } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    const label = await waitFor(() => getByText("package.json"))
    const fileItem = label.closest('[data-testid="file-item"]') as HTMLElement | null
    expect(fileItem).not.toBeNull()

    act(() => fileItem?.focus())
    fireEvent.keyDown(fileItem!, { key: "Enter" })

    await waitFor(() => expect(mockFileRead).toHaveBeenCalled())
  })

  test("exposes accessible roles for file tree items", async () => {
    const { findByTestId, findAllByTestId } = renderWithSDK(
      <FileBrowser />,
      { projectId: "test-project", worktreeId: "default" }
    )

    const tree = await findByTestId("file-tree")
    expect(tree.getAttribute("role")).toBe("tree")

    const items = await findAllByTestId("file-item")
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].getAttribute("role")).toBe("treeitem")
  })
})

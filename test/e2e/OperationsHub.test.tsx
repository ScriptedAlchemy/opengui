import { describe, it, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BrowserRouter } from "react-router-dom"

import OperationsHub from "@/pages/OperationsHub"
import { useProjectsStore } from "@/stores/projects"
import { useCliSessionsStore } from "@/stores/cliSessions"
import { useWorktreesStore } from "@/stores/worktrees"

rstest.mock("@/features/projects/ProjectRail", () => ({
  ProjectRail: ({ className }: { className?: string }) => (
    <div data-testid="project-rail" className={className}>
      Project Rail
    </div>
  ),
}))
rstest.mock("@/features/worktrees/WorktreeBoard", () => ({
  WorktreeBoard: ({ className }: { className?: string }) => (
    <div data-testid="worktree-board" className={className}>
      Worktree Board
    </div>
  ),
}))
rstest.mock("@/features/cli/CliSessionDock", () => ({
  CliSessionDock: ({ className }: { className?: string }) => (
    <div data-testid="cli-session-dock" className={className}>
      CLI Session Dock
    </div>
  ),
}))
rstest.mock("@/features/cli/TerminalCanvas", () => ({
  TerminalCanvas: ({ className }: { className?: string }) => (
    <div data-testid="terminal-canvas" className={className}>
      Terminal Canvas
    </div>
  ),
}))
rstest.mock("@/features/cli/CreateSessionDialog", () => ({
  CreateSessionDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-session-dialog">Create Session</div> : null,
}))

const project = {
  id: "proj-1",
  name: "Example Project",
  path: "/repo/project",
  type: "git" as const,
  worktrees: [],
}

const defaultWorktrees = [
  {
    id: "default",
    title: "default",
    path: "/repo/project",
    relativePath: "",
    branch: "main",
    head: "abc123",
    isPrimary: true,
    isDetached: false,
    isLocked: false,
  },
  {
    id: "feature",
    title: "feature",
    path: "/repo/project/feature",
    relativePath: "feature",
    branch: "feature",
    head: "def456",
    isPrimary: false,
    isDetached: false,
    isLocked: false,
  },
]

const renderOperationsHub = () =>
  render(
    <BrowserRouter>
      <OperationsHub />
    </BrowserRouter>
  )

const sanitizeSegments = (value: string) => {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
  if (!normalized) return ""
  return normalized
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "")
    )
    .filter(Boolean)
    .join("/")
}

describe("OperationsHub worktree flows", () => {
  let fetchMock: ReturnType<typeof rstest.fn>

  beforeEach(() => {
    if (typeof HTMLCanvasElement !== "undefined") {
      HTMLCanvasElement.prototype.getContext = () => ({ clearRect: () => {}, fillRect: () => {} }) as any
    }

    useProjectsStore.setState((state) => {
      state.projects = [project]
      state.currentProject = project
      state.loading = false
      state.error = null
    })

    useCliSessionsStore.setState((state) => {
      state.sessions = []
      state.tools = []
      state.loading = false
      state.error = null
      state.activeSessionId = null
      state.loadSessions = async () => {}
      state.loadTools = async () => {}
      state.createSession = async () => null
      state.closeSession = async () => {}
      state.setActiveSession = () => {}
      state.updateSessionStatus = () => {}
    })

    useWorktreesStore.setState((state) => {
      state.worktreesByProject.set(project.id, defaultWorktrees)
      state.loadingByProject.set(project.id, false)
      state.errorByProject.set(project.id, null)
    })

    const branches = [
      { name: "main", checkedOut: true },
      { name: "feature/api", checkedOut: false },
    ]

    fetchMock = rstest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input instanceof URL ? input.href : (input as Request).url)
      if (url.includes("/projects/proj-1/git/branches")) {
        return new Response(JSON.stringify(branches), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (url.endsWith("/projects")) {
        return new Response(JSON.stringify([project]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (url.includes("/projects/proj-1/worktrees")) {
        return new Response(JSON.stringify(defaultWorktrees), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (url.includes("/cli/sessions")) {
        return new Response(JSON.stringify({ sessions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (url.includes("/cli/tools")) {
        return new Response(JSON.stringify({ tools: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    rstest.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    rstest.clearAllMocks()
    rstest.unstubAllGlobals()
  })

  it("auto-populates worktree path and branch from the title", async () => {
    const user = userEvent.setup()
    renderOperationsHub()

    await user.click(screen.getByTestId("open-new-worktree"))

    const titleInput = await screen.findByLabelText("Title")
    await user.type(titleInput, "New Feature 42")

    const pathInput = await screen.findByLabelText("Relative Path") as HTMLInputElement
    await waitFor(() => expect(pathInput.value).to.equal("worktrees/new-feature-42"))

    const branchInput = await screen.findByLabelText("New Branch Name") as HTMLInputElement
    await waitFor(() => expect(branchInput.value).to.equal("new-feature-42"))

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) =>
        typeof input === "string" ? input : (input instanceof URL ? input.href : (input as Request).url)
      )
      expect(urls.some((url) => url.includes("/projects/proj-1/git/branches"))).to.be.true
    })
  })

  it("keeps a manually edited path and sanitises the value", async () => {
    const user = userEvent.setup()
    renderOperationsHub()

    await user.click(screen.getByTestId("open-new-worktree"))

    const titleInput = await screen.findByLabelText("Title")
    await user.type(titleInput, "Gradient Alpha")

    const pathInput = (await screen.findByLabelText("Relative Path")) as HTMLInputElement
    await user.clear(pathInput)
    await user.type(pathInput, "Worktrees / Custom Path!!!")

    await waitFor(() => expect(pathInput.value).to.match(/^worktrees[\w-]*$/))

    await user.clear(titleInput)
    await user.type(titleInput, "Another Title")

    expect(pathInput.value).to.equal(pathInput.value.toLowerCase())
    expect(pathInput.value.includes(" ")).to.be.false
  })

  it("keeps a manually edited branch name and sanitises the value", async () => {
    const user = userEvent.setup()
    renderOperationsHub()

    await user.click(screen.getByTestId("open-new-worktree"))

    const titleInput = await screen.findByLabelText("Title")
    await user.type(titleInput, "Login Drawer")

    const branchInput = (await screen.findByLabelText("New Branch Name")) as HTMLInputElement
    await user.clear(branchInput)
    await user.type(branchInput, "Hot Fix / Release 🎉")

    await waitFor(() => expect(branchInput.value).to.match(/^[a-z0-9/-]+$/))

    await user.clear(titleInput)
    await user.type(titleInput, "Drawer QA")

    expect(branchInput.value).to.equal(branchInput.value.toLowerCase())
    expect(branchInput.value.includes(" ")).to.be.false
  })

  it("toggles overlays with keyboard shortcuts", async () => {
    const user = userEvent.setup()
    renderOperationsHub()

    await user.keyboard("{Alt>}w{/Alt}")
    await waitFor(() => expect(Boolean(screen.queryByTestId("worktrees-drawer"))).to.be.true)

    await user.keyboard("{Escape}")
    await waitFor(() => {
      const drawer = screen.queryByTestId("worktrees-drawer")
      expect(drawer ? drawer.getAttribute("data-state") : "closed").to.equal("closed")
    })

    await user.keyboard("{Alt>}s{/Alt}")
    await waitFor(() => expect(Boolean(screen.queryByTestId("sessions-sheet"))).to.be.true)
  })
})

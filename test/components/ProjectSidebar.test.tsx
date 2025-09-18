import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import { fireEvent, waitFor } from "@testing-library/react"
import { renderWithRouter } from "../utils/test-router"
let ProjectSidebar: any

const proj = {
  id: "p1",
  name: "Proj One",
  path: "/tmp/p1",
  type: "git" as const,
  addedAt: new Date().toISOString(),
  lastOpened: new Date().toISOString(),
  instance: { id: "i1", port: 3001, status: "running" as const, startedAt: new Date() },
}

const sessions = [
  { id: "s1", title: "First", projectID: "p1", directory: "/tmp/p1", version: "1", time: { created: 1, updated: 2 } },
]

rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => proj,
}))
rstest.mock("@/stores/projects", () => ({
  useCurrentProject: () => proj,
}))

const load = rstest.fn(async () => {})
const create = rstest.fn(async () => sessions[0])
const select = rstest.fn(() => {})
const del = rstest.fn(async () => {})
const clear = rstest.fn(() => {})
const loadWorktrees = rstest.fn(async () => {})
const removeWorktree = rstest.fn(async () => {})
const mockWorktrees = [
  { id: "default", title: "Default", path: "/tmp/p1", relativePath: "." },
  { id: "feature", title: "Feature", path: "/tmp/p1/worktrees/feature", relativePath: "worktrees/feature" },
]

rstest.mock("../../src/stores/sessions", () => ({
  useSessionsStore: () => ({
    loadSessions: load,
    createSession: create,
    selectSession: select,
    deleteSession: del,
    clearError: clear,
  }),
  useCurrentSession: () => sessions[0],
  useSessionsLoading: () => false,
  useSessionsError: () => null,
  useRecentSessions: () => sessions,
  useSessionsForProject: () => sessions,
  useSessionsCreateLoading: () => false,
  useSessionsListLoading: () => false,
}))
rstest.mock("@/stores/sessions", () => ({
  useSessionsStore: () => ({
    loadSessions: load,
    createSession: create,
    selectSession: select,
    deleteSession: del,
    clearError: clear,
  }),
  useCurrentSession: () => sessions[0],
  useSessionsLoading: () => false,
  useSessionsError: () => null,
  useRecentSessions: () => sessions,
  useSessionsForProject: () => sessions,
  useSessionsCreateLoading: () => false,
  useSessionsListLoading: () => false,
}))

rstest.mock("../../src/stores/worktrees", () => ({
  useWorktreesStore: (selector?: (state: any) => unknown) => {
    const state = {
      loadWorktrees,
      removeWorktree,
      worktreesByProject: new Map([["p1", mockWorktrees]]),
      loadingByProject: new Map([["p1", false]]),
    }
    return selector ? selector(state) : state
  },
  useWorktreesForProject: () => mockWorktrees,
  useWorktreesLoading: () => false,
}))

rstest.mock("@/stores/worktrees", () => ({
  useWorktreesStore: (selector?: (state: any) => unknown) => {
    const state = {
      loadWorktrees,
      removeWorktree,
      worktreesByProject: new Map([["p1", mockWorktrees]]),
      loadingByProject: new Map([["p1", false]]),
    }
    return selector ? selector(state) : state
  },
  useWorktreesForProject: () => mockWorktrees,
  useWorktreesLoading: () => false,
}))

rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    NavLink: ({ className, to, children, ...rest }: any) => {
      const computedClass = typeof className === "function" ? className({ isActive: false }) : className
      const href = typeof to === "string" ? to : "#"
      return (
        <a href={href} className={computedClass as string} {...rest}>
          {children}
        </a>
      )
    },
  }
})



describe("ProjectSidebar", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    const mod = require("@/components/layout/ProjectSidebar")
    ProjectSidebar = mod.ProjectSidebar || mod.default
  })

  test("loads sessions on mount and creates new session", async () => {
    const { getByText } = renderWithRouter(<ProjectSidebar />, {
      projectId: "p1",
      worktreeId: "default",
      initialPath: "/projects/p1/default/dashboard"
    })
    expect(load).toHaveBeenCalledWith("p1", "/tmp/p1")
    const btn = getByText("New Session")
    fireEvent.click(btn)
    await waitFor(() => expect(create).toHaveBeenCalledWith("p1", "/tmp/p1", "New Session"))
    expect(select).toHaveBeenCalled()
  })

  test("toggles collapse", () => {
    const { getAllByRole, container } = renderWithRouter(<ProjectSidebar />, {
      projectId: "p1",
      worktreeId: "default",
      initialPath: "/projects/p1/default/dashboard"
    })
    const buttons = getAllByRole("button")
    const toggle = buttons[buttons.length - 1]
    fireEvent.click(toggle)
    expect(container.firstChild).toBeDefined()
  })
})

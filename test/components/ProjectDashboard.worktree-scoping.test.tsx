import { describe, test, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { renderWithRouter } from "../utils/test-router"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"

let ProjectDashboard: any

// Mock current project
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
  useProjects: () => [mockProject],
  useProjectsActions: () => ({ selectProject: async () => {} }),
  useProjectsStore: { getState: () => ({ currentProject: mockProject, projects: [mockProject] }) },
}))

// Mock worktrees
const mockWorktrees = [
  { id: "default", path: "/project", title: "Main" },
  { id: "feature", path: "/project-feature", title: "Feature Branch" },
]
rstest.mock("../../src/stores/worktrees", () => ({
  useWorktreesStore: (sel?: any) => (sel ? sel({ loadWorktrees: async () => {}, createWorktree: async () => ({}), removeWorktree: async () => {} }) : {}),
  useWorktreesForProject: () => mockWorktrees,
  useWorktreesLoading: () => false,
}))

// Mock sessions store selectors to be worktree-path aware by argument
const sessionsByPath: Record<string, any[]> = {
  "/project": [
    { id: "s1", title: "A", time: { created: 1, updated: 10 } },
    { id: "s2", title: "B", time: { created: 2, updated: 20 } },
  ],
  "/project-feature": [
    { id: "s3", title: "C", time: { created: 3, updated: 30 } },
  ],
}

rstest.mock("../../src/stores/sessions", () => ({
  useSessionsStore: () => ({ loadSessions: async () => {}, createSession: async () => ({ id: "new", time: { created: 1, updated: 1 } }) }),
  useSessionsForProject: (_projectId: string, projectPath?: string) => sessionsByPath[projectPath || "/project"] || [],
  useRecentSessions: (_projectId: string, _limit?: number, projectPath?: string) => {
    const list = sessionsByPath[projectPath || "/project"] || []
    return [...list].sort((a, b) => b.time.updated - a.time.updated)
  },
}))

// Provide a lightweight SDK provider/context so the component can mount cleanly
rstest.mock("../../src/contexts/OpencodeSDKContext", () => ({
  OpencodeSDKProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useOpencodeSDK: () => ({
    getClient: async () => ({ session: {} }),
    currentClient: null,
    isLoading: false,
    error: null,
  }),
}))

// Mock git status endpoint to reflect worktree selection via query param
const originalFetch = globalThis.fetch
const mockFetch = rstest.fn((input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input)
  if (url.includes("/api/projects/") && url.includes("/git/status")) {
    const parsed = new URL(url, "http://localhost")
    const worktreeParam = parsed.searchParams.get("worktree")
    const branch = worktreeParam && worktreeParam !== "default" ? "feature" : "main"
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        branch,
        ahead: 0,
        behind: 0,
        changedFiles: branch === "feature" ? 7 : 3,
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 0,
        staged: [],
        modified: [],
        untracked: [],
        lastCommit: { hash: "h", message: "m", author: "a", date: new Date().toISOString() },
      }),
    } as Response)
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response)
})

beforeEach(() => {
  rstest.clearAllMocks()
  ;(globalThis as any).fetch = mockFetch as any
  const mod = require("../../src/pages/ProjectDashboard")
  ProjectDashboard = mod.default
})

afterEach(() => {
  ;(globalThis as any).fetch = originalFetch
})

describe("ProjectDashboard worktree scoping", () => {
  test("Total Sessions and Git Status reflect active worktree", async () => {
    const user = userEvent.setup()

    // Start at default worktree
    renderWithRouter(<ProjectDashboard />, {
      projectId: "test-project",
      worktreeId: "default",
      initialPath: "/projects/test-project/default",
    })

    // Total Sessions shows 2 for default path
    const totalCard = await screen.findByTestId("total-sessions-stat")
    await waitFor(() => {
      const countEl = totalCard.querySelector(".text-2xl") as HTMLElement
      expect(countEl?.textContent?.trim()).toBe("2")
    })

    // Git Status shows main branch for default
    const gitCard = await screen.findByTestId("git-status-section")
    await within(gitCard).findByText(/Current Branch/i)
    await within(gitCard).findByText("main")

    // Switch to feature worktree via Worktrees list Open button
    const worktreesSection = await screen.findByTestId("worktrees-section")
    const openButtons = within(worktreesSection).getAllByRole("button", { name: /Open/i })
    // First Open is default, second is feature (sorted order)
    await user.click(openButtons[1])

    // After navigation, counts update
    await waitFor(async () => {
      const countEl = (await screen.findByTestId("total-sessions-stat")).querySelector(".text-2xl") as HTMLElement
      expect(countEl?.textContent?.trim()).toBe("1")
    })

    const gitCard2 = await screen.findByTestId("git-status-section")
    await within(gitCard2).findByText("feature")

    // Header path reflects active worktree path
    await screen.findByText("/project-feature")
  })
})

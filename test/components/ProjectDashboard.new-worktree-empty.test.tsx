import { describe, test, beforeEach, afterEach, expect, rstest } from "@rstest/core"
import { renderWithRouter } from "../utils/test-router"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"

let ProjectDashboard: any

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

const mockWorktrees = [
  { id: "default", path: "/project", title: "Main" },
  { id: "newtree", path: "/project-new", title: "New Worktree" },
]
rstest.mock("../../src/stores/worktrees", () => ({
  useWorktreesStore: (sel?: any) => (sel ? sel({ loadWorktrees: async () => {}, createWorktree: async () => ({}), removeWorktree: async () => {} }) : {}),
  useWorktreesForProject: () => mockWorktrees,
  useWorktreesLoading: () => false,
}))

const sessionsByPath: Record<string, any[]> = {
  "/project": [
    { id: "s1", title: "A", time: { created: 1, updated: 10 } },
    { id: "s2", title: "B", time: { created: 2, updated: 20 } },
  ],
  "/project-new": [],
}

rstest.mock("../../src/stores/sessions", () => ({
  useSessionsStore: () => ({ loadSessions: async () => {}, createSession: async () => ({ id: "new", time: { created: 1, updated: 1 } }) }),
  useSessionsForProject: (_projectId: string, projectPath?: string) => sessionsByPath[projectPath || "/project"] || [],
  useRecentSessions: (_projectId: string, _limit?: number, projectPath?: string) => {
    const list = sessionsByPath[projectPath || "/project"] || []
    return [...list].sort((a, b) => b.time.updated - a.time.updated)
  },
}))

// Lightweight SDK provider
rstest.mock("../../src/contexts/OpencodeSDKContext", () => ({
  OpencodeSDKProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useOpencodeSDK: () => ({ getClient: async () => ({ session: {} }), currentClient: null, isLoading: false, error: null }),
}))

beforeEach(() => {
  rstest.clearAllMocks()
  const mod = require("../../src/pages/ProjectDashboard")
  ProjectDashboard = mod.default
})

afterEach(() => {})

describe("ProjectDashboard new worktree shows empty sessions", () => {
  test("switching to an empty worktree shows 0 sessions and no recent list", async () => {
    const user = userEvent.setup()

    renderWithRouter(<ProjectDashboard />, {
      projectId: "test-project",
      worktreeId: "default",
      initialPath: "/projects/test-project/default",
    })

    // Default shows count 2
    const totalCard = await screen.findByTestId("total-sessions-stat")
    await waitFor(() => {
      const countEl = totalCard.querySelector(".text-2xl") as HTMLElement
      expect(countEl?.textContent?.trim()).toBe("2")
    })

    // Click Open on the second row (newtree)
    const worktreesSection = await screen.findByTestId("worktrees-section")
    const openButtons = within(worktreesSection).getAllByRole("button", { name: /Open/i })
    await user.click(openButtons[1])

    // Count updates to zero
    await waitFor(async () => {
      const countEl = (await screen.findByTestId("total-sessions-stat")).querySelector(".text-2xl") as HTMLElement
      expect(countEl?.textContent?.trim()).toBe("0")
    })

    // Recent Sessions section shows the empty state message
    const recentSection = await screen.findByTestId("recent-sessions-section")
    await within(recentSection).findByText("No recent sessions")
  })
})


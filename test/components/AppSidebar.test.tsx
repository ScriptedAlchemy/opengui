import "../setup.ts"

import { describe, test, beforeEach, expect, rstest } from "@rstest/core"
import { screen } from "@testing-library/react"

import { renderWithRouter } from "../utils/test-router"

const mockProject = {
  id: "test-project",
  name: "Test Project",
  path: "/tmp/test-project",
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

rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => mockProject,
}))

rstest.mock("@/stores/projects", () => ({
  useCurrentProject: () => mockProject,
}))

describe("AppSidebar navigation", () => {
  let AppSidebar: any
  let SidebarProvider: any

  const renderSidebar = (initialPath: string) => {
    return renderWithRouter(
      <SidebarProvider>
        <AppSidebar variant="inset" />
      </SidebarProvider>,
      { initialPath }
    )
  }

  beforeEach(() => {
    rstest.clearAllMocks()
    const sidebarModule = require("../../src/components/ui/sidebar")
    SidebarProvider = sidebarModule.SidebarProvider
    const mod = require("../../src/components/app-sidebar")
    AppSidebar = mod.AppSidebar || mod.default
  })

  test("hides project-specific navigation on the home route", async () => {
    renderSidebar("/")

    await screen.findByTestId("nav-main")

    expect(screen.getByTestId("nav-projects")).toBeTruthy()
    expect(screen.queryByTestId("dashboard-nav")).toBeNull()
    expect(screen.queryByTestId("nav-sessions")).toBeNull()
    expect(screen.queryByTestId("nav-git-operations")).toBeNull()
    expect(screen.queryByText(/Documents/i)).toBeNull()
  })

  test("shows project navigation when viewing a project", async () => {
    renderSidebar("/projects/test-project/default")

    await screen.findByTestId("dashboard-nav")

    expect(screen.getByTestId("dashboard-nav")).toBeTruthy()
    expect(screen.getByTestId("nav-sessions")).toBeTruthy()
    expect(screen.getByTestId("nav-git-operations")).toBeTruthy()
    expect(screen.getByText(/Documents/i)).toBeTruthy()
  })
})

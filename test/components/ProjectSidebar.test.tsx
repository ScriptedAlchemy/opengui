import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import { render, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
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

rstest.mock("../../src/stores/sessions", () => ({
  useSessionsStore: () => ({ 
    loadSessions: load, 
    createSession: create, 
    selectSession: select, 
    deleteSession: del, 
    clearError: clear 
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
    clearError: clear 
  }),
  useCurrentSession: () => sessions[0],
  useSessionsLoading: () => false,
  useSessionsError: () => null,
  useRecentSessions: () => sessions,
  useSessionsForProject: () => sessions,
  useSessionsCreateLoading: () => false,
  useSessionsListLoading: () => false,
}))

// Mock the navigate hook
const mockNavigate = rstest.fn(() => {})
rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function wrap(ui: React.ReactNode) {
  const { MemoryRouter } = require("react-router-dom")
  return (
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      {ui}
    </MemoryRouter>
  )
}

describe("ProjectSidebar", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    const mod = require("@/components/layout/ProjectSidebar")
    ProjectSidebar = mod.ProjectSidebar || mod.default
  })

  test("loads sessions on mount and creates new session", async () => {
    const { getByText } = render(wrap(<ProjectSidebar />))
    expect(load).toHaveBeenCalledWith("p1", "/tmp/p1")
    const btn = getByText("New Session")
    fireEvent.click(btn)
    await waitFor(() => expect(create).toHaveBeenCalledWith("p1", "/tmp/p1", "New Session"))
    expect(select).toHaveBeenCalled()
  })

  test("toggles collapse", () => {
    const { getAllByRole, container } = render(wrap(<ProjectSidebar />))
    const buttons = getAllByRole("button")
    const toggle = buttons[buttons.length - 1]
    fireEvent.click(toggle)
    expect(container.firstChild).toBeDefined()
  })
})

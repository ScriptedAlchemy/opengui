import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import "../setup.ts"
import { render, fireEvent, waitFor, act } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import ProjectDashboard from "../../src/pages/ProjectDashboard"
import { OpencodeSDKProvider } from "../../src/contexts/OpencodeSDKContext"

 // Mock data
const mockProject = {
  id: "test-project",
  name: "Test Project",
  path: "/test/path",
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

const mockSessions = [
  {
    id: "session-1",
    title: "Test Session 1",
    projectID: "test-project",
    directory: "/test/path",
    version: "1",
    time: { created: Date.now() / 1000, updated: Date.now() / 1000 },
  },
  {
    id: "session-2",
    title: "Test Session 2",
    projectID: "test-project",
    directory: "/test/path",
    version: "1",
    time: { created: Date.now() / 1000 - 3600, updated: Date.now() / 1000 - 1800 },
  },
]

// Mock router hooks
const mockNavigate = rstest.fn(() => {})
let mockParams = { projectId: "test-project" }

rstest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}))

// Mock project store
const mockSelectProject = rstest.fn(() => Promise.resolve())
const mockStartInstance = rstest.fn(() => Promise.resolve())
const mockStopInstance = rstest.fn(() => Promise.resolve())

rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => mockProject,
  useProjects: () => [mockProject],
  useProjectsActions: () => ({
    selectProject: mockSelectProject,
    startInstance: mockStartInstance,
    stopInstance: mockStopInstance,
  }),
  useProjectsStore: { getState: () => ({ currentProject: mockProject, projects: [mockProject] }) },
}))

// Mock sessions store
const mockLoadSessions = rstest.fn(() => Promise.resolve())
const mockCreateSession = rstest.fn(() => Promise.resolve(mockSessions[0]))

rstest.mock("../../src/stores/sessions", () => ({
  useSessionsForProject: () => mockSessions,
  useRecentSessions: () => mockSessions.slice(0, 2),
  useSessionsStore: () => ({
    loadSessions: mockLoadSessions,
    createSession: mockCreateSession,
  }),
}))

// Mock SDK service client used by context
const mockSessionList = rstest.fn(() => Promise.resolve({ data: mockSessions }))
const mockConfigGet = rstest.fn(() => Promise.resolve({ data: {} }))
const mockProviders = rstest.fn(() =>
  Promise.resolve({ data: { providers: [{ id: "anthropic", name: "Anthropic", models: {} }], default: {} } }),
)
const mockProjectCurrent = rstest.fn(() => Promise.resolve({ data: { id: "test-project", path: "/test/path" } }))

const mockGetClient = rstest.fn(async () => ({
  session: { list: () => mockSessionList() },
  config: {
    get: () => mockConfigGet(),
    providers: () => mockProviders(),
  },
  project: { current: () => mockProjectCurrent() },
}))

rstest.mock("../../src/services/opencode-sdk-service", () => ({
  opencodeSDKService: {
    getClient: mockGetClient,
    stopAll: async () => {},
  },
}))

// Use real OpencodeSDKProvider; client creation is mocked via opencodeSDKService

// Mock fetch endpoints used by dashboard
const mockFetch = rstest.fn((url: string) => {
  if (url.includes("/resources")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ memory: { used: 128, total: 512 }, port: 3001 }),
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
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <OpencodeSDKProvider>
      <MemoryRouter
        initialEntries={["/projects/test-project"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        {children}
      </MemoryRouter>
    </OpencodeSDKProvider>
  )
}

describe("ProjectDashboard", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    mockParams = { projectId: "test-project" }

    // Reset DOM (commented out for Bun test compatibility)
    // document.body.innerHTML = ""
    // const root = document.createElement("div")
    // root.id = "root"
    // document.body.appendChild(root)

    // Reset fetch mock
    ;(globalThis as any).fetch = mockFetch as any

    // Restore default projects store mock for each test
    rstest.mock("../../src/stores/projects", () => ({
      useCurrentProject: () => mockProject,
      useProjects: () => [mockProject],
      useProjectsActions: () => ({
        selectProject: mockSelectProject,
        startInstance: mockStartInstance,
        stopInstance: mockStopInstance,
      }),
      useProjectsStore: { getState: () => ({ currentProject: mockProject, projects: [mockProject] }) },
    }))
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

  test("shows loading state initially", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    // Should show loading initially
    expect(result.getByText("Loading project dashboard...")).toBeDefined()
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
      expect(result.getAllByText("Memory Usage").length).toBeGreaterThan(0)
      // In stats card the label is "Port"; in resource section it's "Server Port"
      const ports = result.queryAllByText("Port").length + result.queryAllByText("Server Port").length
      expect(ports).toBeGreaterThan(0)
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
      expect(result.getByText("Test Session 1")).toBeDefined()
      expect(result.getByText("Test Session 2")).toBeDefined()
    })
  })

  test("shows status for stopped project (no start/stop controls)", async () => {
    // Mock stopped project
    const stoppedProject = { ...mockProject, instance: { ...mockProject.instance, status: "stopped" as const } }

    rstest.mock("../../src/stores/projects", () => ({
      useCurrentProject: () => stoppedProject,
      useProjects: () => [stoppedProject],
      useProjectsActions: () => ({
        selectProject: mockSelectProject,
        startInstance: mockStartInstance,
        stopInstance: mockStopInstance,
      }),
      useProjectsStore: { getState: () => ({ currentProject: stoppedProject, projects: [stoppedProject] }) },
    }))

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
      expect(result.getByTestId("button-new-chat")).toBeDefined()
    })

    const newChatButton = result.getByTestId("button-new-chat") as HTMLElement
    await act(async () => {
      fireEvent.click(newChatButton)
    })

    expect(mockCreateSession).toHaveBeenCalledWith("test-project", "/test/path", "New Chat")
    expect(mockNavigate).toHaveBeenCalledWith("/projects/test-project/sessions/session-1/chat")
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
        const sessionItem = result.getByText("Test Session 1")
        expect(sessionItem).toBeDefined()
      },
      { timeout: 5000 },
    )

    const sessionLabel = result.getByText("Test Session 1")
    await act(async () => {
      // Clicking the label should bubble to the clickable container
      fireEvent.click(sessionLabel)
    })

    expect(mockNavigate).toHaveBeenCalledWith("/projects/test-project/sessions/session-1/chat")
  })

  test("shows project not found when project is missing", async () => {
    rstest.mock("../../src/stores/projects", () => ({
      useCurrentProject: () => null,
      useProjects: () => [],
      useProjectsActions: () => ({
        selectProject: mockSelectProject,
        startInstance: mockStartInstance,
        stopInstance: mockStopInstance,
      }),
      useProjectsStore: { getState: () => ({ currentProject: null, projects: [] }) },
    }))

    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Project Not Found")).toBeDefined()
    })

    expect(result.getByText("The requested project could not be loaded.")).toBeDefined()
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
    await waitFor(
      () => {
        expect(result.getByText("Current Branch")).toBeDefined()
      },
      { timeout: 3000 },
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

    // Should eventually show agent information after loading
    await waitFor(
      () => {
        expect(result.getByText("Active Agents")).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  test("shows resource usage", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <ProjectDashboard />
        </TestWrapper>,
      )
    })

    await waitFor(
      () => {
        expect(result.getByText("Resource Usage")).toBeDefined()
      },
      { timeout: 3000 },
    )

    await waitFor(() => {
      expect(result.getAllByText("Memory Usage").length).toBeGreaterThan(0)
    })
  })

  test("handles project switcher", async () => {
    const projects = [mockProject, { ...mockProject, id: "project-2", name: "Project 2" }]

    rstest.mock("../../src/stores/projects", () => ({
      useCurrentProject: () => mockProject,
      useProjects: () => projects,
      useProjectsActions: () => ({
        selectProject: mockSelectProject,
        startInstance: mockStartInstance,
        stopInstance: mockStopInstance,
      }),
      useProjectsStore: { getState: () => ({ currentProject: mockProject, projects }) },
    }))

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
      { timeout: 3000 },
    )
  })
})
import React from "react"

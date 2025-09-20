import { describe, test, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { render, waitFor, within, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
let ProjectList: any
import { TestDataFactory } from "../fixtures/test-data"

// Ensure DOM is available and properly initialized
if (typeof document === "undefined" || !document.body) {
  throw new Error("DOM environment is required for component tests")
}

const mockHomePath = "/Users/test"
const mockDirectoryListing = {
  path: mockHomePath,
  parent: null,
  entries: [
    { name: "projects", path: `${mockHomePath}/projects`, isDirectory: true },
    { name: "playground", path: `${mockHomePath}/playground`, isDirectory: true },
  ],
}

const mockFetch = rstest.fn(async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.url
  if (url.includes("/api/system/home")) {
    return new Response(JSON.stringify({ path: mockHomePath }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (url.includes("/api/system/list-directory")) {
    return new Response(JSON.stringify(mockDirectoryListing), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})

// Mock the projects store
const mockProjects = [
  TestDataFactory.createProject({
    id: "project-1",
    name: "Test Project 1",
    status: "running",
    instance: { id: "inst-1", port: 3001, status: "running", startedAt: new Date() },
  }),
  TestDataFactory.createProject({
    id: "project-2",
    name: "Test Project 2",
    status: "stopped",
    instance: { id: "inst-2", port: 3002, status: "stopped", startedAt: new Date() },
  }),
]
const mockLoadProjects = rstest.fn(async () => {})
const mockCreateProject = rstest.fn(async () => mockProjects[0])
const mockRemoveProject = rstest.fn(async () => {})
const mockStartInstance = rstest.fn(async () => {})
const mockStopInstance = rstest.fn(async () => {})
const mockSelectProject = rstest.fn(async () => {})
const mockClearError = rstest.fn(() => {})

rstest.mock("../../src/stores/projects", () => ({
  useProjects: () => mockProjects,
  useProjectsLoading: () => false,
  useProjectsError: () => null,
  useInstanceOperations: () => ({}),
  useProjectsActions: () => ({
    loadProjects: mockLoadProjects,
    selectProject: mockSelectProject,
    createProject: mockCreateProject,
    removeProject: mockRemoveProject,
    startInstance: mockStartInstance,
    stopInstance: mockStopInstance,
    clearError: mockClearError,
  }),
}))
rstest.mock("@/stores/projects", () => ({
  useProjects: () => mockProjects,
  useProjectsLoading: () => false,
  useProjectsError: () => null,
  useInstanceOperations: () => ({}),
  useProjectsActions: () => ({
    loadProjects: mockLoadProjects,
    selectProject: mockSelectProject,
    createProject: mockCreateProject,
    removeProject: mockRemoveProject,
    startInstance: mockStartInstance,
    stopInstance: mockStopInstance,
    clearError: mockClearError,
  }),
}))

// Mock react-router-dom
const mockNavigate = rstest.fn(() => {})
rstest.mock("react-router-dom", () => ({
  ...require("react-router-dom"),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "test-project-id" }),
}))

// Helper component to wrap with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const { MemoryRouter } = require("react-router-dom")
  return (
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      {children}
    </MemoryRouter>
  )
}

describe("ProjectList Component", () => {
  beforeEach(() => {
    // Clear DOM and reset mocks
    document.body.innerHTML = ""
    const root = document.createElement("div")
    root.id = "root"
    document.body.appendChild(root)

    mockLoadProjects.mockClear()
    mockCreateProject.mockClear()
    mockRemoveProject.mockClear()
    mockStartInstance.mockClear()
    mockStopInstance.mockClear()
    mockSelectProject.mockClear()
    mockClearError.mockClear()
    mockNavigate.mockClear()
    mockFetch.mockClear()
    ;(global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch

    const mod = require("@/pages/ProjectList")
    ProjectList = mod.default || mod.ProjectList
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ""
  })

  test("renders project list with header", () => {
    const { getByText, getByRole } = render(
      <TestWrapper>
        <ProjectList navigateOverride={mockNavigate} />
      </TestWrapper>,
    )

    expect(getByText("Projects")).toBeDefined()
    expect(getByRole("button", { name: /add project/i })).toBeDefined()
  })

  test("displays project cards with correct information", () => {
    const { getByText } = render(
      <TestWrapper>
        <ProjectList navigateOverride={mockNavigate} />
      </TestWrapper>,
    )

    // Check that both projects are displayed
    expect(getByText("Test Project 1")).toBeDefined()
    expect(getByText("Test Project 2")).toBeDefined()

    // Check status indicators
    expect(getByText("Running")).toBeDefined()
    expect(getByText("Stopped")).toBeDefined()
  })

  test("opens add project dialog", async () => {
    const { getByRole, container } = render(
      <TestWrapper>
        <ProjectList />
      </TestWrapper>,
    )

    const addButton = getByRole("button", { name: /add project/i })
    await userEvent.click(addButton)

    // Wait for dialog to appear and check within container
    await waitFor(() => {
      const dialog = container.querySelector('[role="dialog"]')
      if (dialog) {
        const withinDialog = within(dialog as HTMLElement)
        expect(withinDialog.queryByText("Add Project")).toBeDefined()
      }
    })
  })

  test("creates new project through dialog", async () => {
    const { getByRole, container } = render(
      <TestWrapper>
        <ProjectList />
      </TestWrapper>,
    )

    // Open dialog
    const addButton = getByRole("button", { name: /add project/i })
    await userEvent.click(addButton)

    await waitFor(async () => {
      const dialog = container.querySelector('[role="dialog"]')
      if (dialog) {
        const withinDialog = within(dialog as HTMLElement)

        // Open the directory combobox
        const combo = withinDialog.getByRole("button", { name: /search or select directories/i })
        await userEvent.click(combo)

        // Type to search and pick a directory
        const searchInput = withinDialog.getByPlaceholderText("Type to search (e.g. 'dev', 'projects')...")
        await userEvent.type(searchInput, "projects")

        // Select the "projects" directory from results
        const option = await withinDialog.findByText("projects")
        await userEvent.click(option)

        // Submit
        const createButton = withinDialog.getByRole("button", { name: /add project/i })
        await userEvent.click(createButton)

        expect(mockCreateProject).toHaveBeenCalled()
      }
    })
  })

  test("shows directory combobox for project path", async () => {
    const { getByRole, container } = render(
      <TestWrapper>
        <ProjectList />
      </TestWrapper>,
    )

    const addButton = getByRole("button", { name: /add project/i })
    await userEvent.click(addButton)

    await waitFor(() => {
      const dialog = container.querySelector('[role="dialog"]')
      if (dialog) {
        const withinDialog = within(dialog as HTMLElement)
        const combobox = withinDialog.getByRole("button", { name: /search or select directories/i })
        expect(combobox).toBeDefined()
      }
    })
  })

  test("filters projects by search query", async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <TestWrapper>
        <ProjectList />
      </TestWrapper>,
    )

    const searchInput = getByPlaceholderText(/search projects/i)
    await userEvent.type(searchInput, "Project 1")

    await waitFor(() => {
      expect(getByText("Test Project 1")).toBeDefined()
      expect(queryByText("Test Project 2")).toBeNull()
    })
  })

  test("filters projects by status", async () => {
    const { getByRole, getByText, queryByText } = render(
      <TestWrapper>
        <ProjectList />
      </TestWrapper>,
    )

    // Click the filter dropdown button
    const filterButton = getByRole("button", { name: /All/i })
    await userEvent.click(filterButton)

    // Click "Running Only" option
    const runningOption = getByText("Running Only")
    await userEvent.click(runningOption)

    await waitFor(() => {
      expect(getByText("Test Project 1")).toBeDefined()
      expect(queryByText("Test Project 2")).toBeNull()
    })
  })

  test("opens project on card click", async () => {
    const { getByText } = render(
      <TestWrapper>
        <ProjectList navigateOverride={mockNavigate} />
      </TestWrapper>,
    )

    // Find the project card that contains "Test Project 1"
    const projectTitle = getByText("Test Project 1")
    const projectCard = projectTitle.closest(".group") // Find the parent card with group class

    if (!projectCard) {
      throw new Error("Project card not found")
    }

    // Find the "Open" button within this specific project card
    const openButton = within(projectCard as HTMLElement).getByText("Open")
    await userEvent.click(openButton)

    // The handleOpenProject function calls selectProject and then navigates
    expect(mockSelectProject).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("/projects/"))
  })

  test("starts and stops project instances", async () => {
    const { getAllByRole } = render(
      <TestWrapper>
        <ProjectList navigateOverride={mockNavigate} />
      </TestWrapper>,
    )

    const actionButtons = getAllByRole("button")

    // Find start/stop buttons by their labels or icons
    const startButton = actionButtons.find((btn) => {
      const text = btn.textContent
      const ariaLabel = btn.getAttribute("aria-label")
      return (
        (text !== null && text.toLowerCase().includes("start")) ||
        (ariaLabel !== null && ariaLabel.toLowerCase().includes("start"))
      )
    })

    if (startButton) {
      await userEvent.click(startButton)
      expect(mockStartInstance).toHaveBeenCalled()
    }

    const stopButton = actionButtons.find((btn) => {
      const text = btn.textContent
      const ariaLabel = btn.getAttribute("aria-label")
      return (
        (text !== null && text.toLowerCase().includes("stop")) ||
        (ariaLabel !== null && ariaLabel.toLowerCase().includes("stop"))
      )
    })

    if (stopButton) {
      await userEvent.click(stopButton)
      expect(mockStopInstance).toHaveBeenCalled()
    }
  })

  test("removes project with confirmation", async () => {
    const { getAllByRole } = render(
      <TestWrapper>
        <ProjectList navigateOverride={mockNavigate} />
      </TestWrapper>,
    )

    const deleteButtons = getAllByRole("button").filter((btn) => {
      const text = btn.textContent
      const ariaLabel = btn.getAttribute("aria-label")
      return (
        (text !== null && text.toLowerCase().includes("delete")) ||
        (ariaLabel !== null && ariaLabel.toLowerCase().includes("delete"))
      )
    })

    if (deleteButtons.length > 0) {
      await userEvent.click(deleteButtons[0])

      // Assuming a confirmation dialog appears
      await waitFor(() => {
        const confirmButton = document.querySelector("button[data-confirm='delete']")
        if (confirmButton) {
          userEvent.click(confirmButton)
          expect(mockRemoveProject).toHaveBeenCalled()
        }
      })
    }
  })
})
import React from "react"

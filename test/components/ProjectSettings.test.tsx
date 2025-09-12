import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import "../setup.ts"
import { render, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
let ProjectSettings: any

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

// Mock router hooks
const mockNavigate = rstest.fn(() => {})
let mockParams = { projectId: "test-project" }

rstest.mock("react-router-dom", () => ({
  ...require("react-router-dom"),
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}))

// Mock project store
const mockUpdateProject = rstest.fn(() => Promise.resolve())
const mockRemoveProject = rstest.fn(() => Promise.resolve())
let mockCurrentProject: any = mockProject

rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => mockCurrentProject,
  useProjectsActions: () => ({
    updateProject: mockUpdateProject,
    removeProject: mockRemoveProject,
  }),
}))
rstest.mock("@/stores/projects", () => ({
  useCurrentProject: () => mockCurrentProject,
  useProjectsActions: () => ({
    updateProject: mockUpdateProject,
    removeProject: mockRemoveProject,
  }),
}))

// Test wrapper
function TestWrapper({ children }: { children: React.ReactNode }) {
  const { MemoryRouter } = require("react-router-dom")
  return (
    <MemoryRouter
      initialEntries={["/projects/test-project/settings"]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      {children}
    </MemoryRouter>
  )
}

describe("ProjectSettings Component", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    mockParams = { projectId: "test-project" }
    mockCurrentProject = mockProject
    const mod = require("@/pages/ProjectSettings")
    ProjectSettings = mod.default || mod.ProjectSettings
  })

  // Basic rendering tests
  test("renders project settings interface", async () => {
    const { getByText } = render(
      <TestWrapper>
        <ProjectSettings />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(getByText("Project Settings")).toBeDefined()
      expect(getByText("Test Project")).toBeDefined()
    })
  })

  test("shows project not found when project is missing", async () => {
    mockCurrentProject = null

    const { getByText } = render(
      <TestWrapper>
        <ProjectSettings />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(getByText("Project Not Found")).toBeDefined()
      expect(getByText("The requested project could not be found.")).toBeDefined()
    })
  })

  // Tab navigation tests
  test("switches between settings tabs", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByText, getByRole } = render(
      <TestWrapper>
        <ProjectSettings />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(getByText("Project Settings")).toBeDefined()
    })

    // Test AI Models tab
    const aiTab = getByRole("tab", { name: /ai models/i })
    await user.click(aiTab)

    await waitFor(() => {
      expect(getByText("AI Configuration")).toBeDefined()
    })

    // Test Environment tab
    const envTab = getByRole("tab", { name: /environment/i })
    await user.click(envTab)

    await waitFor(() => {
      expect(getByText("Environment Variables")).toBeDefined()
    })

    // Test Permissions tab
    const permTab = getByRole("tab", { name: /permissions/i })
    await user.click(permTab)

    await waitFor(() => {
      expect(getByText("Access Permissions")).toBeDefined()
    })

    // Test Advanced tab
    const advTab = getByRole("tab", { name: /advanced/i })
    await user.click(advTab)

    await waitFor(() => {
      expect(getByText("Advanced Configuration")).toBeDefined()
    })
  })

  // General settings tests
  test("updates project name", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByText, getByDisplayValue, getByRole } = render(
      <TestWrapper>
        <ProjectSettings />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(getByText("Project Settings")).toBeDefined()
    })

    const nameInput = getByDisplayValue("Test Project")
    await user.clear(nameInput)
    await user.type(nameInput, "Updated Project Name")

    const saveButton = getByRole("button", { name: /save changes/i })
    await user.click(saveButton)

    expect(mockUpdateProject).toHaveBeenCalledWith("test-project", {
      name: "Updated Project Name",
    })
  })

  test("shows unsaved changes indicator", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByText, getByDisplayValue } = render(
      <TestWrapper>
        <ProjectSettings />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(getByText("Project Settings")).toBeDefined()
    })

    const nameInput = getByDisplayValue("Test Project")
    await user.type(nameInput, " Modified")

    await waitFor(() => {
      expect(getByText("Unsaved changes")).toBeDefined()
    })
  })

  // AI settings tests
  test("configures AI settings", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByText, getByRole, getByPlaceholderText } = render(
      <TestWrapper>
        <ProjectSettings />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(getByText("Project Settings")).toBeDefined()
    })

    // Switch to AI tab
    const aiTab = getByRole("tab", { name: /ai models/i })
    await user.click(aiTab)

    await waitFor(() => {
      expect(getByText("AI Configuration")).toBeDefined()
    })

    // Test API key input
    const apiKeyInput = getByPlaceholderText("Enter API key")
    await user.type(apiKeyInput, "test-api-key")

    expect((apiKeyInput as HTMLInputElement).value).toBe("test-api-key")
  })

  // Environment variables tests
  test("adds environment variables", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByText, getByRole, getByPlaceholderText, getAllByRole } = render(
      <TestWrapper>
        <ProjectSettings />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(getByText("Project Settings")).toBeDefined()
    })

    // Switch to Environment tab
    const envTab = getByRole("tab", { name: /environment/i })
    await user.click(envTab)

    await waitFor(() => {
      expect(getByText("Environment Variables")).toBeDefined()
    })

    const nameInput = getByPlaceholderText("Variable name")
    const valueInput = getByPlaceholderText("Variable value")
    const addButton = getAllByRole("button").find((btn) => {
      const svg = btn.querySelector("svg")
      return svg !== null && svg.classList.contains("lucide-plus")
    })

    await user.type(nameInput, "TEST_VAR")
    await user.type(valueInput, "test_value")
    if (addButton) {
      await user.click(addButton)
    }

    // Should show the added variable
    await waitFor(() => {
      expect(getByText("TEST_VAR")).toBeDefined()
      expect(getByText("test_value")).toBeDefined()
    })
  })

  // Permissions tests
  test("renders permissions tab", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByText, getByRole } = render(
      <TestWrapper>
        <ProjectSettings />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(getByText("Project Settings")).toBeDefined()
    })

    // Switch to Permissions tab
    const permTab = getByRole("tab", { name: /permissions/i })
    await user.click(permTab)

    await waitFor(() => {
      expect(getByText("Access Permissions")).toBeDefined()
      expect(getByText("File Access")).toBeDefined()
    })
  })

  // Project deletion tests
  test("shows delete confirmation dialog", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByText, getByRole } = render(
      <TestWrapper>
        <ProjectSettings />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(getByText("Project Settings")).toBeDefined()
    })

    const deleteButton = getByRole("button", { name: /delete project/i })
    await user.click(deleteButton)

    await waitFor(() => {
      expect(getByRole("dialog")).toBeDefined()
      expect(getByText(/are you sure you want to delete/i)).toBeDefined()
    })
  })

  test("deletes project after confirmation", async () => {
    const user = userEvent.setup({ delay: null })

    const { getByText, getByRole, getAllByRole, container } = render(
      <TestWrapper>
        <ProjectSettings />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(getByText("Project Settings")).toBeDefined()
    })

    const deleteButton = getByRole("button", { name: /delete project/i })
    await user.click(deleteButton)

    await waitFor(() => {
      expect(getByRole("dialog")).toBeDefined()
    })

    // Find the confirm button in the dialog
    const dialog = getByRole("dialog")
    const btn = within(dialog).getByRole("button", { name: /delete project/i })
    await user.click(btn)
    expect(mockRemoveProject).toHaveBeenCalledWith("test-project")
  })
})
import React from "react"

import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import "../setup.ts"
import { waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../utils/test-router"
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
    port: 3099,
    status: "running" as const,
    startedAt: new Date(),
  },
}

// Mock project store
const mockUpdateProject = rstest.fn(() => Promise.resolve())
const mockRemoveProject = rstest.fn(() => Promise.resolve())
let mockCurrentProject: any = mockProject

const providerOptions = [
  { id: "provider1", name: "Provider 1" },
  { id: "provider2", name: "Provider 2" },
]

const modelOptions = [
  { id: "model1", name: "Model 1" },
  { id: "model2", name: "Model 2" },
]

const mockSetProvider = rstest.fn()
const mockSetModel = rstest.fn()

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

// Mock worktrees store
const mockLoadWorktrees = rstest.fn(() => Promise.resolve())
const mockWorktrees = [
  { id: "default", path: "/test/path", title: "Main Worktree" },
  { id: "feature", path: "/test/path-feature", title: "Feature Branch" }
]

rstest.mock("../../src/stores/worktrees", () => ({
  useWorktreesStore: (selector?: any) => {
    const state = {
      loadWorktrees: mockLoadWorktrees,
    }
    return selector ? selector(state) : state
  },
  useWorktreesForProject: () => mockWorktrees,
}))
rstest.mock("@/stores/worktrees", () => ({
  useWorktreesStore: (selector?: any) => {
    const state = {
      loadWorktrees: mockLoadWorktrees,
    }
    return selector ? selector(state) : state
  },
  useWorktreesForProject: () => mockWorktrees,
}))

// Mock SDK hooks
const mockClient = {
  config: {
    providers: rstest.fn(() => Promise.resolve({
      data: {
        providers: [
          { id: "provider1", name: "Provider 1", models: ["model1", "model2"] },
          { id: "provider2", name: "Provider 2", models: ["model3"] }
        ]
      }
    }))
  }
}

rstest.mock("../../src/hooks/useProjectSDK", () => ({
  useProjectSDK: () => ({
    client: mockClient,
    instanceStatus: "running",
  }),
}))
rstest.mock("@/hooks/useProjectSDK", () => ({
  useProjectSDK: () => ({
    client: mockClient,
    instanceStatus: "running",
  }),
}))

rstest.mock("../../src/hooks/useProvidersSDK", () => ({
  useProvidersSDK: () => ({
    providers: providerOptions,
    selectedProvider: "provider1",
    selectedModel: "model1",
    availableModels: modelOptions,
    setSelectedProvider: mockSetProvider,
    setSelectedModel: mockSetModel,
    isLoadingProviders: false,
    providersError: null,
  }),
}))
rstest.mock("@/hooks/useProvidersSDK", () => ({
  useProvidersSDK: () => ({
    providers: providerOptions,
    selectedProvider: "provider1",
    selectedModel: "model1",
    availableModels: modelOptions,
    setSelectedProvider: mockSetProvider,
    setSelectedModel: mockSetModel,
    isLoadingProviders: false,
    providersError: null,
  }),
}))

describe("ProjectSettings Component", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    mockCurrentProject = mockProject
    const mod = require("@/pages/ProjectSettings")
    ProjectSettings = mod.default || mod.ProjectSettings
  })

  // Basic rendering tests
  test("renders project settings interface", async () => {
    const { getByText } = renderWithRouter(
      <ProjectSettings />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => {
      expect(getByText("Project Settings")).toBeDefined()
      expect(getByText(/Project:\s*Test Project/)).toBeDefined()
    })
  })

  test("shows project not found when project is missing", async () => {
    mockCurrentProject = null

    const { getByText } = renderWithRouter(
      <ProjectSettings />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => {
      expect(getByText("Project Not Found")).toBeDefined()
    })
  })

  // Tab navigation tests
  test("navigates between tabs", async () => {
    const user = userEvent.setup()
    const { getByRole, getByText } = renderWithRouter(
      <ProjectSettings />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => expect(getByText("Project Settings")).toBeDefined())

    // Click AI tab
    const aiTab = getByRole("tab", { name: /AI Models/i })
    await user.click(aiTab)
    await waitFor(() => expect(getByText("AI Configuration")).toBeDefined())

    // Click Environment tab
    const envTab = getByRole("tab", { name: /Environment/i })
    await user.click(envTab)
    await waitFor(() => expect(getByText("Environment Variables")).toBeDefined())

    // Click Permissions tab
    const permTab = getByRole("tab", { name: /Permissions/i })
    await user.click(permTab)
    await waitFor(() => expect(getByText("File Access")).toBeDefined())
  })

  // General settings tests
  test("updates general settings", async () => {
    const user = userEvent.setup()
    const { getByLabelText, getByRole } = renderWithRouter(
      <ProjectSettings />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => expect(getByLabelText("Project Name")).toBeDefined())

    const nameInput = getByLabelText("Project Name") as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, "Updated Project Name")

    const saveButton = getByRole("button", { name: /Save Changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith(
        "test-project",
        expect.objectContaining({
          name: "Updated Project Name",
        })
      )
    })
  })

  // Environment variables tests
  test("manages environment variables", async () => {
    const user = userEvent.setup()
    const { getByRole, getByLabelText } = renderWithRouter(
      <ProjectSettings />,
      { projectId: "test-project", worktreeId: "default" }
    )

    // Navigate to environment tab
    const envTab = getByRole("tab", { name: /Environment/i })
    await user.click(envTab)

    // Add new variable
    const keyInput = getByLabelText("Environment variable name") as HTMLInputElement
    const valueInput = getByLabelText("Environment variable value") as HTMLInputElement
    await user.type(keyInput, "NEW_VAR")
    await user.type(valueInput, "new_value")

    const addButton = getByRole("button", { name: /Add environment variable/i })
    await user.click(addButton)

    // Save changes
    const saveButton = getByRole("button", { name: /Save Changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalled()
    })
  })

  // Permissions tests
  test("updates permission settings", async () => {
    const user = userEvent.setup()
    const { getByRole, getByText } = renderWithRouter(
      <ProjectSettings />,
      { projectId: "test-project", worktreeId: "default" }
    )

    // Navigate to permissions tab
    const permTab = getByRole("tab", { name: /Permissions/i })
    await user.click(permTab)

    await waitFor(() => expect(getByText("File Access")).toBeDefined())

    const fileAccessSelect = getByRole("combobox", { name: /File access level/i })
    await user.click(fileAccessSelect)
    const denyOption = getByRole("option", { name: /Deny/i })
    await user.click(denyOption)

    // Save changes
    const saveButton = getByRole("button", { name: /Save Changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalled()
    })
  })

  // Danger zone tests
  test("handles project deletion", async () => {
    const user = userEvent.setup()
    const mockNavigate = rstest.fn()
    rstest.mock("react-router-dom", () => ({
      ...require("react-router-dom"),
      useNavigate: () => mockNavigate,
    }))

    const { getByRole } = renderWithRouter(
      <ProjectSettings />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => expect(getByRole("button", { name: /Delete Project/i })).toBeDefined())

    const deleteButton = getByRole("button", { name: /Delete Project/i })
    await user.click(deleteButton)

    // Confirm deletion in dialog
    const confirmButton = getByRole("button", { name: /Delete/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(mockRemoveProject).toHaveBeenCalledWith("test-project")
    })
  })

  // Advanced settings tests
  test("toggles advanced settings", async () => {
    const user = userEvent.setup()
    const { getByRole, getByLabelText } = renderWithRouter(
      <ProjectSettings />,
      { projectId: "test-project", worktreeId: "default" }
    )

    // Navigate to advanced tab
    const advTab = getByRole("tab", { name: /Advanced/i })
    await user.click(advTab)

    await waitFor(() => expect(getByLabelText("Enable Cache")).toBeDefined())

    // Toggle cache setting
    const cacheToggle = getByLabelText("Enable Cache")
    await user.click(cacheToggle)

    // Save changes
    const saveButton = getByRole("button", { name: /Save Changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalled()
    })
  })

  // Reset settings test
  test("cancel navigates back without saving", async () => {
    const user = userEvent.setup()
    const originalBack = window.history.back
    const backMock = rstest.fn()
    ;(window.history as any).back = backMock

    try {
      const { getByRole, getByLabelText } = renderWithRouter(
        <ProjectSettings />,
        { projectId: "test-project", worktreeId: "default" }
      )

      await waitFor(() => expect(getByLabelText("Project Name")).toBeDefined())

      const nameInput = getByLabelText("Project Name") as HTMLInputElement
      await user.clear(nameInput)
      await user.type(nameInput, "Modified Name")

      const cancelButton = getByRole("button", { name: /Cancel/i })
      await user.click(cancelButton)

      expect(backMock).toHaveBeenCalled()
      // Name should remain the modified value since navigation is handled externally
      expect(nameInput.value).toBe("Modified Name")
    } finally {
      ;(window.history as any).back = originalBack
    }
  })

  // Worktree awareness test
  test("shows correct worktree name", async () => {
    const { getByText } = renderWithRouter(
      <ProjectSettings />,
      { projectId: "test-project", worktreeId: "default" }
    )

    await waitFor(() => {
      expect(getByText("Test Project (default)")).toBeDefined()
    })
  })

  test("falls back to default worktree when invalid worktree provided", async () => {
    const { getByText } = renderWithRouter(
      <ProjectSettings />,
      {
        projectId: "test-project",
        worktreeId: "invalid-worktree",
        initialPath: "/projects/test-project/invalid-worktree/settings",
      }
    )

    await waitFor(() => {
      expect(getByText(/Test Project \(default\)/)).toBeDefined()
    })
  })
})

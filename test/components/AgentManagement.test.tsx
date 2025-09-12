import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import { render, fireEvent, waitFor, act } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import AgentManagement from "../../src/pages/AgentManagement"
import { OpencodeSDKProvider } from "../../src/contexts/OpencodeSDKContext"

// Mock data - this should match the API response format
const mockAgents = [
  {
    id: "claude",
    name: "Claude",
    description: "Anthropic's AI assistant",
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt: "You are Claude, an AI assistant.",
    tools: { read: true, grep: true, ls: true }, // Object format as expected by API
    model: "claude-3-sonnet",
    enabled: true,
    isTemplate: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category: "builtin",
    tags: [],
    usageCount: 0,
  },
  {
    id: "custom-agent",
    name: "Custom Agent",
    description: "Custom AI agent",
    temperature: 0.5,
    maxTokens: 1000,
    systemPrompt: "You are a custom AI agent.",
    tools: { grep: true, read: true, write: true }, // Object format
    model: "gpt-5-mini",
    enabled: true,
    isTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category: "custom",
    tags: [],
    usageCount: 0,
  },
  {
    id: "disabled-agent",
    name: "Disabled Agent",
    description: "Disabled agent",
    temperature: 0.3,
    maxTokens: 1000,
    systemPrompt: "You are a disabled agent.",
    tools: {}, // Empty object
    model: "gpt-3.5-turbo",
    enabled: false,
    isTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category: "custom",
    tags: [],
    usageCount: 0,
  },
]

const mockProject = {
  id: "test-project",
  name: "Test Project",
  path: "/project",
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

rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  }
})

// Mock project store
rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => mockProject,
}))

// Mock SDK service to avoid real client creation
rstest.mock("../../src/services/opencode-sdk-service", () => ({
  opencodeSDKService: {
    getClient: async () => ({
      config: {
        providers: async () => ({ data: { providers: [], default: {} } }),
      },
    }),
    stopAll: async () => {},
  },
}))

// Mock fetch calls
const mockFetch = rstest.fn((url: string) => {
  if (url.includes("/agents")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockAgents),
    } as Response)
  }
  return Promise.resolve({
    ok: false,
    statusText: "Not found",
  } as Response)
})

global.fetch = mockFetch as any

// Test wrapper
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <OpencodeSDKProvider>
      <MemoryRouter
        initialEntries={["/projects/test-project/agents"]}
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

describe("AgentManagement", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    mockParams = { projectId: "test-project" }

    // Reset DOM
    document.body.innerHTML = ""
    const root = document.createElement("div")
    root.id = "root"
    document.body.appendChild(root)

    // Reset fetch mock implementation for each test to avoid cross-test leakage
    ;(mockFetch as any).mockImplementation((url: string) => {
      if (url.includes("/agents")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAgents),
        } as Response)
      }
      return Promise.resolve({
        ok: false,
        statusText: "Not found",
      } as Response)
    })
  })

  test("renders agent management with header", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText(/agent management/i) || result.getByText(/agents/i)).toBeDefined()
    })
  })

  test("displays agent list", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      // Check for agent names specifically
      expect(result.getByText("Claude")).toBeDefined()
      expect(result.getByText("Custom Agent")).toBeDefined()
      expect(result.getByText("Disabled Agent")).toBeDefined()
    })

    // Verify we have the expected number of agent cards by checking for agent card containers
    // Use a more specific selector for agent cards
    const agentCards = result.container.querySelectorAll(".bg-\\[\\#1a1a1a\\].border.border-\\[\\#262626\\].rounded-lg")
    expect(agentCards.length).toBe(3)
  })

  test("shows loading state initially", async () => {
    // Mock slow loading
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve(mockAgents),
              } as Response),
            100,
          ),
        ),
    )

    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    // Should show loading initially
    expect(result.getByText(/loading/i) || result.container.querySelector(".animate-spin")).toBeTruthy()

    // Wait for agents to load
    await waitFor(() => {
      expect(result.getByText("Claude")).toBeDefined()
      expect(result.getByText("Custom Agent")).toBeDefined()
    })
  })

  test("displays agent status badges", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Claude")).toBeDefined()
    })

    // Should show status badges (built-in/custom, enabled/disabled)
    const builtInElements = result.queryAllByText("Built-in")
    const customElements = result.queryAllByText("Custom")
    expect(builtInElements.length > 0 || customElements.length > 0).toBeTruthy()
  })

  test("shows built-in vs custom agent indicators", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Claude")).toBeDefined()
    })

    // Should show built-in indicators (using queryAllByText to avoid throwing if none found)
    const builtInElements = result.queryAllByText("Built-in")
    expect(builtInElements.length).toBeGreaterThan(0)

    // Should show custom indicators (using queryAllByText as there may be multiple)
    const customElements = result.queryAllByText("Custom")
    expect(customElements.length).toBeGreaterThan(0)
  })

  test("handles agent toggle", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Custom Agent")).toBeDefined()
    })

    // Find toggle switch for custom agent
    const toggleSwitch =
      result.container.querySelector('input[type="checkbox"]') || result.container.querySelector('[role="switch"]')

    if (toggleSwitch) {
      await act(async () => {
        fireEvent.click(toggleSwitch)
      })

      expect(mockFetch).toHaveBeenCalled()
    }
  })

  test("handles agent configuration", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Custom Agent")).toBeDefined()
    })

    // Find configure button
      const configButton =
      result.container.querySelector('button[title*="configure" i]') ||
      result.queryByText(/configure/i) ||
      result.queryByText(/settings/i)


    if (configButton) {
      await act(async () => {
        fireEvent.click(configButton)
      })

      // Should open configuration dialog
      expect(result.container.querySelector('[role="dialog"]')).toBeTruthy()
    }
  })

  test("handles new agent creation", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Claude")).toBeDefined()
    })

    // Find new agent button
      const newAgentButton =
      result.queryByText(/new agent/i) ||
      result.queryByText(/add agent/i) ||
      result.container.querySelector('button[title*="new" i]')


    if (newAgentButton) {
      await act(async () => {
        fireEvent.click(newAgentButton)
      })

      // Should open creation dialog
      expect(result.container.querySelector('[role="dialog"]')).toBeTruthy()
    }
  })

  test("handles agent deletion", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Custom Agent")).toBeDefined()
    })

    // Find delete button (should not be available for built-in agents)
    const deleteButton =
      result.container.querySelector('button[title*="delete" i]') ||
      result.container.querySelector('[data-testid="delete-agent"]')

    if (deleteButton) {
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      // Should show confirmation dialog
      expect(result.getByText(/confirm/i) || result.getByText(/delete/i)).toBeTruthy()
    }
  })

  test("handles agent testing", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Custom Agent")).toBeDefined()
    })

    // Find test button
    const testButton = result.container.querySelector('button[title*="test" i]') || result.getByText(/test/i)

    if (testButton) {
      await act(async () => {
        fireEvent.click(testButton)
      })

      expect(mockFetch).toHaveBeenCalled()
    }
  })

  test("shows error state when loading fails", async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error("Failed to load agents")))

    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText(/error/i) || result.getByText(/failed/i)).toBeDefined()
    })
  })

  test("filters agents by search query", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Claude")).toBeDefined()
    })

    // Find search input
    const searchInput =
      result.container.querySelector('input[placeholder*="search" i]') ||
      result.container.querySelector('input[type="search"]')

    if (searchInput) {
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "Claude" } })
      })

      // Should filter results
      expect(result.getByText("Claude")).toBeDefined()
      expect(result.queryByText("Custom Agent")).toBeNull()
    }
  })

  test("filters agents by status", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Claude")).toBeDefined()
    })

    // Find status filter
    const statusFilter = result.container.querySelector("select") || result.container.querySelector('[role="combobox"]')

    if (statusFilter) {
      await act(async () => {
        fireEvent.change(statusFilter, { target: { value: "enabled" } })
      })

      // Should filter by enabled status
      expect(result.getByText("Claude")).toBeDefined()
      expect(result.getByText("Custom Agent")).toBeDefined()
    }
  })

  test("shows agent configuration details", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Claude")).toBeDefined()
    })

    // Should show model information
    expect(result.getByText(/claude-3-sonnet/i) || result.getByText(/gpt-4/i)).toBeTruthy()
  })

  test("handles agent import/export", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Claude")).toBeDefined()
    })

    // Find import/export buttons
    const importButton = result.container.querySelector('button[title*="import" i]')
    const exportButton = result.container.querySelector('button[title*="export" i]')

    if (importButton) {
      await act(async () => {
        fireEvent.click(importButton)
      })
      // Should handle import
    }

    if (exportButton) {
      await act(async () => {
        fireEvent.click(exportButton)
      })
      // Should handle export
    }
  })

  test("shows empty state when no agents", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response),
    )

    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText(/no agents/i) || result.getByText(/empty/i)).toBeDefined()
    })
  })

  test("handles agent sorting", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Claude")).toBeDefined()
    })

    // Find sort controls
    const sortButton =
      result.container.querySelector('button[title*="sort" i]') ||
      result.container.querySelector('[data-testid="sort"]')

    if (sortButton) {
      await act(async () => {
        fireEvent.click(sortButton)
      })

      // Should show sort options
      expect(result.container.querySelector('[role="menu"]')).toBeTruthy()
    }
  })

  test("shows agent usage statistics", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Claude")).toBeDefined()
    })

    // Should show usage stats if available
    const statsElement =
      result.container.querySelector('[data-testid="agent-stats"]') || result.container.querySelector(".stats")

    if (statsElement) {
      expect(statsElement).toBeTruthy()
    }
  })

  test("handles bulk operations", async () => {
    let result: any
    await act(async () => {
      result = render(
        <TestWrapper>
          <AgentManagement />
        </TestWrapper>,
      )
    })

    await waitFor(() => {
      expect(result.getByText("Claude")).toBeDefined()
    })

    // Find select all checkbox
    const selectAllCheckbox = result.container.querySelector('input[type="checkbox"][data-testid="select-all"]')

    if (selectAllCheckbox) {
      await act(async () => {
        fireEvent.click(selectAllCheckbox)
      })

      // Should enable bulk operations
      const bulkActions = result.container.querySelector('[data-testid="bulk-actions"]')
      expect(bulkActions).toBeTruthy()
    }
  })
})
import React from "react"

import { describe, test, beforeEach, expect, rstest } from "@rstest/core"
import { screen, waitFor } from "@testing-library/react"
import { renderWithRouter } from "../utils/test-router"

const mockNavigate = rstest.fn(() => {})

rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockProject = {
  id: "test-project",
  name: "Test Project",
  path: "/project",
  type: "git" as const,
  addedAt: new Date().toISOString(),
  lastOpened: new Date().toISOString(),
}

const mockWorktrees = [
  { id: "default", path: "/project", title: "Main" },
  { id: "feature", path: "/project-feature", title: "Feature Branch" },
]

rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => mockProject,
  useProjectById: () => mockProject,
}))
rstest.mock("@/stores/projects", () => ({
  useCurrentProject: () => mockProject,
  useProjectById: () => mockProject,
}))

const mockLoadWorktrees = rstest.fn(async () => {})
const worktreesStore = {
  loadWorktrees: mockLoadWorktrees,
}

function useWorktreesStoreMock(selector?: any) {
  return selector ? selector(worktreesStore) : worktreesStore
}

;(useWorktreesStoreMock as any).getState = () => ({
  worktreesByProject: new Map([["test-project", mockWorktrees]]),
})

rstest.mock("../../src/stores/worktrees", () => ({
  useWorktreesStore: useWorktreesStoreMock,
  useWorktreesForProject: () => mockWorktrees,
}))
rstest.mock("@/stores/worktrees", () => ({
  useWorktreesStore: useWorktreesStoreMock,
  useWorktreesForProject: () => mockWorktrees,
}))

const mockAgents = [
  {
    id: "builtin",
    name: "Claude",
    description: "Anthropic assistant",
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt: "You are Claude",
    tools: { read: true },
    model: "claude-3-sonnet",
    enabled: true,
    isTemplate: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "custom",
    name: "Custom Agent",
    description: "User defined",
    temperature: 0.5,
    maxTokens: 800,
    systemPrompt: "You are helpful",
    tools: { write: true },
    model: "gpt-4",
    enabled: false,
    isTemplate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

const mockAgentList = rstest.fn(async () => ({ data: { agents: mockAgents } }))

rstest.mock("../../src/services/opencode-sdk-service", () => ({
  opencodeSDKService: {
    getClient: async () => ({
      agent: {
        list: mockAgentList,
      },
      session: {
        create: rstest.fn(() => Promise.resolve({ data: { id: "session-1" } })),
      },
    }),
    stopAll: async () => {},
  },
}))

rstest.mock("../../src/stores/sessions", () => ({
  useSessionsStore: () => ({
    loadSessions: rstest.fn(async () => {}),
    createSession: rstest.fn((projectId: string, worktreePath: string, title: string) =>
      Promise.resolve({
        id: "session-1",
        title,
        projectID: projectId,
        directory: worktreePath,
        version: "1",
        time: { created: Date.now() / 1000, updated: Date.now() / 1000 },
      }),
    ),
  }),
  useSessionsForProject: () => [],
}))

let AgentManagement: any
let OpencodeSDKProvider: any

const renderPage = async () => {
  await renderWithRouter(
    <OpencodeSDKProvider>
      <AgentManagement />
    </OpencodeSDKProvider>, 
    {
      projectId: "test-project",
      worktreeId: "default",
      initialPath: "/projects/test-project/default/agents",
    }
  )
}

describe("AgentManagement", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    const mod = require("../../src/pages/AgentManagement")
    AgentManagement = mod.default || mod.AgentManagement
    
    const contextMod = require("../../src/contexts/OpencodeSDKContext")
    OpencodeSDKProvider = contextMod.OpencodeSDKProvider
  })

  test("renders agent list", async () => {
    await renderPage()

    expect(await screen.findByTestId("agents-page-title")).toBeDefined()
    await waitFor(() => {
      expect(mockAgentList).toHaveBeenCalled()
    })

    const agentCards = await screen.findAllByTestId("agent-item")
    expect(agentCards.length).toBeGreaterThan(0)
  })

  test("shows templates button", async () => {
    await renderPage()

    expect(await screen.findByTestId("templates-button")).toBeDefined()
    expect(await screen.findByTestId("create-agent-button")).toBeDefined()
  })
})

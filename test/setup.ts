// Test setup for rstest with DOM support
import React from 'react'
import { beforeAll, beforeEach, afterAll, rstest } from "@rstest/core"
// import { setupApiMocks } from "./mocks/api-client" -- Disabled: using real servers
import "./mocks/sse" // Import SSE mock that matches OpenCode format
// Disable TestServerPool in unit runs to avoid SDK/server dependency
let TestServerPool: any = null
// CRITICAL: Mock the project manager module globally to prevent real database access
rstest.mock("../src/server/project-manager", () => {
  console.log("Mock factory called!")
  
  // Define mock class inside the factory to avoid initialization issues
  class MockProjectManager {
    private static instance: MockProjectManager
    private projects = new Map<string, any>()

    static getInstance(): MockProjectManager {
      if (!MockProjectManager.instance) {
        MockProjectManager.instance = new MockProjectManager()
      }
      return MockProjectManager.instance
    }

    static resetInstance(): void {
      MockProjectManager.instance = undefined as any
    }

    async addProject(path: string, name: string): Promise<any> {
      const id = `mock-${Date.now()}`
      const project = {
        id,
        name,
        path,
        status: "stopped" as const,
        lastAccessed: Date.now(),
        port: 8081,
        worktrees: [
          {
            id: "default",
            path,
            title: `${name} (default)`,
          },
        ],
      }
      this.projects.set(id, { info: project })
      return project
    }

    getProject(id: string): any {
      return this.projects.get(id)?.info
    }

    getAllProjects(): any[] {
      return Array.from(this.projects.values()).map(p => p.info)
    }

    async removeProject(id: string): Promise<boolean> {
      return this.projects.delete(id)
    }

    async spawnInstance(id: string): Promise<boolean> {
      const project = this.projects.get(id)
      if (project) {
        project.info.status = "running"
        return true
      }
      return false
    }

    async stopInstance(id: string): Promise<boolean> {
      const project = this.projects.get(id)
      if (project) {
        project.info.status = "stopped"
        return true
      }
      return false
    }

    getInstanceStatus(id: string): "stopped" | "starting" | "running" | "error" | undefined {
      return this.projects.get(id)?.info.status
    }

    async restartInstance(id: string): Promise<boolean> {
      return await this.spawnInstance(id)
    }

    async saveProjects(): Promise<void> {
      // Mock implementation - no operation needed
    }

    async loadProjects(): Promise<void> {
      // Mock implementation - no operation needed
    }

    async monitorHealth(): Promise<void> {
      // Mock implementation - no operation needed
    }

  async routeRequest(_projectId: string, _path: string, _request: Request): Promise<Response> {
      return new Response("Mock response", { status: 200 })
    }
  }
  
  // Create the singleton instance
  const mockInstance = MockProjectManager.getInstance()
  
  return {
    ProjectManager: MockProjectManager,
    projectManager: mockInstance,
  }
})

// React Router's NavLink relies on NavigationContext which is difficult to provide in
// isolated component tests. Replace it with a lightweight anchor implementation that keeps
// the rest of the router exports intact.
rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")

  const MockNavLink = React.forwardRef<HTMLAnchorElement, any>((props, ref) => {
    const { to, children, className, ...rest } = props
    const href = typeof to === "string" ? to : typeof to === "object" ? to.pathname ?? "#" : "#"
    const content = typeof children === "function"
      ? children({
          isActive: false,
          isPending: false,
          isTransitioning: false,
        })
      : children

    return React.createElement(
      "a",
      { ...rest, href, className, ref },
      content
    )
  })
  MockNavLink.displayName = "MockNavLink"

  // Provide a default useParams that includes a worktreeId, but allow tests to override
  const defaultUseParams = () => ({
    projectId: "test-project",
    worktreeId: "default",
    sessionId: undefined,
  })

  return {
    ...actual,
    NavLink: MockNavLink,
    useParams: defaultUseParams,
  }
})

// Use jsdom (provided by rstest) - avoid mixing with happy-dom

// Force DOM initialization and ensure it's available globally
const ensureDOMReady = () => {
  // Ensure global DOM objects are available using defineProperty to avoid readonly issues
  if (typeof global !== "undefined") {
    if (!global.document) Object.defineProperty(global, "document", { value: document, configurable: true })
    if (!global.window) Object.defineProperty(global, "window", { value: window, configurable: true })
    if (!global.navigator) Object.defineProperty(global, "navigator", { value: navigator, configurable: true })
    if (!global.location) Object.defineProperty(global, "location", { value: location, configurable: true })
  }

  // Ensure document.body exists and is properly structured
  if (!document.body) {
    document.body = document.createElement("body")
    document.documentElement.appendChild(document.body)
  }

  // Ensure standards mode to avoid quirks warnings (e.g., KaTeX)
  if (!document.doctype) {
    const doctype = document.implementation.createDocumentType("html", "", "")
    // jsdom doesn't allow direct assignment to doctype, so we store it as a property
    ;(document as any)._doctype = doctype
  }

  // Clear any existing content
  document.body.innerHTML = ""

  // Ensure body has proper structure for React Testing Library
  if (!document.body.querySelector("#root")) {
    const root = document.createElement("div")
    root.id = "root"
    document.body.appendChild(root)
  }

  // Verify DOM is accessible
  if (!document.body.contains(document.body.querySelector("#root"))) {
    throw new Error("DOM setup failed - root element not accessible")
  }
}

// Initialize DOM immediately
ensureDOMReady()

// Ensure AbortController/AbortSignal are compatible with the global fetch implementation (undici in Node).
// In jsdom environments, a different AbortSignal constructor can cause "Expected signal to be an instance of AbortSignal".
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const undici = require('undici') as { AbortController?: any; AbortSignal?: any }
  if (undici?.AbortController && undici?.AbortSignal) {
    ;(global as any).AbortController = undici.AbortController
    ;(global as any).AbortSignal = undici.AbortSignal
  }
} catch {
  // If undici is not available, continue with the default globals
}

// Polyfill pointer capture APIs used by Radix UI Select
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {}
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
}

// Don't setup API mocks - use real servers for all tests
// This makes tests more realistic and reliable
// setupApiMocks() -- DISABLED: Using real servers instead

// SDK mock removed - not needed for web UI tests

// React and ReactDOM should be imported where needed, not made global

// Configure React Testing Library after DOM is available
import { configure } from "@testing-library/react"

// Ensure screen can access document.body
if (typeof global !== "undefined" && global.document && global.document.body) {
  // Make sure screen can find the document
  Object.defineProperty(global, "document", {
    value: global.document,
    writable: true,
    configurable: true,
    enumerable: true,
  })
}

// Configure React Testing Library with DOM ready
configure({
  testIdAttribute: "data-testid",
  asyncUtilTimeout: 5000,
  // Ensure queries work with our DOM setup
  getElementError: (message, container) => {
    const error = new Error(
      [
        message,
        `Container: ${container ? container.innerHTML : "null"}`,
        `Document body: ${document.body ? document.body.innerHTML : "null"}`,
      ].join("\n\n"),
    )
    error.name = "TestingLibraryElementError"
    return error
  },
})

// Polyfill for React 18 concurrent features
;(global as any).IS_REACT_ACT_ENVIRONMENT = true





// Some tests expect a `mock` global with restore()
if (typeof (global as any).mock === "undefined") {
  ;(global as any).mock = { restore: () => {} }
}

// Re-enable API mocks for unit tests (avoid real network calls)
try {
  const { setupApiMocks } = require("./mocks/api-client")
  setupApiMocks()
} catch {
  // Intentionally ignore errors if api-client mocks are not available
}

// Do not mock scheduler; rely on React/DOM environment

// Import jest-dom matchers (provides toBeInTheDocument, toHaveClass, etc.)
import "@testing-library/jest-dom"

// (merged duplicate react-router-dom mock above)

// Mock localStorage and sessionStorage for Zustand persist
const createMockStorage = (): Storage => {
  const storage = new Map<string, string>()
  const mockStorage: Storage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
      // Dispatch storage event for Zustand persist
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(new Event("storage"))
        } catch {
          // Ignore storage event dispatch errors
        }
      }
    },
    removeItem: (key: string) => {
      storage.delete(key)
      // Dispatch storage event for Zustand persist
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(new Event("storage"))
        } catch {
          // Ignore storage event dispatch errors
        }
      }
    },
    clear: () => {
      storage.clear()
      // Dispatch storage event for Zustand persist
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: null,
            newValue: null,
            oldValue: null,
            storageArea: mockStorage,
          }),
        )
      }
    },
    get length() {
      return storage.size
    },
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
  }
  return mockStorage
}

// Ensure storage is available globally and on window
const mockLocalStorage = createMockStorage()
const mockSessionStorage = createMockStorage()

if (!global.localStorage) {
  Object.defineProperty(global, "localStorage", { value: mockLocalStorage, writable: true, configurable: true })
}
if (!global.sessionStorage) {
  Object.defineProperty(global, "sessionStorage", { value: mockSessionStorage, writable: true, configurable: true })
}

// Also ensure window storage is available after DOM setup
if (typeof window !== "undefined") {
  if (!window.localStorage) {
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
    })
  }
  if (!window.sessionStorage) {
    Object.defineProperty(window, "sessionStorage", {
      value: mockSessionStorage,
      writable: true,
    })
  }
}

// Fetch is now mocked in setupApiMocks()
// Polyfill PromiseRejectionEvent for jsdom
if (typeof (global as any).PromiseRejectionEvent === "undefined") {
  class PRJEvent extends Event {
    promise: Promise<any>
    reason: any
    constructor(type: string, init: { promise: Promise<any>; reason: any }) {
      super(type)
      this.promise = init.promise
      this.reason = init.reason
    }
  }
  ;(global as any).PromiseRejectionEvent = PRJEvent as any
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock IntersectionObserver
global.IntersectionObserver = class MockIntersectionObserver {
  root = null
  rootMargin = "0px"
  thresholds = [0]

  constructor(_callback: IntersectionObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
} as any

// Mock matchMedia
global.matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})

// Mock clipboard API - ensure navigator exists first
if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: async (_text: string) => Promise.resolve(),
      readText: async () => Promise.resolve(""),
      write: async () => Promise.resolve(),
      read: async () => Promise.resolve([]),
    },
    writable: true,
    configurable: true,
  })
}

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = () => "blob:mock-url"
global.URL.revokeObjectURL = () => {}

type MockAgentRecord = {
  id: string
  name: string
  description?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  tools: string[]
  model?: string
  enabled: boolean
  isTemplate?: boolean
  createdAt: number
  updatedAt: number
}

type MockWorktree = {
  id: string
  path: string
  title: string
  branch?: string
}

type MockProjectRecord = {
  id: string
  name: string
  path: string
  type: "git" | "local"
  addedAt: string
  lastOpened: string | null
  instance: {
    id: string
    port: number
    status: "running" | "stopped" | "starting" | "error"
    startedAt: string
  }
  worktrees: MockWorktree[]
}

type MockApiState = {
  projects: MockProjectRecord[]
  agents: Record<string, Record<string, MockAgentRecord[]>>
  resources: Record<string, { memory: { used: number; total: number }; port?: number; cpu?: { usage: number } }>
  activity: Record<string, Array<{ id: string; type: string; message: string; timestamp: string }>>
}

const DEFAULT_WORKTREES: MockWorktree[] = [
  { id: "default", path: "/project", title: "Main" },
  { id: "feature", path: "/project-feature", title: "Feature Branch" },
]

const createDefaultAgents = (): MockAgentRecord[] => {
  const now = Date.now()
  return [
    {
      id: "claude",
      name: "Claude",
      description: "Anthropic's AI assistant",
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: "You are Claude, an AI assistant.",
      tools: ["read", "grep", "ls"],
      model: "claude-3-sonnet",
      enabled: true,
      isTemplate: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "custom-agent",
      name: "Custom Agent",
      description: "Custom AI agent",
      temperature: 0.5,
      maxTokens: 1000,
      systemPrompt: "You are a custom AI agent.",
      tools: ["grep", "read", "write"],
      model: "gpt-5-mini",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "disabled-agent",
      name: "Disabled Agent",
      description: "Disabled agent",
      temperature: 0.3,
      maxTokens: 1000,
      systemPrompt: "You are a disabled agent.",
      tools: [],
      model: "gpt-3.5-turbo",
      enabled: false,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

const createDefaultState = (): MockApiState => {
  const nowIso = new Date().toISOString()
  const projects: MockProjectRecord[] = [
    {
      id: "test-project",
      name: "Test Project",
      path: "/project",
      type: "git",
      addedAt: nowIso,
      lastOpened: nowIso,
      instance: {
        id: "instance-1",
        port: 4000,
        status: "running",
        startedAt: nowIso,
      },
      worktrees: DEFAULT_WORKTREES,
    },
  ]

  const agents: MockApiState["agents"] = {
    "test-project": {
      "/project": createDefaultAgents(),
      "/project-feature": createDefaultAgents().map((agent) => ({
        ...agent,
        id: agent.id === "claude" ? "feature-claude" : agent.id,
        name: agent.name === "Claude" ? "Feature Claude" : agent.name,
      })),
    },
  }

  const resources: MockApiState["resources"] = {
    "test-project": {
      memory: { used: 512, total: 2048 },
      cpu: { usage: 0.18 },
      port: 4000,
    },
  }

  const activity: MockApiState["activity"] = {
    "test-project": [
      {
        id: "activity-1",
        type: "commit",
        message: "Initial commit",
        timestamp: nowIso,
      },
      {
        id: "activity-2",
        type: "session",
        message: "Opened session 'Setup project'",
        timestamp: nowIso,
      },
    ],
  }

  return { projects, agents, resources, activity }
}

let mockApiState: MockApiState = createDefaultState()

const resetMockApiState = () => {
  mockApiState = createDefaultState()
}

const jsonResponse = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  })

const textResponse = (data: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(data, {
    status,
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      ...headers,
    },
  })

const parseRequestBody = async (init?: RequestInit): Promise<any> => {
  if (!init || init.body == null) return undefined
  const body = init.body as any
  if (typeof body === "string") {
    try {
      return JSON.parse(body)
    } catch {
      return body
    }
  }
  if (body instanceof URLSearchParams) {
    return Object.fromEntries(body.entries())
  }
  if (ArrayBuffer.isView(body)) {
    const text = Buffer.from(body.buffer, body.byteOffset, body.byteLength).toString()
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  if (body instanceof ArrayBuffer) {
    const text = Buffer.from(body).toString()
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  try {
    const resp = new Response(body)
    return await resp.json()
  } catch {
    try {
      const resp = new Response(body)
      return await resp.text()
    } catch {
      return undefined
    }
  }
}

const resolveProject = (projectId: string): MockProjectRecord | undefined =>
  mockApiState.projects.find((project) => project.id === projectId)

const resolveWorktreePath = (projectId: string, url: URL): string => {
  const param = url.searchParams.get("worktree")
  if (param) return decodeURIComponent(param)
  const project = resolveProject(projectId)
  return project?.path ?? "/project"
}

const ensureAgentList = (projectId: string, worktreePath: string): MockAgentRecord[] => {
  if (!mockApiState.agents[projectId]) {
    mockApiState.agents[projectId] = {}
  }
  const projectAgents = mockApiState.agents[projectId]
  if (!projectAgents[worktreePath]) {
    projectAgents[worktreePath] = createDefaultAgents()
  }
  return projectAgents[worktreePath]
}

beforeEach(() => {
  resetMockApiState()
})

// Mock fetch for tests that need to make API calls
const originalFetch = typeof global.fetch === "function" ? global.fetch.bind(global) : undefined

// Patch the original fetch to add duplex option for Node.js 18+ compatibility
const patchedFetch = originalFetch ? (input: any, init?: any) => {
  // Add duplex: 'half' for requests with body to fix Node.js 18+ error
  if (init && init.body && !init.duplex) {
    init = { ...init, duplex: 'half' }
  }
  return originalFetch(input, init)
} : undefined

// Also patch the Request constructor to add duplex option
if (typeof Request !== 'undefined') {
  const OriginalRequest = Request
  global.Request = class extends OriginalRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      // Add duplex option if there's a body
      const patchedInit: any = init
      if (patchedInit && patchedInit.body && !patchedInit.duplex) {
        patchedInit.duplex = 'half'
      }
      super(input, patchedInit)
    }
  } as any
}

Object.defineProperty(global, "fetch", {
  value: async (input: RequestInfo | URL, init?: RequestInit) => {
    let urlString: string

    if (typeof input === "string") {
      urlString = input
    } else if (input instanceof URL) {
      urlString = input.toString()
    } else if (typeof Request !== "undefined" && input instanceof Request) {
      urlString = input.url
      if (!init) {
        init = {
          method: input.method,
          headers: input.headers as any,
          body: input.body as any,
        }
      }
    } else {
      urlString = String(input)
    }

    const isAbsoluteUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(urlString)
    if (isAbsoluteUrl) {
      if (patchedFetch) {
        return patchedFetch(input as any, init)
      }
      throw new Error(`Unhandled absolute fetch request: ${urlString}`)
    }

    const url = new URL(urlString, "http://localhost")
    const pathname = url.pathname
    const method = (init?.method || "GET").toUpperCase()

    if (pathname === "/api/backend-url") {
      return jsonResponse({ url: "/opencode" })
    }

    if (pathname === "/api/projects") {
      if (method === "GET") {
        return jsonResponse(mockApiState.projects)
      }
      if (method === "POST") {
        const body = (await parseRequestBody(init)) ?? {}
        const id = body.id || `project-${Date.now()}`
        const nowIso = new Date().toISOString()
        const project: MockProjectRecord = {
          id,
          name: body.name || `Project ${mockApiState.projects.length + 1}`,
          path: body.path || `/project-${mockApiState.projects.length + 1}`,
          type: "git",
          addedAt: nowIso,
          lastOpened: nowIso,
          instance: {
            id: `${id}-instance`,
            port: 4000,
            status: "running",
            startedAt: nowIso,
          },
          worktrees: DEFAULT_WORKTREES,
        }
        mockApiState.projects.push(project)
        return jsonResponse(project, 201)
      }
    }

    const gitStatusMatch = pathname.match(/^\/api\/projects\/([^/]+)\/git\/status$/)
    if (gitStatusMatch) {
      return jsonResponse({
        branch: "main",
        ahead: 0,
        behind: 0,
        changedFiles: 2,
        stagedCount: 1,
        unstagedCount: 1,
        untrackedCount: 0,
        staged: [
          { path: "src/components/ProjectDashboard.tsx", status: "M", staged: true },
        ],
        modified: [
          { path: "src/pages/GitOperations.tsx", status: "M", staged: false },
        ],
        untracked: [],
        remoteUrl: "git@github.com:mock/repo.git",
        lastCommit: {
          hash: "abc123",
          author: "Mock Author",
          date: new Date().toISOString(),
          message: "Mock commit",
        },
      })
    }

    const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/)
    if (projectMatch) {
      const projectId = decodeURIComponent(projectMatch[1])
      const project = resolveProject(projectId)
      if (!project) {
        return textResponse("Project not found", 404)
      }

      if (method === "GET") {
        return jsonResponse(project)
      }

      if (method === "PATCH") {
        const body = (await parseRequestBody(init)) ?? {}
        Object.assign(project, body)
        return jsonResponse(project)
      }

      if (method === "DELETE") {
        mockApiState.projects = mockApiState.projects.filter((p) => p.id !== projectId)
        delete mockApiState.agents[projectId]
        delete mockApiState.resources[projectId]
        delete mockApiState.activity[projectId]
        return jsonResponse({ success: true })
      }
    }

    const projectStatusMatch = pathname.match(/^\/api\/projects\/([^/]+)\/status$/)
    if (projectStatusMatch) {
      const projectId = decodeURIComponent(projectStatusMatch[1])
      const project = resolveProject(projectId)
      if (!project) {
        return textResponse("Project not found", 404)
      }
      return jsonResponse({
        status: project.instance.status,
        port: project.instance.port,
        projectId: project.id,
      })
    }

    const worktreesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/worktrees$/)
    if (worktreesMatch) {
      const projectId = decodeURIComponent(worktreesMatch[1])
      const project = resolveProject(projectId)
      if (!project) {
        return textResponse("Project not found", 404)
      }
      return jsonResponse(project.worktrees)
    }

    const resourcesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/resources$/)
    if (resourcesMatch) {
      const projectId = decodeURIComponent(resourcesMatch[1])
      const resource = mockApiState.resources[projectId]
      if (!resource) {
        return textResponse("Resources not found", 404)
      }
      return jsonResponse(resource)
    }

    const activityMatch = pathname.match(/^\/api\/projects\/([^/]+)\/activity$/)
    if (activityMatch) {
      const projectId = decodeURIComponent(activityMatch[1])
      const activity = mockApiState.activity[projectId] || []
      return jsonResponse(activity)
    }

    const agentsRootMatch = pathname.match(/^\/api\/projects\/([^/]+)\/agents$/)
    if (agentsRootMatch) {
      const projectId = decodeURIComponent(agentsRootMatch[1])
      const project = resolveProject(projectId)
      if (!project) {
        return textResponse("Project not found", 404)
      }
      const worktreePath = resolveWorktreePath(projectId, url)
      const agents = ensureAgentList(projectId, worktreePath)

      if (method === "GET") {
        return jsonResponse(agents)
      }

      if (method === "POST") {
        const body = (await parseRequestBody(init)) ?? {}
        const now = Date.now()
        const newAgent: MockAgentRecord = {
          id: body.id || `agent-${now}`,
          name: body.name || "New Agent",
          description: body.description || "",
          temperature: body.temperature ?? 0.7,
          maxTokens: body.maxTokens ?? 1000,
          systemPrompt: body.systemPrompt || "",
          tools: Array.isArray(body.tools) ? body.tools : [],
          model: body.model,
          enabled: body.enabled !== false,
          createdAt: now,
          updatedAt: now,
        }
        agents.push(newAgent)
        return jsonResponse(newAgent, 201)
      }
    }

    const agentDetailMatch = pathname.match(/^\/api\/projects\/([^/]+)\/agents\/([^/]+)$/)
    if (agentDetailMatch) {
      const projectId = decodeURIComponent(agentDetailMatch[1])
      const agentId = decodeURIComponent(agentDetailMatch[2])
      const worktreePath = resolveWorktreePath(projectId, url)
      const agents = ensureAgentList(projectId, worktreePath)
      const agent = agents.find((item) => item.id === agentId)
      if (!agent) {
        return textResponse("Agent not found", 404)
      }

      if (method === "GET") {
        return jsonResponse(agent)
      }

      if (method === "PUT" || method === "PATCH") {
        const body = (await parseRequestBody(init)) ?? {}
        Object.assign(agent, body, { updatedAt: Date.now() })
        if (Array.isArray(body.tools)) {
          agent.tools = body.tools
        }
        return jsonResponse(agent)
      }

      if (method === "DELETE") {
        const index = agents.findIndex((item) => item.id === agentId)
        if (index !== -1) {
          agents.splice(index, 1)
        }
        return jsonResponse({ success: true })
      }
    }

    const agentTestMatch = pathname.match(/^\/api\/projects\/([^/]+)\/agents\/([^/]+)\/test$/)
    if (agentTestMatch && method === "POST") {
      const body = (await parseRequestBody(init)) ?? {}
      const prompt = typeof body?.prompt === "string" ? body.prompt : ""
      return jsonResponse({ success: true, response: `Echo: ${prompt || "Test response"}` })
    }

    if (pathname.startsWith("/opencode/")) {
      if (pathname.includes("/files") && method === "GET") {
        if (/\/files\//.test(pathname)) {
          return textResponse("console.log('Hello, world!');")
        }
        return jsonResponse([
          { name: "src", type: "directory", path: "/project/src" },
          { name: "package.json", type: "file", path: "/project/package.json" },
        ])
      }
      if (pathname.includes("/files") && method === "POST") {
        return jsonResponse({ success: true })
      }
    }

    return jsonResponse({ error: "Not found" }, 404)
  },
  writable: true,
  configurable: true,
})

// Mock File and FileReader for file upload tests
global.File = class MockFile {
  name: string
  size: number
  type: string
  lastModified: number

  constructor(chunks: BlobPart[], filename: string, options?: FilePropertyBag) {
    this.name = filename
    this.size = chunks.reduce((acc, chunk) => {
      if (typeof chunk === "string") return acc + chunk.length
      if (chunk instanceof Blob) return acc + chunk.size
      if (chunk instanceof ArrayBuffer) return acc + chunk.byteLength
      return acc + (chunk as any).byteLength || 0
    }, 0)
    this.type = options?.type || ""
    this.lastModified = options?.lastModified || Date.now()
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(0))
  }

  text(): Promise<string> {
    return Promise.resolve("")
  }

  stream(): ReadableStream {
    return new ReadableStream()
  }

  slice(): Blob {
    return new Blob()
  }
} as any

global.FileReader = class MockFileReader extends EventTarget {
  result: string | ArrayBuffer | null = null
  error: DOMException | null = null
  readyState = 0
  EMPTY = 0
  LOADING = 1
  DONE = 2

  readAsText(_file: Blob) {
    setTimeout(() => {
      this.result = "mock file content"
      this.readyState = this.DONE
      this.dispatchEvent(new Event("load"))
    }, 0)
  }

  readAsDataURL(_file: Blob) {
    setTimeout(() => {
      this.result = "data:text/plain;base64,bW9jayBmaWxlIGNvbnRlbnQ="
      this.readyState = this.DONE
      this.dispatchEvent(new Event("load"))
    }, 0)
  }

  readAsArrayBuffer(_file: Blob) {
    setTimeout(() => {
      this.result = new ArrayBuffer(0)
      this.readyState = this.DONE
      this.dispatchEvent(new Event("load"))
    }, 0)
  }

  abort() {
    this.readyState = this.DONE
    this.dispatchEvent(new Event("abort"))
  }

  addEventListener = EventTarget.prototype.addEventListener
  removeEventListener = EventTarget.prototype.removeEventListener
  dispatchEvent = EventTarget.prototype.dispatchEvent
} as any

// Mock performance API
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
    getEntriesByName: () => [],
    getEntriesByType: () => [],
    clearMarks: () => {},
    clearMeasures: () => {},
  } as any
}

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(() => callback(Date.now()), 16) as any
}
global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id as any)
}

// Mock requestIdleCallback
global.requestIdleCallback = (callback: IdleRequestCallback) => {
  return setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0) as any
}
global.cancelIdleCallback = (id: number) => {
  clearTimeout(id as any)
}

// Enhanced OpenCode test configuration
const TEST_CONFIG = {
  serverPool: {
    enabled: process.env.OPENCODE_TEST_POOL === "true",
    size: parseInt(process.env.OPENCODE_TEST_POOL_SIZE || "3", 10),
  },
  timeout: {
    default: 30000,
    server: 45000,
  },
  logging: {
    level: process.env.OPENCODE_TEST_LOG_LEVEL || "INFO",
    enabled: process.env.OPENCODE_TEST_LOGS !== "false",
  },
}

// Global server pool instance
let globalServerPool: any = null

// Global setup for server pool - runs once before all tests
beforeAll(async () => {
  if (TEST_CONFIG.serverPool.enabled && TestServerPool) {
    console.log(`📡 Initializing global server pool (size: ${TEST_CONFIG.serverPool.size})...`)
    globalServerPool = new TestServerPool()
    await globalServerPool.initialize(TEST_CONFIG.serverPool.size)

    // Make pool available globally for tests
    ;(globalThis as any).__OPENCODE_SERVER_POOL__ = globalServerPool
    console.log("✅ Global server pool ready")
  } else if (TEST_CONFIG.serverPool.enabled && !TestServerPool) {
    console.warn("⚠️ Server pool requested but TestServerPool not available")
  }
  // Start a single OpenCode server for unit tests that need the provider
  try {
    // Only start once
    if (!(globalThis as any).__OPENCODE_URL__) {
      const { createOpencodeServer } = await import("@opencode-ai/sdk")
      const server = await createOpencodeServer({ hostname: "127.0.0.1", port: 0 })
      ;(globalThis as any).__OPENCODE_URL__ = server.url
      ;(globalThis as any).__OPENCODE_SERVER__ = server
      console.log("🔌 OpenCode test server:", server.url)
    }
  } catch (e) {
    console.warn("⚠️ Could not start OpenCode test server:", e)
  }
})

// Global cleanup - runs once after all tests
afterAll(async () => {
  if (globalServerPool) {
    console.log("🧹 Cleaning up global server pool...")
    await globalServerPool.cleanup()
    globalServerPool = null
    ;(globalThis as any).__OPENCODE_SERVER_POOL__ = null
    console.log("✅ Global server pool cleaned up")
  }
  // Stop the OpenCode test server
  try {
    const server = (globalThis as any).__OPENCODE_SERVER__
    if (server) {
      await server.close?.()
      ;(globalThis as any).__OPENCODE_SERVER__ = null
      ;(globalThis as any).__OPENCODE_URL__ = null
    }
  } catch {
    // Ignore errors when stopping OpenCode test server
  }
})

// Make config and types available globally
;(globalThis as any).__OPENCODE_TEST_CONFIG__ = TEST_CONFIG

declare global {
  var __OPENCODE_SERVER_POOL__: any
  var __OPENCODE_TEST_CONFIG__: typeof TEST_CONFIG
}

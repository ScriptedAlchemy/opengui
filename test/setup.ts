// Test setup for rstest with DOM support
import { expect, beforeAll, afterAll, rstest } from "@rstest/core"
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
        port: 8081
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

    async routeRequest(projectId: string, path: string, request: Request): Promise<Response> {
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

// Mock localStorage and sessionStorage for Zustand persist
const createMockStorage = (): Storage => {
  const storage = new Map<string, string>()
  const mockStorage: Storage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      const oldValue = storage.get(key) ?? null
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
      const oldValue = storage.get(key) ?? null
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

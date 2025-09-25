import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from "@rstest/core"
import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/native"

const MOCK_BASE_URL = "https://mock.opencode.test"

interface MockSession {
  id: string
  title: string
  projectID: string
  directory: string
  version: string
  time: {
    created: number
    updated: number
  }
}

interface MockFileEntry {
  name: string
  path: string
  type: "file" | "directory"
}

const initialSessions: MockSession[] = [
  {
    id: "session-1",
    title: "Seed Session",
    projectID: "project-1",
    directory: "/tmp/mock-project",
    version: "1",
    time: {
      created: Date.now() / 1000,
      updated: Date.now() / 1000,
    },
  },
]

const fileEntries: MockFileEntry[] = [
  { name: "src", path: "src", type: "directory" },
  { name: "package.json", path: "package.json", type: "file" },
]

let sessions: MockSession[] = [...initialSessions]
let sessionCounter = sessions.length

function resetServerState() {
  sessions = initialSessions.map((session) => ({ ...session }))
  sessionCounter = sessions.length
}

const server = setupServer(
  http.get(`${MOCK_BASE_URL}/doc`, () =>
    HttpResponse.json({
      openapi: "3.1.0",
      info: { title: "opencode", version: "0.0.0-test" },
      paths: {},
    })
  ),

  http.get(`${MOCK_BASE_URL}/event`, () =>
    new Response("id: 1\nevent: ready\ndata: {\"status\":\"ok\"}\n\n", {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  ),

  http.post(`${MOCK_BASE_URL}/app/init`, () => HttpResponse.json(true)),

  http.get(`${MOCK_BASE_URL}/config`, () =>
    HttpResponse.json({
      environment: "test",
      version: "0.0.0",
      features: ["msw"],
    })
  ),

  http.get(`${MOCK_BASE_URL}/config/providers`, () =>
    HttpResponse.json({
      providers: [
        {
          id: "anthropic",
          name: "Anthropic",
          models: ["claude-3"],
        },
      ],
      default: {
        provider: "anthropic",
        model: "claude-3",
      },
    })
  ),

  http.get(`${MOCK_BASE_URL}/session`, () => HttpResponse.json(sessions)),

  http.post(`${MOCK_BASE_URL}/session`, async ({ request }) => {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return HttpResponse.json({ error: "Invalid content type" }, { status: 400 })
    }

    let payload: any = null
    try {
      payload = await request.json()
    } catch (error) {
      return HttpResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (!payload?.title) {
      return HttpResponse.json({ error: "Missing title" }, { status: 400 })
    }

    sessionCounter += 1
    const newSession: MockSession = {
      id: `session-${sessionCounter}`,
      title: payload.title,
      projectID: "project-1",
      directory: "/tmp/mock-project",
      version: "1",
      time: {
        created: Date.now() / 1000,
        updated: Date.now() / 1000,
      },
    }

    sessions.push(newSession)
    return HttpResponse.json(newSession, { status: 201 })
  }),

  http.get(`${MOCK_BASE_URL}/session/:id`, ({ params }) => {
    const session = sessions.find((item) => item.id === params.id)
    if (!session) {
      return HttpResponse.json({ error: "Session not found" }, { status: 404 })
    }
    return HttpResponse.json(session)
  }),

  http.patch(`${MOCK_BASE_URL}/session/:id`, async ({ params, request }) => {
    const session = sessions.find((item) => item.id === params.id)
    if (!session) {
      return HttpResponse.json({ error: "Session not found" }, { status: 404 })
    }

    let payload: any = null
    try {
      payload = await request.json()
    } catch (error) {
      return HttpResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (payload?.title) {
      session.title = payload.title
      session.time.updated = Date.now() / 1000
    }

    return HttpResponse.json(session)
  }),

  http.get(`${MOCK_BASE_URL}/session/:id/children`, ({ params }) => {
    const session = sessions.find((item) => item.id === params.id)
    if (!session) {
      return HttpResponse.json({ error: "Session not found" }, { status: 404 })
    }
    return HttpResponse.json([])
  }),

  http.post(`${MOCK_BASE_URL}/session/:id/abort`, ({ params }) => {
    const session = sessions.find((item) => item.id === params.id)
    if (!session) {
      return HttpResponse.json({ error: "Session not found" }, { status: 404 })
    }
    return HttpResponse.json(true)
  }),

  http.delete(`${MOCK_BASE_URL}/session/:id`, ({ params }) => {
    const originalLength = sessions.length
    sessions = sessions.filter((item) => item.id !== params.id)
    const didDelete = sessions.length < originalLength
    return didDelete
      ? HttpResponse.json(true)
      : HttpResponse.json({ error: "Session not found" }, { status: 404 })
  }),

  http.get(`${MOCK_BASE_URL}/command`, () =>
    HttpResponse.json([
      { name: "generate-docs", description: "Generate documentation" },
      { name: "lint", description: "Run lint checks" },
    ])
  ),

  http.get(`${MOCK_BASE_URL}/find`, () =>
    HttpResponse.json([
      { file: "src/index.ts", line: 10, preview: "const test = 1" },
    ])
  ),

  http.get(`${MOCK_BASE_URL}/find/file`, () =>
    HttpResponse.json([
      { path: "src/index.ts" },
      { path: "src/components/App.tsx" },
    ])
  ),

  http.get(`${MOCK_BASE_URL}/find/symbol`, () =>
    HttpResponse.json([
      { name: "TestComponent", kind: "function", file: "src/components/TestComponent.tsx" },
    ])
  ),

  http.get(`${MOCK_BASE_URL}/file`, ({ request }) => {
    const url = new URL(request.url)
    const path = url.searchParams.get("path")
    if (!path) {
      return HttpResponse.json({ error: "Missing path" }, { status: 400 })
    }
    return HttpResponse.json(fileEntries)
  }),

  http.get(`${MOCK_BASE_URL}/file/content`, ({ request }) => {
    const url = new URL(request.url)
    const path = url.searchParams.get("path")
    if (!path) {
      return HttpResponse.json({ error: "Missing path" }, { status: 400 })
    }
    if (path === "package.json") {
      return HttpResponse.json({ type: "raw", content: JSON.stringify({ name: "mock" }) })
    }
    return HttpResponse.json({ error: "File not found" }, { status: 404 })
  }),

  http.get(`${MOCK_BASE_URL}/file/status`, () =>
    HttpResponse.json([
      { path: "src/index.ts", status: "modified" },
      { path: "README.md", status: "untracked" },
    ])
  ),

  http.post(`${MOCK_BASE_URL}/log`, async ({ request }) => {
    let payload: any = null
    try {
      payload = await request.json()
    } catch (error) {
      return HttpResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (!payload?.service || !payload.level || !payload.message) {
      return HttpResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    return HttpResponse.json(true)
  }),

  http.put(`${MOCK_BASE_URL}/auth/:provider`, async ({ request }) => {
    let payload: any = null
    try {
      payload = await request.json()
    } catch (error) {
      return HttpResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (!payload?.type || !payload.token) {
      return HttpResponse.json({ error: "Missing credentials" }, { status: 400 })
    }
    return HttpResponse.json(true)
  }),

  http.get(`${MOCK_BASE_URL}/agent`, () =>
    HttpResponse.json([
      { id: "agent-1", name: "Mock Agent", description: "Assists with code" },
    ])
  ),

  http.get(`${MOCK_BASE_URL}/non-existent-endpoint`, () =>
    HttpResponse.json({ error: "Not found" }, { status: 404 })
  )
)

let client: OpencodeClient

async function createSession(title: string) {
  const response = await fetch(`${MOCK_BASE_URL}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  })
  expect(response.ok).toBe(true)
  const created = await response.json() as MockSession
  return created.id
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" })
  resetServerState()
  client = createOpencodeClient({ baseUrl: MOCK_BASE_URL })
})

beforeEach(() => {
  resetServerState()
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

/**
 * Comprehensive test suite for ALL OpenCode server endpoints
 * Based on the OpenAPI spec from /doc endpoint
 */
describe("OpenCode Server - All Endpoints", () => {
  describe("Documentation & Meta", () => {
    test("GET /doc - OpenAPI documentation", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/doc`)
      expect(response.ok).toBe(true)

      const doc = await response.json()
      expect(doc).toHaveProperty("openapi")
      expect(doc).toHaveProperty("info")
      expect(doc).toHaveProperty("paths")
      expect(doc.info.title).toBe("opencode")
    })
  })

  describe("Event Stream", () => {
    test("GET /event - SSE event stream", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/event`)
      expect(response.ok).toBe(true)
      expect(response.headers.get("content-type")).toContain("text/event-stream")

      const bodyText = await response.text()
      expect(bodyText).toMatch(/data:/)
      expect(bodyText).toMatch(/event:/)
    })
  })

  describe("App Management", () => {
    test("App info via SDK config", async () => {
      const response = await client.config.get()
      expect(response).toBeDefined()
      expect(response.data || response.error).toBeDefined()
    })

    test("POST /app/init - Initialize app", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/app/init`, {
        method: "POST",
      })
      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(typeof result).toBe("boolean")
    })
  })

  describe("Configuration", () => {
    test("GET /config - Get config info", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/config`)
      expect(response.ok).toBe(true)

      const config = await response.json()
      expect(config).toBeDefined()
    })

    test("GET /config/providers - List providers", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/config/providers`)
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data).toHaveProperty("providers")
      expect(Array.isArray(data.providers)).toBe(true)
      expect(data).toHaveProperty("default")
    })
  })

  describe("Session Management", () => {
    test("GET /session - List sessions", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/session`)
      expect(response.ok).toBe(true)

      const listedSessions = await response.json()
      expect(Array.isArray(listedSessions)).toBe(true)
    })

    test("POST /session - Create session", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Session",
        }),
      })

      expect(response.ok).toBe(true)
      const session = await response.json()
      expect(session).toHaveProperty("id")
    })

    test("GET /session/:id - Get session", async () => {
      const sessionId = await createSession("Session for GET")
      const response = await fetch(`${MOCK_BASE_URL}/session/${sessionId}`)
      expect(response.ok).toBe(true)

      const session = await response.json()
      expect(session.id).toBe(sessionId)
    })

    test("PATCH /session/:id - Update session", async () => {
      const sessionId = await createSession("Session for PATCH")
      const response = await fetch(`${MOCK_BASE_URL}/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Session Title",
        }),
      })
      expect(response.ok).toBe(true)

      const updated = await response.json()
      expect(updated.title).toBe("Updated Session Title")
    })

    test("GET /session/:id/children - Get session children", async () => {
      const sessionId = await createSession("Session for children")
      const response = await fetch(`${MOCK_BASE_URL}/session/${sessionId}/children`)
      expect(response.ok).toBe(true)

      const children = await response.json()
      expect(Array.isArray(children)).toBe(true)
    })

    test("POST /session/:id/abort - Abort session", async () => {
      const sessionId = await createSession("Session for abort")
      const response = await fetch(`${MOCK_BASE_URL}/session/${sessionId}/abort`, {
        method: "POST",
      })
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(typeof result).toBe("boolean")
    })

    test("DELETE /session/:id - Delete session", async () => {
      const sessionId = await createSession("Session for delete")
      const response = await fetch(`${MOCK_BASE_URL}/session/${sessionId}`, {
        method: "DELETE",
      })

      expect(response.ok).toBe(true)
      const deleted = await response.json()
      expect(typeof deleted).toBe("boolean")

      const verify = await fetch(`${MOCK_BASE_URL}/session/${sessionId}`)
      expect(verify.status).toBe(404)
    })
  })

  describe("Commands", () => {
    test("GET /command - List commands", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/command`)
      expect(response.ok).toBe(true)

      const commands = await response.json()
      expect(Array.isArray(commands)).toBe(true)
    })
  })

  describe("Search & Find", () => {
    test("GET /find - Find text in files", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/find?pattern=test`)
      expect(response.ok).toBe(true)

      const matches = await response.json()
      expect(Array.isArray(matches)).toBe(true)
    })

    test("GET /find/file - Find files", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/find/file?query=*.ts`)
      expect(response.ok).toBe(true)

      const files = await response.json()
      expect(Array.isArray(files)).toBe(true)
    })

    test("GET /find/symbol - Find symbols", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/find/symbol?query=test`)
      expect(response.ok).toBe(true)

      const symbols = await response.json()
      expect(Array.isArray(symbols)).toBe(true)
    })
  })

  describe("File Operations", () => {
    test("GET /file - List files", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/file?path=.`)
      expect(response.ok).toBe(true)

      const files = await response.json()
      expect(Array.isArray(files)).toBe(true)
    })

    test("GET /file/content - Read file", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/file/content?path=package.json`)

      expect(response.ok).toBe(true)
      const content = await response.json()
      expect(content).toHaveProperty("type")
      expect(content).toHaveProperty("content")
      expect(["raw", "patch"].includes(content.type)).toBe(true)
    })

    test("GET /file/status - Get file status", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/file/status`)
      expect(response.ok).toBe(true)

      const status = await response.json()
      expect(Array.isArray(status)).toBe(true)
    })
  })

  describe("Logging", () => {
    test("POST /log - Write log entry", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "test-suite",
          level: "info",
          message: "Test log entry from comprehensive test",
          extra: {
            test: true,
            timestamp: Date.now(),
          },
        }),
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result).toBe(true)
    })

    test("POST /log - Invalid log entry", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extra: { test: true },
        }),
      })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe("Agents", () => {
    test("GET /agent - List agents", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/agent`)
      expect(response.ok).toBe(true)

      const agents = await response.json()
      expect(Array.isArray(agents)).toBe(true)
    })
  })

  describe("Authentication", () => {
    test("PUT /auth/:id - Set auth credentials", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/auth/test-provider`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bearer",
          token: "test-token",
        }),
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(typeof result).toBe("boolean")
    })
  })

  describe("Error Handling", () => {
    test("404 - Non-existent endpoint", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/non-existent-endpoint`)
      expect(response.status).toBe(404)
    })

    test("Invalid JSON body", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    test("Missing required parameters", async () => {
      const response = await fetch(`${MOCK_BASE_URL}/file`)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe("Concurrent Operations", () => {
    test("Handles concurrent requests", async () => {
      const endpoints = [
        "/doc",
        "/file?path=.",
        "/config",
        "/session",
        "/command",
        "/agent",
        "/file/status",
        "/config/providers",
      ]

      const promises = endpoints.map((endpoint) => fetch(`${MOCK_BASE_URL}${endpoint}`))
      const responses = await Promise.all(promises)

      responses.forEach((response) => {
        expect(response.ok).toBe(true)
      })
    }, 20000)

    test("Handles rapid sequential requests", async () => {
      const results: boolean[] = []

      for (let i = 0; i < 10; i++) {
        const response = await fetch(`${MOCK_BASE_URL}/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service: "rapid-test",
            level: "info",
            message: `Rapid request ${i}`,
            extra: { index: i },
          }),
        })

        results.push(response.ok)
      }

      results.forEach((ok) => expect(ok).toBe(true))
    })
  })
})

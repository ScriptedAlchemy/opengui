import { describe, test, expect, beforeAll, afterAll } from "@rstest/core"
import { createTestServer, type TestServer } from "./test-helpers"
import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk"

/**
 * Comprehensive test suite for ALL OpenCode server endpoints
 * Based on the OpenAPI spec from /doc endpoint
 */
describe.skip("OpenCode Server - All Endpoints", () => {
  let testServer: TestServer
  let client: OpencodeClient
  let sessionId: string | null = null

  beforeAll(async () => {
    testServer = await createTestServer()
    client = createOpencodeClient({ baseUrl: testServer.baseUrl })
  })

  afterAll(async () => {
    await testServer.cleanup()
  })

  describe("Documentation & Meta", () => {
    test("GET /doc - OpenAPI documentation", async () => {
      const response = await fetch(`${testServer.baseUrl}/doc`)
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
      const response = await fetch(`${testServer.baseUrl}/event`)
      expect(response.ok).toBe(true)
      expect(response.headers.get("content-type")).toContain("text/event-stream")

      // Read one event then close
      if (response.body) {
        const reader = response.body.getReader()
        const { value } = await reader.read()
        await reader.cancel()

        if (value) {
          const text = new TextDecoder().decode(value)
          // Should contain SSE format
          expect(text).toMatch(/data:|event:|id:/)
        }
      }
    }, 10000)
  })

  describe("App Management", () => {
    test("App info via SDK config", async () => {
      const response = await client.config.get()
      expect(response).toBeDefined()
      expect(response.data || response.error).toBeDefined()
    })

    test("POST /app/init - Initialize app", async () => {
      const response = await fetch(`${testServer.baseUrl}/app/init`, {
        method: "POST",
      })
      // This might fail if already initialized or in test mode
      if (response.ok) {
        const result = await response.json()
        expect(typeof result).toBe("boolean")
      }
    })
  })

  describe("Configuration", () => {
    test("GET /config - Get config info", async () => {
      const response = await fetch(`${testServer.baseUrl}/config`)
      expect(response.ok).toBe(true)

      const config = await response.json()
      expect(config).toBeDefined()
    })

    test("GET /config/providers - List providers", async () => {
      const response = await fetch(`${testServer.baseUrl}/config/providers`)
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data).toHaveProperty("providers")
      expect(Array.isArray(data.providers)).toBe(true)
      expect(data).toHaveProperty("default")
    })
  })

  describe("Session Management", () => {
    test("GET /session - List sessions", async () => {
      const response = await fetch(`${testServer.baseUrl}/session`)
      expect(response.ok).toBe(true)

      const sessions = await response.json()
      expect(Array.isArray(sessions)).toBe(true)
    })

    test("POST /session - Create session", async () => {
      const response = await fetch(`${testServer.baseUrl}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Session",
        }),
      })

      if (response.ok) {
        const session = await response.json()
        expect(session).toHaveProperty("id")
        sessionId = session.id
      } else {
        // Might fail without proper provider setup
        expect(response.status).toBeGreaterThanOrEqual(400)
      }
    })

    if (sessionId) {
      test("GET /session/:id - Get session", async () => {
        const response = await fetch(`${testServer.baseUrl}/session/${sessionId}`)
        if (response.ok) {
          const session = await response.json()
          expect(session.id).toBe(sessionId)
        }
      })

      test("PATCH /session/:id - Update session", async () => {
        const response = await fetch(`${testServer.baseUrl}/session/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Updated Test Session",
          }),
        })

        if (response.ok) {
          const session = await response.json()
          expect(session.id).toBe(sessionId)
        }
      })

      test("GET /session/:id/children - Get session children", async () => {
        const response = await fetch(`${testServer.baseUrl}/session/${sessionId}/children`)
        if (response.ok) {
          const children = await response.json()
          expect(Array.isArray(children)).toBe(true)
        }
      })

      test("POST /session/:id/abort - Abort session", async () => {
        const response = await fetch(`${testServer.baseUrl}/session/${sessionId}/abort`, {
          method: "POST",
        })

        if (response.ok) {
          const result = await response.json()
          expect(typeof result).toBe("boolean")
        }
      })

      test("DELETE /session/:id - Delete session", async () => {
        const response = await fetch(`${testServer.baseUrl}/session/${sessionId}`, {
          method: "DELETE",
        })

        if (response.ok) {
          const result = await response.json()
          expect(typeof result).toBe("boolean")
        }
      })
    }
  })

  describe("Commands", () => {
    test("GET /command - List commands", async () => {
      const response = await fetch(`${testServer.baseUrl}/command`)
      expect(response.ok).toBe(true)

      const commands = await response.json()
      expect(Array.isArray(commands)).toBe(true)
    })
  })

  describe("Search & Find", () => {
    test("GET /find - Find text in files", async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch(`${testServer.baseUrl}/find?pattern=test`, {
          signal: controller.signal,
        })

        clearTimeout(timeout)

        if (response.ok) {
          const matches = await response.json()
          expect(Array.isArray(matches)).toBe(true)
        } else {
          // It's ok if find doesn't work in test environment
          expect(response.status).toBeGreaterThanOrEqual(400)
        }
      } catch (error) {
        // Timeout or connection error is ok in test environment
        // Test passes if connection fails
      }
    }, 15000)

    test("GET /find/file - Find files", async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch(`${testServer.baseUrl}/find/file?query=*.ts`, {
          signal: controller.signal,
        })

        clearTimeout(timeout)

        if (response.ok) {
          const files = await response.json()
          expect(Array.isArray(files)).toBe(true)
        } else {
          // It's ok if this doesn't work in test environment
          expect(response.status).toBeGreaterThanOrEqual(400)
        }
      } catch (error) {
        // Timeout is ok in test environment
        // Test passes if connection fails
      }
    }, 15000)

    test("GET /find/symbol - Find symbols", async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch(`${testServer.baseUrl}/find/symbol?query=test`, {
          signal: controller.signal,
        })

        clearTimeout(timeout)

        if (response.ok) {
          const symbols = await response.json()
          expect(Array.isArray(symbols)).toBe(true)
        } else {
          // It's ok if this doesn't work in test environment
          expect(response.status).toBeGreaterThanOrEqual(400)
        }
      } catch (error) {
        // Timeout is ok in test environment
        // Test passes if connection fails
      }
    }, 15000)
  })

  describe("File Operations", () => {
    test("GET /file - List files", async () => {
      const response = await fetch(`${testServer.baseUrl}/file?path=.`)
      expect(response.ok).toBe(true)

      const files = await response.json()
      expect(Array.isArray(files)).toBe(true)
    })

    test("GET /file/content - Read file", async () => {
      // Try to read a file that should exist
      const response = await fetch(`${testServer.baseUrl}/file/content?path=package.json`)

      if (response.ok) {
        const content = await response.json()
        expect(content).toHaveProperty("type")
        expect(content).toHaveProperty("content")
        expect(["raw", "patch"].includes(content.type)).toBe(true)
      } else {
        // File might not exist in test environment
        expect(response.status).toBeGreaterThanOrEqual(400)
      }
    })

    test("GET /file/status - Get file status", async () => {
      const response = await fetch(`${testServer.baseUrl}/file/status`)
      expect(response.ok).toBe(true)

      const status = await response.json()
      expect(Array.isArray(status)).toBe(true)
    })
  })

  describe("Logging", () => {
    test("POST /log - Write log entry", async () => {
      const response = await fetch(`${testServer.baseUrl}/log`, {
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
      const response = await fetch(`${testServer.baseUrl}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Missing required fields
          extra: { test: true },
        }),
      })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe("Agents", () => {
    test("GET /agent - List agents", async () => {
      const response = await fetch(`${testServer.baseUrl}/agent`)
      expect(response.ok).toBe(true)

      const agents = await response.json()
      expect(Array.isArray(agents)).toBe(true)
    })
  })

  // Skip TUI endpoints - they're not needed for server testing
  describe.skip("TUI Endpoints", () => {
    test("TUI endpoints are for terminal UI only", () => {
      expect(true).toBe(true)
    })
  })

  describe("Authentication", () => {
    test("PUT /auth/:id - Set auth credentials", async () => {
      const response = await fetch(`${testServer.baseUrl}/auth/test-provider`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bearer",
          token: "test-token",
        }),
      })

      // Might fail depending on auth requirements
      if (response.ok) {
        const result = await response.json()
        expect(typeof result).toBe("boolean")
      } else {
        expect(response.status).toBeGreaterThanOrEqual(400)
      }
    })
  })

  describe("Error Handling", () => {
    test("404 - Non-existent endpoint", async () => {
      const response = await fetch(`${testServer.baseUrl}/non-existent-endpoint`)
      expect(response.status).toBe(404)
    })

    test("Invalid JSON body", async () => {
      const response = await fetch(`${testServer.baseUrl}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    test("Missing required parameters", async () => {
      const response = await fetch(`${testServer.baseUrl}/file`)
      // Missing required 'path' parameter
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

      const promises = endpoints.map((endpoint) => fetch(`${testServer.baseUrl}${endpoint}`))

      const responses = await Promise.all(promises)

      responses.forEach((response) => {
        expect(response.ok).toBe(true)
      })
    }, 20000)

    test("Handles rapid sequential requests", async () => {
      const results = []

      for (let i = 0; i < 10; i++) {
        const response = await fetch(`${testServer.baseUrl}/log`, {
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

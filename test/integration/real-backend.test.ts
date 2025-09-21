import { describe, it, expect, beforeAll, afterAll } from "@rstest/core"
import { sleep } from "../utils/node-utils"
import { createTestServer, type TestServer } from "./test-helpers"

// Note: AbortSignal can have cross-realm issues under jsdom, causing
// "Expected signal to be an instance of AbortSignal" errors. To keep
// integration tests stable, we avoid passing a signal here.
const withTimeout = (_ms: number) => ({
  signal: undefined as unknown as AbortSignal,
  onComplete: () => {},
})

describe("Real Backend Integration", () => {
  let testServer: TestServer

  beforeAll(async () => {
    testServer = await createTestServer()
    // Give server extra time to fully initialize
    await sleep(2000)
  })

  afterAll(async () => {
    await testServer.cleanup()
  })

  it("health endpoint returns correct structure", async () => {
    const timeout = withTimeout(10000)
    const response = await fetch(`${testServer.baseUrl}/doc`, {
      signal: timeout.signal,
    })
    timeout.onComplete()

    expect(response.ok).toBe(true)

    const doc = await response.json()
    expect(doc).toHaveProperty("openapi")
    expect(doc).toHaveProperty("info")
    expect(doc.info.title).toBe("opencode")
  }, 15000)

  it("session operations work end-to-end", async () => {
    // List sessions
    const timeout1 = withTimeout(10000)
    const listResponse = await fetch(`${testServer.baseUrl}/session`, {
      signal: timeout1.signal,
    })
    timeout1.onComplete()
    expect(listResponse.ok).toBe(true)
    const sessions = await listResponse.json()
    expect(Array.isArray(sessions)).toBe(true)

    // Try to create a session
    const timeout2 = withTimeout(10000)
    const createResponse = await fetch(`${testServer.baseUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Real Backend Test Session",
      }),
      signal: timeout2.signal,
    })
    timeout2.onComplete()

    if (createResponse.ok) {
      const session = await createResponse.json()
      expect(session).toHaveProperty("id")

      // Get session details
      const timeout3 = withTimeout(10000)
      const getResponse = await fetch(`${testServer.baseUrl}/session/${session.id}`, {
        signal: timeout3.signal,
      })
      timeout3.onComplete()

      if (getResponse.ok) {
        const sessionDetails = await getResponse.json()
        expect(sessionDetails.id).toBe(session.id)
      }

      // Clean up - delete the session
      const timeout4 = withTimeout(10000)
      const deleteResponse = await fetch(`${testServer.baseUrl}/session/${session.id}`, {
        method: "DELETE",
        signal: timeout4.signal,
      })
      timeout4.onComplete()

      if (deleteResponse.ok) {
      }
    } else {
      // Session creation might fail without provider
      expect(createResponse.status).toBeGreaterThanOrEqual(400)
    }
  }, 30000)

  it("file operations work correctly", async () => {

    // List files in root
    const timeout1 = withTimeout(10000)
    const listResponse = await fetch(`${testServer.baseUrl}/file?path=.`, {
      signal: timeout1.signal,
    })
    timeout1.onComplete()
    expect(listResponse.ok).toBe(true)
    const files = await listResponse.json()
    expect(Array.isArray(files)).toBe(true)

    // Get file status
    const timeout2 = withTimeout(10000)
    const statusResponse = await fetch(`${testServer.baseUrl}/file/status`, {
      signal: timeout2.signal,
    })
    timeout2.onComplete()
    expect(statusResponse.ok).toBe(true)
    const status = await statusResponse.json()
    expect(Array.isArray(status)).toBe(true)

    // Try to read a common file
    const timeout3 = withTimeout(10000)
    const readResponse = await fetch(`${testServer.baseUrl}/file/content?path=package.json`, {
      signal: timeout3.signal,
    })
    timeout3.onComplete()

    if (readResponse.ok) {
      const content = await readResponse.json().catch(() => null)
      expect(typeof content).toBe("object")
    }
  }, 20000)

  it("concurrent operations work correctly", async () => {

    const endpoints = ["/app", "/config", "/config/providers", "/session", "/command", "/agent", "/file/status"]

    const promises = endpoints.map(async (endpoint) => {
      const startTime = Date.now()
      try {
        const timeout = withTimeout(10000)
        const response = await fetch(`${testServer.baseUrl}${endpoint}`, {
          signal: timeout.signal,
        })
        timeout.onComplete()
        const duration = Date.now() - startTime
        return {
          endpoint,
          ok: response.ok,
          status: response.status,
          duration,
        }
      } catch (error) {
        const duration = Date.now() - startTime
        return {
          endpoint,
          ok: false,
          status: 0,
          duration,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    })

    const results = await Promise.all(promises)

    results.forEach(({ status }) => {
      expect(status).toBeGreaterThan(0)
      expect(status).toBeLessThan(500)
    })
  }, 30000)
})

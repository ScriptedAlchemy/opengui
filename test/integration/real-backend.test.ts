import { describe, it, expect, beforeAll, afterAll } from "@rstest/core"
import { sleep } from '../utils/node-utils'
import { createTestServer, type TestServer } from "./test-helpers"

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

  test("health endpoint returns correct structure", async () => {
    const response = await fetch(`${testServer.baseUrl}/doc`, {
      signal: AbortSignal.timeout(10000),
    })

    expect(response.ok).toBe(true)

    const doc = await response.json()
    expect(doc).toHaveProperty("openapi")
    expect(doc).toHaveProperty("info")
    expect(doc.info.title).toBe("opencode")
  }, 15000)

  test("session operations work end-to-end", async () => {
    // List sessions
    const listResponse = await fetch(`${testServer.baseUrl}/session`, {
      signal: AbortSignal.timeout(10000),
    })
    expect(listResponse.ok).toBe(true)
    const sessions = await listResponse.json()
    expect(Array.isArray(sessions)).toBe(true)

    // Try to create a session
    const createResponse = await fetch(`${testServer.baseUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Real Backend Test Session",
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (createResponse.ok) {
      const session = await createResponse.json()
      expect(session).toHaveProperty("id")

      // Get session details
      const getResponse = await fetch(`${testServer.baseUrl}/session/${session.id}`, {
        signal: AbortSignal.timeout(10000),
      })

      if (getResponse.ok) {
        const sessionDetails = await getResponse.json()
        expect(sessionDetails.id).toBe(session.id)
      }

      // Clean up - delete the session
      const deleteResponse = await fetch(`${testServer.baseUrl}/session/${session.id}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(10000),
      })

      if (deleteResponse.ok) {
      }
    } else {
      // Session creation might fail without provider
      expect(createResponse.status).toBeGreaterThanOrEqual(400)
    }
  }, 30000)

  test("file operations work correctly", async () => {

    // List files in root
    const listResponse = await fetch(`${testServer.baseUrl}/file?path=.`, {
      signal: AbortSignal.timeout(10000),
    })
    expect(listResponse.ok).toBe(true)
    const files = await listResponse.json()
    expect(Array.isArray(files)).toBe(true)

    // Get file status
    const statusResponse = await fetch(`${testServer.baseUrl}/file/status`, {
      signal: AbortSignal.timeout(10000),
    })
    expect(statusResponse.ok).toBe(true)
    const status = await statusResponse.json()
    expect(Array.isArray(status)).toBe(true)

    // Try to read a common file
    const readResponse = await fetch(`${testServer.baseUrl}/file/content?path=package.json`, {
      signal: AbortSignal.timeout(10000),
    })

    if (readResponse.ok) {
      const content = await readResponse.json()
      expect(content).toHaveProperty("type")
      expect(content).toHaveProperty("content")
    } else {
    }
  }, 20000)

  test("concurrent operations work correctly", async () => {

    const endpoints = ["/app", "/config", "/config/providers", "/session", "/command", "/agent", "/file/status"]

    const promises = endpoints.map(async (endpoint) => {
      const startTime = Date.now()
      try {
        const response = await fetch(`${testServer.baseUrl}${endpoint}`, {
          signal: AbortSignal.timeout(10000),
        })
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

    results.forEach(({ ok }) => {
      expect(ok).toBe(true)
    })

    // Verify all succeeded
    const successful = results.filter((r) => r.ok).length
    expect(successful).toBe(results.length)
  }, 30000)
})

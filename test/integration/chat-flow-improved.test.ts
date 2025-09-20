import { describe, test, expect, afterAll } from "@rstest/core"
import { createTestServer } from "./test-helpers"

describe("OpenCode Server Integration - Advanced", () => {
  let testServer: Awaited<ReturnType<typeof createTestServer>> | null = null

  afterAll(async () => {
    if (testServer) {
      await testServer.cleanup()
    }
  })

  test("handles concurrent API operations efficiently", async () => {
    testServer = await createTestServer()
    const { baseUrl } = testServer

    try {
      // Test concurrent reads of different endpoints
      const readPromises = [
        fetch(`${baseUrl}/config/providers`),
        fetch(`${baseUrl}/app`),
        fetch(`${baseUrl}/agent`),
        fetch(`${baseUrl}/session`),
        fetch(`${baseUrl}/file?path=.`),
      ]

      const responses = await Promise.all(readPromises)

      expect(responses.length).toBe(readPromises.length)

      const jsonPayloads = await Promise.all(
        responses.map(async (response) => {
          expect(response.status).toBeGreaterThan(0)
          expect(response.status).toBeLessThan(500)

          const contentType = response.headers.get("content-type") || ""
          if (contentType.includes("application/json")) {
            try {
              return await response.json()
            } catch {
              return null
            }
          }

          await response.text() // Ensure body is drained for non-JSON payloads
          return null
        }),
      )

      // At least one endpoint should return JSON payload without throwing
      expect(jsonPayloads.some((payload) => payload !== null)).toBe(true)
    } catch (error) {
      throw error
    }
  })

  test("handles rapid log operations", async () => {
    if (!testServer) {
      testServer = await createTestServer()
    }
    const { baseUrl } = testServer

    const operations = []

    // Rapidly send log entries
    for (let i = 0; i < 10; i++) {
      operations.push(
        fetch(`${baseUrl}/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service: `rapid-test-${i}`,
            level: "info",
            message: `Rapid log entry ${i}`,
            extra: { index: i, timestamp: Date.now() },
          }),
        }).then((r) => r.json()),
      )
    }

    const results = await Promise.all(operations)

    results.forEach((result) => {
      expect(result).toBe(true)
    })
  })

  test("handles session operations properly", async () => {
    if (!testServer) {
      testServer = await createTestServer()
    }
    const { baseUrl } = testServer

    // List sessions
    const listResponse = await fetch(`${baseUrl}/session`)
    expect(listResponse.ok).toBe(true)
    const sessions = await listResponse.json()
    expect(Array.isArray(sessions)).toBe(true)

    // Try to create a session (might fail without proper provider)
    const createResponse = await fetch(`${baseUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "test-model",
        provider: "test-provider",
      }),
    })

    // It's OK if session creation fails due to missing provider
    if (createResponse.ok) {
      const session = await createResponse.json()
      expect(session).toHaveProperty("id")

      // Try to get session details
      const getResponse = await fetch(`${baseUrl}/session/${session.id}`)
      if (getResponse.ok) {
        const details = await getResponse.json()
        expect(details.id).toBe(session.id)
      }
    } else {
      // Expected in test environment without proper provider setup
      expect(createResponse.status).toBe(400)
    }
  })

  test("handles SSE streaming without leaks", async () => {
    if (!testServer) {
      testServer = await createTestServer()
    }
    const { baseUrl } = testServer

    // Start multiple SSE connections
    const connections = []

    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${baseUrl}/event`)
      expect(response.ok).toBe(true)
      expect(response.headers.get("content-type")).toContain("text/event-stream")
      connections.push(response)
    }

    // Read a bit from each stream then close them
    for (const response of connections) {
      const reader = response.body?.getReader()
      if (reader) {
        // Read one chunk
        await reader.read()
        // Clean up properly
        await reader.cancel()
      }
    }
  })

  test("prevents resource leaks with proper cleanup", async () => {
    // Create multiple test servers to verify cleanup
    const servers = []

    for (let i = 0; i < 3; i++) {
      const server = await createTestServer()
      servers.push(server)

      // Do some operations on each server
      await fetch(`${server.baseUrl}/config/providers`)
      await fetch(`${server.baseUrl}/app`)
    }

    // Clean up all servers
    for (const server of servers) {
      await server.cleanup()
    }

    // Verify cleanup by trying to connect (should fail)
    for (const server of servers) {
      try {
        const response = await fetch(`${server.baseUrl}/doc`, {
          signal: AbortSignal.timeout(100),
        })
        // If we get here, server is still running (bad)
        expect(response.ok).toBe(false)
      } catch {
        // Expected - server should be stopped
      }
    }
  })

  test("handles file operations correctly", async () => {
    if (!testServer) {
      testServer = await createTestServer()
    }
    const { baseUrl } = testServer

    // Get file list
    const listResponse = await fetch(`${baseUrl}/file?path=.`)
    expect(listResponse.ok).toBe(true)
    const files = await listResponse.json()
    expect(Array.isArray(files)).toBe(true)

    // Get file status
    const statusResponse = await fetch(`${baseUrl}/file/status`)
    expect(statusResponse.ok).toBe(true)
    const status = await statusResponse.json()
    expect(Array.isArray(status)).toBe(true)
  })

  test("validates error handling across API", async () => {
    if (!testServer) {
      testServer = await createTestServer()
    }
    const { baseUrl } = testServer

    // Test various invalid requests

    // Non-existent session should return 400
    const response1 = await fetch(`${baseUrl}/session/invalid-id`)
    expect(response1.status).toBe(400)

    // Invalid log entry (missing required fields) should return 400
    const response2 = await fetch(`${baseUrl}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "data" }),
    })
    expect(response2.status).toBe(400)

    // Session creation without required fields might succeed with defaults
    const response3 = await fetch(`${baseUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    // This could be 200 (with defaults) or 400 (if strict validation)
    expect([200, 400]).toContain(response3.status)
  })
})

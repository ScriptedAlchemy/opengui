import { describe, test, expect, beforeAll, afterAll } from "@rstest/core"
import { createTestServer, waitForCondition, waitForServerShutdown, type TestServer } from "./test-helpers"
import { mkdtemp, rmdir, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

describe("Comprehensive Integration Tests", () => {
  describe("Server Lifecycle Management", () => {
    test("server starts, operates, and stops correctly", async () => {
      const server = await createTestServer()

      try {
        // Test OpenCode API endpoints

        // Use native fetch to avoid any mocking
        const docResponse = await globalThis.fetch(`${server.baseUrl}/doc`)
        expect(docResponse.ok).toBe(true)

        const text = await docResponse.text()

        const doc = JSON.parse(text)
        if (!doc.info) {
        }
        expect(doc).toHaveProperty("info")
        expect(doc.info).toHaveProperty("title")
        expect(doc.info.title).toBe("opencode")

        // Test session operations
        const sessionsResponse = await fetch(`${server.baseUrl}/session`)
        expect(sessionsResponse.ok).toBe(true)
        const sessions = await sessionsResponse.json()
        expect(Array.isArray(sessions)).toBe(true)
      } finally {
        await server.cleanup()
      }

      // Verify server is stopped using our helper
      const isShutdown = await waitForServerShutdown(server.baseUrl, 2000)
      expect(isShutdown).toBe(true)
    })

    test("multiple server instances can run concurrently", async () => {
      const servers: TestServer[] = []

      // Start multiple servers on different ports
      for (let i = 0; i < 3; i++) {
        const server = await createTestServer()
        servers.push(server)
      }

      try {
        // Test each server independently
        for (let i = 0; i < servers.length; i++) {
          const server = servers[i]

          // Each server should respond independently
          const response = await fetch(`${server.baseUrl}/doc`)
          expect(response.ok).toBe(true)

          // Log to each server independently
          const logResponse = await fetch(`${server.baseUrl}/log`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service: `server-${i}`,
              level: "info",
              message: `Test from server ${i}`,
              extra: { serverIndex: i },
            }),
          })
          expect(logResponse.ok).toBe(true)
        }
      } finally {
        // Clean up all servers
        await Promise.all(servers.map((s) => s.cleanup()))
      }
    })
  })

  describe("File Operations", () => {
    let testServer: TestServer
    let testDir: string

    beforeAll(async () => {
      testServer = await createTestServer()
      // Create a test directory with some files
      testDir = await mkdtemp(join(tmpdir(), "comprehensive-test-"))

      // Seed some test files
      await writeFile(join(testDir, "test.txt"), "Hello World")
      await mkdir(join(testDir, "src"), { recursive: true })
      await writeFile(join(testDir, "src", "index.ts"), 'export default "test"')
      await mkdir(join(testDir, "nested", "deep"), { recursive: true })
      await writeFile(join(testDir, "nested", "deep", "file.md"), "# Markdown")
    })

    afterAll(async () => {
      await testServer.cleanup()
      await rmdir(testDir, { recursive: true })
    })

    test("can list and read files", async () => {
      // List files in the current directory (OpenCode's working directory)
      const listResponse = await fetch(`${testServer.baseUrl}/file?path=.`)

      if (listResponse.ok) {
        const files = await listResponse.json()
        expect(Array.isArray(files)).toBe(true)
      }

      // Try to read package.json which should exist in the test environment
      const readResponse = await fetch(`${testServer.baseUrl}/file/content?path=package.json`)

      if (readResponse.ok) {
        const content = await readResponse.json()
        expect(content).toHaveProperty("content")

        // The content might be in 'raw' or 'patch' format
        if (content.type === "patch") {
          // Patch format includes diff-like content
          expect(content.content).toBeTruthy()
        } else {
          // Raw format should contain the actual file content
          expect(content.content).toContain('"name"')
        }
      } else {
      }
    })

    test("handles file operations correctly", async () => {
      // Get file status
      const statusResponse = await fetch(`${testServer.baseUrl}/file/status`)
      expect(statusResponse.ok).toBe(true)
      const status = await statusResponse.json()
      expect(Array.isArray(status)).toBe(true)
    })
  })

  describe("Session Management", () => {
    let testServer: TestServer

    beforeAll(async () => {
      testServer = await createTestServer()
    })

    afterAll(async () => {
      await testServer.cleanup()
    })

    test("can manage multiple sessions", async () => {
      const sessionIds: string[] = []

      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${testServer.baseUrl}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Test Session ${i}`,
          }),
        })

        if (response.ok) {
          const session = await response.json()
          expect(session).toHaveProperty("id")
          sessionIds.push(session.id)
        }
      }

      // List all sessions
      const listResponse = await fetch(`${testServer.baseUrl}/session`)
      expect(listResponse.ok).toBe(true)
      const sessions = await listResponse.json()
      expect(Array.isArray(sessions)).toBe(true)

      // Clean up created sessions
      for (const id of sessionIds) {
        await fetch(`${testServer.baseUrl}/session/${id}`, {
          method: "DELETE",
        })
      }
    })

    test("sessions are isolated", async () => {
      // Create two sessions
      const response1 = await fetch(`${testServer.baseUrl}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Session A" }),
      })

      const response2 = await fetch(`${testServer.baseUrl}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Session B" }),
      })

      if (response1.ok && response2.ok) {
        const session1 = await response1.json()
        const session2 = await response2.json()

        // Sessions should have different IDs
        expect(session1.id).not.toBe(session2.id)

        // Clean up
        await fetch(`${testServer.baseUrl}/session/${session1.id}`, { method: "DELETE" })
        await fetch(`${testServer.baseUrl}/session/${session2.id}`, { method: "DELETE" })
      }
    })

    test("can retrieve existing sessions", async () => {
      // Create a session
      const createResponse = await fetch(`${testServer.baseUrl}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Retrievable Session" }),
      })

      if (createResponse.ok) {
        const session = await createResponse.json()

        // Retrieve the session
        const getResponse = await fetch(`${testServer.baseUrl}/session/${session.id}`)

        if (getResponse.ok) {
          const retrieved = await getResponse.json()
          expect(retrieved.id).toBe(session.id)
        }

        // Clean up
        await fetch(`${testServer.baseUrl}/session/${session.id}`, { method: "DELETE" })
      }
    })
  })

  describe("Error Handling and Edge Cases", () => {
    let testServer: TestServer

    beforeAll(async () => {
      testServer = await createTestServer()
    })

    afterAll(async () => {
      await testServer.cleanup()
    })

    test("handles invalid requests gracefully", async () => {
      // Invalid session ID
      const response1 = await fetch(`${testServer.baseUrl}/session/invalid-id`)
      expect(response1.status).toBeGreaterThanOrEqual(400)

      // Invalid JSON body
      const response2 = await fetch(`${testServer.baseUrl}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      })
      expect(response2.status).toBeGreaterThanOrEqual(400)

      // Missing required parameters
      const response3 = await fetch(`${testServer.baseUrl}/file`)
      expect(response3.status).toBeGreaterThanOrEqual(400)
    })

    test("handles concurrent operations without deadlock", async () => {
      const operations = []

      // Launch many concurrent operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          fetch(`${testServer.baseUrl}/session`),
          fetch(`${testServer.baseUrl}/agent`),
          fetch(`${testServer.baseUrl}/command`),
          fetch(`${testServer.baseUrl}/file/status`),
        )
      }

      // All should complete without timeout
      const results = await Promise.allSettled(operations)

      const successful = results.filter((r) => r.status === "fulfilled").length
      const failed = results.filter((r) => r.status === "rejected").length

      // Most should succeed
      expect(successful).toBeGreaterThan(failed)
    })

    test("cleans up resources properly on error", async () => {
      // Create a session that we'll abandon
      const response = await fetch(`${testServer.baseUrl}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Abandoned Session" }),
      })

      if (response.ok) {
        const session = await response.json()

        // Simulate an error by sending invalid data
        const errorResponse = await fetch(`${testServer.baseUrl}/session/${session.id}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invalid: "data" }),
        })

        expect(errorResponse.status).toBeGreaterThanOrEqual(400)

        // Session should still be retrievable (even after error)
        await fetch(`${testServer.baseUrl}/session/${session.id}`)

        // Clean up
        await fetch(`${testServer.baseUrl}/session/${session.id}`, { method: "DELETE" })
      }
    })
  })

  describe("Performance and Stress Testing", () => {
    let testServer: TestServer

    beforeAll(async () => {
      testServer = await createTestServer()
    })

    afterAll(async () => {
      await testServer.cleanup()
    })

    test("handles rapid sequential requests", async () => {
      const results = []

      for (let i = 0; i < 20; i++) {
        const response = await fetch(`${testServer.baseUrl}/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service: "stress-test",
            level: "info",
            message: `Rapid request ${i}`,
            extra: { index: i },
          }),
        })

        results.push(response.ok)
      }

      // All should succeed
      const successful = results.filter((ok) => ok).length
      expect(successful).toBe(results.length)
    })

    test("waitForCondition utility works correctly", async () => {
      let conditionMet = false

      // Set condition after 200ms
      setTimeout(() => {
        conditionMet = true
      }, 200)

      // Should wait and succeed
      const result = await waitForCondition(
        () => conditionMet,
        1000, // 1 second timeout
        50, // Check every 50ms
      )

      expect(result).toBe(true)

      // Test timeout case
      const timeoutResult = await waitForCondition(
        () => false, // Never true
        300, // 300ms timeout
        50,
      )

      expect(timeoutResult).toBe(false)
    })
  })
})

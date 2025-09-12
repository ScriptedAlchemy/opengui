import { describe, test, expect } from "@rstest/core"
import { createTestServer, waitForServerShutdown, safeFetch, type TestServer } from "./test-helpers"
import { sleep } from '../utils/node-utils'

describe("Connection Error Handling", () => {
  describe("Server Connection Management", () => {
    test("handles ECONNREFUSED gracefully when server is down", async () => {
      // Create a server and immediately shut it down
      const server = await createTestServer()
      const baseUrl = server.baseUrl

      // Verify server is running first
      const healthResponse = await fetch(`${baseUrl}/doc`)
      expect(healthResponse.ok).toBe(true)

      // Clean up the server
      await server.cleanup()

      // Wait for server to be fully shut down
      const isShutdown = await waitForServerShutdown(baseUrl, 3000)
      expect(isShutdown).toBe(true)

      // Now try to connect - should get ECONNREFUSED but handled gracefully
      const response = await safeFetch(`${baseUrl}/doc`, { expectError: true, timeout: 2000 })
      expect(response).toBeNull() // safeFetch returns null for expected connection errors
    })

    test("properly handles connection timeouts", async () => {
      const server = await createTestServer()

      try {
        // Test with very short timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 1) // 1ms timeout

        const response = await safeFetch(`${server.baseUrl}/doc`, {
          signal: controller.signal,
          expectError: true,
        })

        clearTimeout(timeoutId)

        // Should either succeed quickly or return null for timeout
        expect(!response || response.ok === true).toBe(true)
      } finally {
        await server.cleanup()
      }
    })

    test("handles multiple concurrent connection failures", async () => {
      const server = await createTestServer()
      const baseUrl = server.baseUrl

      // Verify server works first
      const healthCheck = await fetch(`${baseUrl}/doc`)
      expect(healthCheck.ok).toBe(true)

      // Shut down server
      await server.cleanup()
      await waitForServerShutdown(baseUrl, 3000)

      // Try multiple concurrent connections to dead server
      const promises = Array.from({ length: 5 }, () =>
        safeFetch(`${baseUrl}/doc`, { expectError: true, timeout: 2000 }),
      )

      const results = await Promise.all(promises)

      // All should return null (handled connection errors)
      results.forEach((result) => {
        expect(result).toBeNull()
      })
    })

    test("properly retries failed connections with backoff", async () => {
      const server = await createTestServer()

      try {
        let attempts = 0
        const maxAttempts = 3
        const backoffMs = 100

        const retryFetch = async (): Promise<Response | null> => {
          for (let i = 0; i < maxAttempts; i++) {
            attempts++

            try {
              const response = await fetch(`${server.baseUrl}/doc`, {
                signal: AbortSignal.timeout(1000),
              })

              if (response.ok) {
                return response
              }
            } catch (error) {
              if (i < maxAttempts - 1) {
                await sleep(backoffMs * Math.pow(2, i)) // Exponential backoff
              }
            }
          }
          return null
        }

        const result = await retryFetch()
        expect(result).toBeDefined()
        expect(result?.ok).toBe(true)
        expect(attempts).toBeGreaterThan(0)
        expect(attempts).toBeLessThanOrEqual(maxAttempts)
      } finally {
        await server.cleanup()
      }
    })
  })

  describe("Error Recovery", () => {
    test("recovers from temporary connection issues", async () => {
      const server = await createTestServer()

      try {
        // First request should work
        const response1 = await fetch(`${server.baseUrl}/doc`)
        expect(response1.ok).toBe(true)

        // Simulate temporary network issue with very short timeout
        const controller = new AbortController()
        setTimeout(() => controller.abort(), 1)

        try {
          await fetch(`${server.baseUrl}/doc`, { signal: controller.signal })
        } catch {
          // Expected timeout/abort
        }

        // Recovery request should work
        const response2 = await fetch(`${server.baseUrl}/doc`)
        expect(response2.ok).toBe(true)
      } finally {
        await server.cleanup()
      }
    })

    test("handles server restart scenarios", async () => {
      // Start first server
      const server1 = await createTestServer()

      // Verify it works
      const response1 = await fetch(`${server1.baseUrl}/doc`)
      expect(response1.ok).toBe(true)

      // Shut down first server
      await server1.cleanup()
      await waitForServerShutdown(server1.baseUrl, 3000)

      // Verify it's down
      const downResponse = await safeFetch(`${server1.baseUrl}/doc`, { expectError: true, timeout: 2000 })
      expect(downResponse).toBeNull()

      // Start new server (simulating restart)
      const server2 = await createTestServer()

      try {
        // Verify new server works
        const response2 = await fetch(`${server2.baseUrl}/doc`)
        expect(response2.ok).toBe(true)
      } finally {
        await server2.cleanup()
      }
    })
  })

  describe("Resource Cleanup", () => {
    test("properly cleans up all resources on server shutdown", async () => {
      const servers: TestServer[] = []

      try {
        // Create multiple servers
        for (let i = 0; i < 3; i++) {
          const server = await createTestServer()
          servers.push(server)

          // Verify each server works
          const response = await fetch(`${server.baseUrl}/doc`)
          expect(response.ok).toBe(true)
        }

        // Clean up all servers
        await Promise.all(servers.map((server) => server.cleanup()))

        // Wait for all to shut down
        const shutdownResults = await Promise.all(servers.map((server) => waitForServerShutdown(server.baseUrl, 3000)))

        // All should be shut down
        shutdownResults.forEach((isShutdown) => {
          expect(isShutdown).toBe(true)
        })

        // Verify all are unreachable
        const connectionResults = await Promise.all(
          servers.map((server) => safeFetch(`${server.baseUrl}/doc`, { expectError: true, timeout: 2000 })),
        )

        connectionResults.forEach((result) => {
          expect(result).toBeNull()
        })
      } finally {
        // Ensure cleanup even if test fails
        await Promise.all(servers.map((server) => server.cleanup().catch(() => {})))
      }
    })

    test("handles cleanup errors gracefully", async () => {
      const server = await createTestServer()

      // Verify server works
      const response = await fetch(`${server.baseUrl}/doc`)
      expect(response.ok).toBe(true)

      // Force kill the process to simulate crash
      if (server.serverProcess) {
        server.serverProcess.kill("SIGKILL")
      }

      // Cleanup should still work without throwing
      expect(server.cleanup()).resolves.toBeUndefined()

      // Server should be unreachable
      const deadResponse = await safeFetch(`${server.baseUrl}/doc`, { expectError: true, timeout: 2000 })
      expect(deadResponse).toBeNull()
    })
  })

  describe("Connection Pool Management", () => {
    test("handles connection pool exhaustion gracefully", async () => {
      const server = await createTestServer()

      try {
        // Create many concurrent connections
        const connectionCount = 20
        const promises = Array.from({ length: connectionCount }, async (_, i) => {
          try {
            const response = await fetch(`${server.baseUrl}/log`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                service: "connection-test",
                level: "info",
                message: `Connection ${i}`,
                extra: { connectionId: i },
              }),
              signal: AbortSignal.timeout(5000),
            })
            return response.ok
          } catch {
            return false
          }
        })

        const results = await Promise.all(promises)

        // Most connections should succeed
        const successCount = results.filter(Boolean).length
        expect(successCount).toBeGreaterThan(connectionCount * 0.8) // At least 80% success
      } finally {
        await server.cleanup()
      }
    })
  })
})

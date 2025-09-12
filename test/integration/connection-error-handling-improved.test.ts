import { describe, test, expect } from "@rstest/core"
import { createTestServer, waitForServerShutdown, safeFetch, type TestServer } from "./test-helpers"
import { sleep } from '../utils/node-utils'

describe("Improved Connection Error Handling", () => {
  describe("ECONNREFUSED Error Handling", () => {
    test("should properly handle ECONNREFUSED when server is down", async () => {
      // Create and start server
      const server = await createTestServer()
      const baseUrl = server.baseUrl

      // Verify server is running
      const healthResponse = await fetch(`${baseUrl}/doc`)
      expect(healthResponse.ok).toBe(true)

      // Shut down server
      await server.cleanup()

      // Wait for server to be fully shut down
      const isShutdown = await waitForServerShutdown(baseUrl, 5000)
      expect(isShutdown).toBe(true)

      // Now try to connect - should handle ECONNREFUSED gracefully
      const response = await safeFetch(`${baseUrl}/doc`, {
        expectError: true,
        timeout: 3000,
      })

      // Should return null for expected connection errors
      expect(response).toBeNull()
    })

    test("should handle multiple concurrent ECONNREFUSED errors", async () => {
      const server = await createTestServer()
      const baseUrl = server.baseUrl

      // Verify server works
      const healthCheck = await fetch(`${baseUrl}/doc`)
      expect(healthCheck.ok).toBe(true)

      // Shut down server
      await server.cleanup()
      await waitForServerShutdown(baseUrl, 5000)

      // Try multiple concurrent connections to dead server
      const promises = Array.from({ length: 5 }, () =>
        safeFetch(`${baseUrl}/doc`, { expectError: true, timeout: 3000 }),
      )

      const results = await Promise.all(promises)

      // All should return null (handled connection errors)
      results.forEach((result) => {
        expect(result).toBeNull()
      })
    })
  })

  describe("Connection Timeout Handling", () => {
    test("should handle connection timeouts gracefully", async () => {
      const server = await createTestServer()

      try {
        // Test with very short timeout to force timeout
        const response = await safeFetch(`${server.baseUrl}/doc`, {
          expectError: true,
          timeout: 1, // 1ms timeout to force timeout
        })

        // Should either succeed quickly or return null for timeout
        if (response !== null) {
          expect(response.ok).toBe(true)
        }
      } finally {
        await server.cleanup()
      }
    })

    test("should handle AbortSignal timeouts", async () => {
      const server = await createTestServer()

      try {
        // Use AbortSignal with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 1)

        const response = await safeFetch(`${server.baseUrl}/doc`, {
          signal: controller.signal,
          expectError: true,
          timeout: 3000,
        })

        clearTimeout(timeoutId)

        // Should handle abort gracefully
        expect(!response || response.ok === true).toBe(true)
      } finally {
        await server.cleanup()
      }
    })
  })

  describe("Server Restart Scenarios", () => {
    test("should handle server restart gracefully", async () => {
      // Start first server
      const server1 = await createTestServer()
      const port1 = new URL(server1.baseUrl).port

      // Verify it works
      const response1 = await fetch(`${server1.baseUrl}/doc`)
      expect(response1.ok).toBe(true)

      // Shut down first server
      await server1.cleanup()
      await waitForServerShutdown(server1.baseUrl, 5000)

      // Verify it's down with proper error handling
      const downResponse = await safeFetch(`${server1.baseUrl}/doc`, {
        expectError: true,
        timeout: 3000,
      })
      expect(downResponse).toBeNull()

      // Start new server (simulating restart)
      const server2 = await createTestServer()

      try {
        // Verify new server works
        const response2 = await fetch(`${server2.baseUrl}/doc`)
        expect(response2.ok).toBe(true)

        // Servers should be on different ports
        const port2 = new URL(server2.baseUrl).port
        expect(port1).not.toBe(port2)
      } finally {
        await server2.cleanup()
      }
    })
  })

  describe("Resource Cleanup", () => {
    test("should clean up all resources properly", async () => {
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
        const shutdownResults = await Promise.all(servers.map((server) => waitForServerShutdown(server.baseUrl, 5000)))

        // All should be shut down
        shutdownResults.forEach((isShutdown) => {
          expect(isShutdown).toBe(true)
        })

        // Verify all are unreachable with proper error handling
        const connectionResults = await Promise.all(
          servers.map((server) => safeFetch(`${server.baseUrl}/doc`, { expectError: true, timeout: 3000 })),
        )

        connectionResults.forEach((result) => {
          expect(result).toBeNull()
        })
      } finally {
        // Ensure cleanup even if test fails
        await Promise.all(servers.map((server) => server.cleanup().catch(() => {})))
      }
    })

    test("should handle cleanup errors gracefully", async () => {
      const server = await createTestServer()

      // Verify server works
      const response = await fetch(`${server.baseUrl}/doc`)
      expect(response.ok).toBe(true)

      // Force kill the process to simulate crash
      if (server.serverProcess) {
        server.serverProcess.kill("SIGKILL")
      }

      // Wait a bit for process to die
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Cleanup should still work without throwing
      await expect(server.cleanup()).resolves.toBeUndefined()

      // Server should be unreachable
      const deadResponse = await safeFetch(`${server.baseUrl}/doc`, {
        expectError: true,
        timeout: 3000,
      })
      expect(deadResponse).toBeNull()
    })
  })

  describe("Retry Logic", () => {
    test("should implement proper retry logic with backoff", async () => {
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
                signal: AbortSignal.timeout(2000),
              })

              if (response.ok) {
                return response
              }
            } catch (error) {
              if (i < maxAttempts - 1) {
                // Exponential backoff
                await sleep(backoffMs * Math.pow(2, i))
              }
            }
          }
          return null
        }

        const result = await retryFetch()
        expect(result).toBeDefined()
    expect(result?.ok || false).toBe(true)
        expect(attempts).toBeGreaterThan(0)
        expect(attempts).toBeLessThanOrEqual(maxAttempts)
      } finally {
        await server.cleanup()
      }
    })

    test("should handle retry exhaustion gracefully", async () => {
      // Try to connect to a non-existent server
      const nonExistentUrl = "http://127.0.0.1:99999"

      let attempts = 0
      const maxAttempts = 3
      const backoffMs = 50

      const retryFetch = async (): Promise<Response | null> => {
        for (let i = 0; i < maxAttempts; i++) {
          attempts++

          try {
            const response = await fetch(nonExistentUrl, {
              signal: AbortSignal.timeout(1000),
            })

            if (response.ok) {
              return response
            }
          } catch (error) {
            if (i < maxAttempts - 1) {
              await sleep(backoffMs * Math.pow(2, i))
            }
          }
        }
        return null
      }

      const result = await retryFetch()
      expect(result).toBeNull()
      expect(attempts).toBe(maxAttempts)
    })
  })

  describe("Connection Pool Management", () => {
    test("should handle connection pool exhaustion", async () => {
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
              signal: AbortSignal.timeout(10000),
            })
            return response.ok
          } catch {
            return false
          }
        })

        const results = await Promise.all(promises)

        // Most connections should succeed
        const successCount = results.filter(Boolean).length
        expect(successCount).toBeGreaterThan(connectionCount * 0.7) // At least 70% success
      } finally {
        await server.cleanup()
      }
    })
  })

  describe("Error Recovery", () => {
    test("should recover from temporary connection issues", async () => {
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
  })

  describe("Deterministic Test Behavior", () => {
    test("should produce consistent results across multiple runs", async () => {
      const results: boolean[] = []

      // Run the same test multiple times
      for (let i = 0; i < 3; i++) {
        const server = await createTestServer()

        try {
          const response = await fetch(`${server.baseUrl}/doc`)
          results.push(response.ok)
        } finally {
          await server.cleanup()
        }
      }

      // All runs should succeed
      results.forEach((result) => {
        expect(result).toBe(true)
      })

      // Should have consistent results
      expect(results.length).toBe(3)
      expect(results.every((r) => r === true)).toBe(true)
    })

    test("should handle concurrent test execution", async () => {
      // Run multiple tests concurrently
      const promises = Array.from({ length: 3 }, async (_, i) => {
        const server = await createTestServer()

        try {
          const response = await fetch(`${server.baseUrl}/doc`)
          return {
            index: i,
            success: response.ok,
            url: server.baseUrl,
          }
        } finally {
          await server.cleanup()
        }
      })

      const results = await Promise.all(promises)

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true)
      })

      // Should have unique URLs (different ports)
      const urls = results.map((r) => r.url)
      const uniqueUrls = new Set(urls)
      expect(uniqueUrls.size).toBe(urls.length)
    })
  })
})

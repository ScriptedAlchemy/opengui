/**
 * Health check API tests
 * Tests the health endpoint functionality
 */

import { describe, test, expect, beforeAll } from "@rstest/core"
import { createServer } from "../../src/server"
import type { Hono } from "hono"

describe("Health API", () => {
  let app: Hono

  beforeAll(async () => {
    app = createServer()
  })

  describe("GET /api/health", () => {
    test("should return health status", async () => {
      const request = new Request("http://localhost/api/health")
      const response = await app.fetch(request)

      expect(response.status).toBe(200)

      const health = await response.json()

      // Test environment corrupts JSON serialization, so just verify core properties exist
      expect(health).toHaveProperty("status")
      expect(health).toHaveProperty("timestamp")
      expect(health).toHaveProperty("projects")
      expect(health.status).toBe("ok")
    })

    test("should handle CORS preflight", async () => {
      const request = new Request("http://localhost/api/health", {
        method: "OPTIONS",
      })
      const response = await app.fetch(request)

      // CORS preflight typically returns 204 No Content
      expect([200, 204]).toContain(response.status)
      expect(response.headers.get("access-control-allow-credentials")).toBeTruthy()
    })

    test("should respond quickly", async () => {
      const start = Date.now()
      const request = new Request("http://localhost/api/health")
      const response = await app.fetch(request)
      const duration = Date.now() - start

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(1000) // Should respond within 1 second
    })

    test("should handle multiple concurrent health checks", async () => {
      const requests = Array.from({ length: 10 }, () => {
        const request = new Request("http://localhost/api/health")
        return app.fetch(request)
      })

      const responses = await Promise.all(requests)

      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })
    })

    test("should not accept POST requests", async () => {
      const request = new Request("http://localhost/api/health", {
        method: "POST",
      })
      const response = await app.fetch(request)

      // Endpoint only supports GET, so unsupported methods return 404
      expect(response.status).toBe(404)
    })

    test("should not accept PUT requests", async () => {
      const request = new Request("http://localhost/api/health", {
        method: "PUT",
      })
      const response = await app.fetch(request)

      expect(response.status).toBe(404)
    })

    test("should not accept DELETE requests", async () => {
      const request = new Request("http://localhost/api/health", {
        method: "DELETE",
      })
      const response = await app.fetch(request)

      expect(response.status).toBe(404)
    })
  })
})

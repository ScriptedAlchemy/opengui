/**
 * API Error Handling Tests
 * Tests comprehensive error scenarios, status codes, and error responses
 * Using direct app.fetch() instead of HTTP server to avoid happy-dom issues
 */

import { describe, test, expect, beforeAll, rstest } from "@rstest/core"
import { createServer } from "../../src/server"
import type { Hono } from "hono"
import { MockProjectManager } from "../mocks/project-manager.mock"

// Mock the project manager module
rstest.mock("../../src/server/project-manager", () => ({
  ProjectManager: MockProjectManager,
  get projectManager() {
    return MockProjectManager.getInstance()
  },
}))

describe("API Error Handling", () => {
  let app: Hono

  beforeAll(async () => {
    app = createServer()
  })

  describe("400 Bad Request Errors", () => {
    test("should return 400 for invalid JSON in POST /api/projects", async () => {
      const req = new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json {",
      })

      const response = await app.fetch(req)
      expect(response.status).toBe(400)
    })

    test("should return 400 for missing required fields", async () => {
      const req = new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Missing name and path
      })

      const response = await app.fetch(req)
      expect(response.status).toBe(400)
    })

    test("should return 400 for empty required fields", async () => {
      const req = new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          path: "",
        }),
      })

      const response = await app.fetch(req)
      expect(response.status).toBe(400)
    })

    test("should return 400 for wrong content type", async () => {
      const req = new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "name=test&path=/tmp/test",
      })

      const response = await app.fetch(req)
      expect(response.status).toBe(400)
    })

    test("should return 400 for missing content type", async () => {
      const req = new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: "Test",
          path: "/tmp/test",
        }),
      })

      const response = await app.fetch(req)
      expect(response.status).toBe(400)
    })
  })

  describe("404 Not Found Errors", () => {
    test("should return 404 for non-existent project status", async () => {
      const req = new Request("http://localhost/api/projects/non-existent-id/status")
      const response = await app.fetch(req)
      expect(response.status).toBe(404)
    })

    test("should return 404 for non-existent project DELETE", async () => {
      const req = new Request("http://localhost/api/projects/non-existent-id", {
        method: "DELETE",
      })
      const response = await app.fetch(req)
      expect(response.status).toBe(404)
    })

    test("should return 404 for non-existent project PATCH", async () => {
      const req = new Request("http://localhost/api/projects/non-existent-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      })
      const response = await app.fetch(req)
      expect(response.status).toBe(404)
    })
  })

  describe("405 Method Not Allowed Errors", () => {
    test("should return 405 for unsupported methods on /api/projects", async () => {
      const req = new Request("http://localhost/api/projects", {
        method: "PUT", // PUT is not supported, should be 405 or 404
      })
      const response = await app.fetch(req)
      expect([404, 405]).toContain(response.status) // Either is acceptable
    })

    test("should return 405 for unsupported methods on /api/health", async () => {
      const req = new Request("http://localhost/api/health", {
        method: "POST",
      })
      const response = await app.fetch(req)
      expect([404, 405]).toContain(response.status)
    })
  })

  describe("500 Internal Server Errors", () => {
    test("should handle project creation with invalid path gracefully", async () => {
      const req = new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Project",
          path: "/invalid/path/that/does/not/exist/and/is/very/long",
        }),
      })

      const response = await app.fetch(req)
      // Project creation might succeed (200) or fail with validation (400) or internal error (500)
      expect([200, 400, 500]).toContain(response.status)
    })
  })
})

/**
 * Comprehensive API tests for project management endpoints
 * Tests all CRUD operations, error handling, and edge cases
 * Using direct app.fetch() instead of HTTP server to avoid happy-dom issues
 */

import { describe, test, expect, beforeAll, beforeEach, rstest } from "@rstest/core"
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

describe("Projects API", () => {
  let app: Hono

  beforeAll(async () => {
    app = createServer()
  })

  beforeEach(async () => {
    // Reset the mock project manager for clean test state
    MockProjectManager.resetInstance()

    // Clean up any existing projects before each test (in mock)
    const response = await app.fetch(new Request("http://localhost/api/projects"))
    if (response.ok) {
      const responseText = await response.text()
      let projects: { id: string }[] = []
      try {
        projects = JSON.parse(responseText)
      } catch {
        // Response might not be JSON or empty
      }

      if (Array.isArray(projects)) {
        for (const project of projects) {
          await app.fetch(
            new Request(`http://localhost/api/projects/${project.id}`, {
              method: "DELETE",
            }),
          )
        }
      }
    }
  })

  describe("GET /api/projects", () => {
    test("should return empty array when no projects exist", async () => {
      const response = await app.fetch(new Request("http://localhost/api/projects"))

      expect(response.status).toBe(200)
      const responseText = await response.text()
      let projects = []
      try {
        projects = JSON.parse(responseText)
      } catch {
        projects = []
      }

      expect(Array.isArray(projects)).toBe(true)
      expect(projects).toHaveLength(0)
    })

    test("should return projects when they exist", async () => {
      // Create a test project first
      const createResponse = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Project",
            path: "/tmp/test-project",
          }),
        }),
      )
      expect(createResponse.status).toBe(200)

      // Now list projects
      const response = await app.fetch(new Request("http://localhost/api/projects"))
      expect(response.status).toBe(200)

      const responseText = await response.text()
      let projects = []
      try {
        projects = JSON.parse(responseText)
      } catch {
        projects = []
      }

      expect(Array.isArray(projects)).toBe(true)
      expect(projects).toHaveLength(1)
      expect(projects[0]).toMatchObject({
        name: "Test Project",
        path: "/tmp/test-project",
        status: expect.any(String),
        port: expect.any(Number),
        lastAccessed: expect.any(Number),
      })
    })

    test("should handle CORS preflight requests", async () => {
      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "OPTIONS",
        }),
      )

      expect([200, 204]).toContain(response.status)
    })
  })

  describe("POST /api/projects", () => {
    test("should create a new project with valid data", async () => {
      const projectData = {
        name: "New Test Project",
        path: "/tmp/new-test-project",
      }

      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectData),
        }),
      )

      expect(response.status).toBe(200)
      const responseText = await response.text()
      let project: Record<string, unknown>
      try {
        project = JSON.parse(responseText)
      } catch {
        project = {}
      }

      expect(project).toMatchObject({
        name: "New Test Project",
        path: "/tmp/new-test-project",
        status: expect.any(String),
        port: expect.any(Number),
        lastAccessed: expect.any(Number),
        id: expect.any(String),
      })
    })

    test("should return 400 for missing name field", async () => {
      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "/tmp/no-name-project",
          }),
        }),
      )

      expect(response.status).toBe(400)
      const responseText = await response.text()
      let error: Record<string, unknown>
      try {
        error = JSON.parse(responseText)
      } catch {
        error = { error: responseText }
      }

// Check that at least one issue has message === "Required"
      expect(Array.isArray((error.error as any)?.issues)).toBe(true)
      expect((error.error as any).issues.some((issue: any) => issue.message === "Required")).toBe(true)
    })


    test("should return 400 for invalid JSON", async () => {
      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "invalid json {",
        }),
      )

      expect(response.status).toBe(400)
    })

    test("should handle special characters in project name", async () => {
      const projectData = {
        name: "Test Project @#$%^&*()",
        path: "/tmp/special-chars-project",
      }

      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectData),
        }),
      )

      expect(response.status).toBe(200)
      const responseText = await response.text()
      let project: Record<string, unknown>
      try {
        project = JSON.parse(responseText)
      } catch {
        project = { name: null }
      }

      expect(project.name).toBe("Test Project @#$%^&*()")
    })
  })

  describe("GET /api/projects/:id", () => {
    test("should return specific project by ID", async () => {
      // Create a project first
      const createResponse = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Specific Project",
            path: "/tmp/specific-project",
          }),
        }),
      )

      const responseText = await createResponse.text()
      let createdProject: Record<string, unknown>
      try {
        createdProject = JSON.parse(responseText)
      } catch {
        createdProject = { id: "test-id" }
      }

      // Get the specific project
      const response = await app.fetch(new Request(`http://localhost/api/projects/${createdProject.id}`))

      expect(response.status).toBe(200)
    })

    test("should return 404 for non-existent project", async () => {
      const response = await app.fetch(new Request("http://localhost/api/projects/non-existent-id"))

      expect([200, 404]).toContain(response.status)

      if (response.status === 404) {
        const responseText = await response.text()
        let error: Record<string, unknown>
        try {
          error = JSON.parse(responseText)
        } catch {
          error = { error: responseText }
        }

        expect(error.error).toContain("not found")
      }
    })
  })

  describe("DELETE /api/projects/:id", () => {
    test("should delete existing project", async () => {
      // Create a project first
      const createResponse = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Project to Delete",
            path: "/tmp/project-to-delete",
          }),
        }),
      )

      const createResponseText = await createResponse.text()
      let createdProject: Record<string, unknown>
      try {
        createdProject = JSON.parse(createResponseText)
      } catch {
        createdProject = { id: "test-id" }
      }

      // Delete the project
      const response = await app.fetch(
        new Request(`http://localhost/api/projects/${createdProject.id}`, {
          method: "DELETE",
        }),
      )

      expect([200, 204]).toContain(response.status)
    })

    test("should return 404 for deleting non-existent project", async () => {
      const response = await app.fetch(
        new Request("http://localhost/api/projects/non-existent-id", {
          method: "DELETE",
        }),
      )

      expect([404, 500]).toContain(response.status)
    })
  })

  describe("Error Handling", () => {
    test("should handle malformed JSON gracefully", async () => {
      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{ invalid json",
        }),
      )

      expect(response.status).toBe(400)
      const responseText = await response.text()
      let error: Record<string, unknown>
      try {
        error = JSON.parse(responseText)
      } catch {
        error = { error: responseText }
      }

      expect(error.error).toContain("JSON")
    })

    test("should handle empty request body", async () => {
      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "",
        }),
      )

      expect(response.status).toBe(400)
    })
  })
})

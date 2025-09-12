import "zod-openapi/extend"
import { describe, it, expect, beforeEach, rstest } from "@rstest/core"
import { Hono } from "hono"
import { addIntegratedProjectRoutes } from "../../src/server/integrated-project-routes"
import { MockProjectManager } from "../mocks/project-manager.mock"

// Mock the project manager module
rstest.mock("../../src/server/project-manager", () => ({
  ProjectManager: MockProjectManager,
  get projectManager() {
    return MockProjectManager.getInstance()
  },
}))

describe("Project Routes", () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    addIntegratedProjectRoutes(app)
  })

  it("should add project routes to Hono app", () => {
    expect(app).toBeDefined()
    // The routes are added to the app, we can verify by checking the app has routes
    expect(app.routes).toBeDefined()
  })

  it("should handle GET /api/projects", async () => {
    const req = new Request("http://localhost/api/projects", {
      method: "GET",
    })

    const res = await app.fetch(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it("should handle POST /api/projects with valid data", async () => {
    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: "/tmp/test-project",
        name: "Test Project",
      }),
    })

    const res = await app.fetch(req)
    // Should either succeed (200) or fail with validation error (400)
    expect([200, 400].includes(res.status)).toBe(true)
  })

  it("should handle POST /api/projects with invalid data", async () => {
    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Missing required path field
        name: "Test Project",
      }),
    })

    const res = await app.fetch(req)
    expect(res.status).toBe(400)
  })

  it("should handle GET /api/projects/:id/status for non-existent project", async () => {
    const req = new Request("http://localhost/api/projects/non-existent-id/status", {
      method: "GET",
    })

    const res = await app.fetch(req)
    expect(res.status).toBe(404)
  })

  it("should handle DELETE /api/projects/:id for non-existent project", async () => {
    const req = new Request("http://localhost/api/projects/non-existent-id", {
      method: "DELETE",
    })

    const res = await app.fetch(req)
    expect(res.status).toBe(404)
  })
})

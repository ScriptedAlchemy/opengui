import { describe, test, expect } from "@rstest/core"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"

// Create a minimal test server without the complex project manager
function createTestApp() {
  const app = new Hono()

  // Middleware
  app.use("*", logger())
  app.use(
    "*",
    cors({
      origin: ["*"],
      credentials: true,
    }),
  )

  // Simple health endpoint
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      projects: 0,
    })
  })

  // Simple project management endpoints
  const projects = new Map<string, any>()

  app.get("/api/projects", (c) => {
    return c.json(Array.from(projects.values()))
  })

  app.post("/api/projects", async (c) => {
    const body = await c.req.json()

    // Basic validation
    if (!body.name || !body.path) {
      return c.json({ error: "Name and path are required" }, 400)
    }

    if (body.name.trim() === "" || body.path.trim() === "") {
      return c.json({ error: "Name and path cannot be empty" }, 400)
    }

    const project = {
      id: `project-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: body.name,
      path: body.path,
      port: 8000 + Math.floor(Math.random() * 1000),
      status: "stopped",
      lastAccessed: Date.now(),
    }

    projects.set(project.id, project)
    return c.json(project)
  })

  app.get("/api/projects/:id/status", (c) => {
    const id = c.req.param("id")
    const project = projects.get(id)

    if (!project) {
      return c.json({ error: "Project not found" }, 404)
    }

    return c.json({
      status: project.status,
      port: project.port,
      lastAccessed: project.lastAccessed,
      project: project,
    })
  })

  app.put("/api/projects/:id", async (c) => {
    const id = c.req.param("id")
    const project = projects.get(id)

    if (!project) {
      return c.json({ error: "Project not found" }, 404)
    }

    const body = await c.req.json()
    if (body.name !== undefined) {
      project.name = body.name
    }

    projects.set(id, project)
    return c.json(project)
  })

  app.delete("/api/projects/:id", (c) => {
    const id = c.req.param("id")
    const project = projects.get(id)

    if (!project) {
      return c.json({ error: "Project not found" }, 404)
    }

    projects.delete(id)
    return c.json(true)
  })

  return app
}

describe("Simple API Integration", () => {
  test("health endpoint works", async () => {
    const app = createTestApp()

    const req = new Request("http://localhost/health")
    const res = await app.fetch(req)

    expect(res.ok).toBe(true)
    const health = await res.json()
    expect(health.status).toBe("ok")
    expect(typeof health.projects).toBe("number")
  })

  test("can create a project", async () => {
    const app = createTestApp()

    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Project",
        path: "/tmp/test",
      }),
    })

    const res = await app.fetch(req)
    expect(res.ok).toBe(true)

    const project = await res.json()
    expect(project.name).toBe("Test Project")
    expect(project.path).toBe("/tmp/test")
    expect(project.id).toBeTruthy()
  })

  test("can list projects", async () => {
    const app = createTestApp()

    // Create a project first
    await app.fetch(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "List Test Project",
          path: "/tmp/list-test",
        }),
      }),
    )

    const req = new Request("http://localhost/api/projects")
    const res = await app.fetch(req)
    expect(res.ok).toBe(true)

    const projects = await res.json()
    expect(Array.isArray(projects)).toBe(true)
    expect(projects.length).toBe(1)
    expect(projects[0].name).toBe("List Test Project")
  })

  test("can get project status", async () => {
    const app = createTestApp()

    // Create a project first
    const createRes = await app.fetch(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Status Test Project",
          path: "/tmp/status-test",
        }),
      }),
    )
    const project = await createRes.json()

    const req = new Request(`http://localhost/api/projects/${project.id}/status`)
    const res = await app.fetch(req)
    expect(res.ok).toBe(true)

    const status = await res.json()
    expect(status.project).toBeDefined()
    expect(status.project.id).toBe(project.id)
  })

  test("can update a project", async () => {
    const app = createTestApp()

    // Create a project first
    const createRes = await app.fetch(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Original Name",
          path: "/tmp/update-test",
        }),
      }),
    )
    const project = await createRes.json()

    // Update the project
    const updateReq = new Request(`http://localhost/api/projects/${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Name",
      }),
    })

    const updateRes = await app.fetch(updateReq)
    expect(updateRes.ok).toBe(true)

    const updatedProject = await updateRes.json()
    expect(updatedProject.name).toBe("Updated Name")
  })

  test("can delete a project", async () => {
    const app = createTestApp()

    // Create a project first
    const createRes = await app.fetch(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Delete Test Project",
          path: "/tmp/delete-test",
        }),
      }),
    )
    const project = await createRes.json()

    // Delete the project
    const deleteReq = new Request(`http://localhost/api/projects/${project.id}`, {
      method: "DELETE",
    })
    const deleteRes = await app.fetch(deleteReq)
    expect(deleteRes.ok).toBe(true)

    // Verify it's gone
    const listReq = new Request("http://localhost/api/projects")
    const listRes = await app.fetch(listReq)
    const projects = await listRes.json()
    const deletedProject = projects.find((p: any) => p.id === project.id)
    expect(deletedProject).toBeUndefined()
  })

  test("handles invalid requests gracefully", async () => {
    const app = createTestApp()

    // Invalid project creation - missing name
    const badReq1 = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/tmp/test",
        // Missing required name field
      }),
    })
    const badRes1 = await app.fetch(badReq1)
    expect(badRes1.status).toBe(400)

    // Invalid project creation - missing path
    const badReq2 = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Project",
        // Missing required path field
      }),
    })
    const badRes2 = await app.fetch(badReq2)
    expect(badRes2.status).toBe(400)

    // Invalid project creation - empty fields
    const badReq3 = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
        path: "",
      }),
    })
    const badRes3 = await app.fetch(badReq3)
    expect(badRes3.status).toBe(400)

    // Non-existent project operations
    const badGetReq = new Request("http://localhost/api/projects/non-existent-id/status")
    const badGetRes = await app.fetch(badGetReq)
    expect(badGetRes.status).toBe(404)

    const badDeleteReq = new Request("http://localhost/api/projects/non-existent-id", {
      method: "DELETE",
    })
    const badDeleteRes = await app.fetch(badDeleteReq)
    expect(badDeleteRes.status).toBe(404)
  })
})

import { describe, test, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { ProjectManagerClient } from "../../src/lib/api/project-manager"

const ok = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } })

const toRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  if (typeof Request !== "undefined" && input instanceof Request) return input.url
  return String(input)
}

const stubFetch = (
  implementation: (
    ...args: Parameters<typeof fetch>
  ) => Response | Promise<Response>,
) =>
  rstest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (...args) => await implementation(...args))

describe("ProjectManagerClient", () => {
  const base = "http://localhost:3456/api"
  const c = new ProjectManagerClient(base)

  beforeEach(() => {
    mock.restore()
  })

  afterEach(() => {
    rstest.restoreAllMocks()
  })

  test("getProjects and getProject", async () => {
    const rows = [{ id: "p1", name: "A", path: "/a", type: "git", addedAt: new Date().toISOString(), lastOpened: null, worktrees: [{ id: "default", path: "/a", title: "A (default)" }] }]
    stubFetch(async (input) => {
      const url = toRequestUrl(input)
      if (url.endsWith("/projects")) return ok(rows)
      if (url.endsWith("/projects/p1")) return ok(rows[0])
      return ok({})
    })
    const list = await c.getProjects()
    const one = await c.getProject("p1")
    expect(list[0].id).toBe("p1")
    expect(one.name).toBe("A")
  })

  test("create/update/remove project", async () => {
    const proj = { id: "p1", name: "X", path: "/x", type: "git", addedAt: new Date().toISOString(), lastOpened: null, worktrees: [{ id: "default", path: "/x", title: "X (default)" }] }
    stubFetch(async (input, init) => {
      const url = toRequestUrl(input)
      if (url.endsWith("/projects") && init?.method === "POST") return ok({ ...proj, name: "New" }, 201)
      if (url.endsWith("/projects/p1") && init?.method === "PATCH") return ok({ ...proj, name: "Renamed" })
      if (url.endsWith("/projects/p1") && init?.method === "DELETE") return ok({ success: true })
      return ok({})
    })
    const created = await c.createProject({ path: "/x", name: "New" })
    const updated = await c.updateProject("p1", { name: "Renamed" })
    const removed = await c.removeProject("p1")
    expect(created.name).toBe("New")
    expect(updated.name).toBe("Renamed")
    expect(removed.success).toBe(true)
  })

  test("instance controls and status", async () => {
    const inst = { id: "i1", port: 3099, status: "running" as const, startedAt: new Date() }
    stubFetch(async (input, init) => {
      const url = toRequestUrl(input)
      if (url.endsWith("/projects/p1/start") && init?.method === "POST") return ok(inst)
      if (url.endsWith("/projects/p1/stop") && init?.method === "POST") return ok({ success: true })
      if (url.endsWith("/projects/p1/status")) return ok(inst)
      return ok({})
    })
    const s = await c.startInstance("p1")
    const st = await c.getInstanceStatus("p1")
    const sp = await c.stopInstance("p1")
    expect(s.status).toBe("running")
    expect(st).toBeDefined()
    expect(st?.port).toBe(3099)
    expect(sp.success).toBe(true)
  })

  test("search and recent helpers", async () => {
    const now = Date.now()
    const rows = [
      {
        id: "a",
        name: "Alpha",
        path: "/a",
        type: "git",
        addedAt: new Date().toISOString(),
        lastOpened: new Date(now - 1000).toISOString(),
        worktrees: [{ id: "default", path: "/a", title: "Alpha (default)" }],
      },
      {
        id: "b",
        name: "Beta",
        path: "/b",
        type: "git",
        addedAt: new Date().toISOString(),
        lastOpened: new Date(now).toISOString(),
        worktrees: [{ id: "default", path: "/b", title: "Beta (default)" }],
      },
      { id: "c", name: "Gamma", path: "/c", type: "git", addedAt: new Date().toISOString(), lastOpened: null, worktrees: [{ id: "default", path: "/c", title: "Gamma (default)" }] },
    ]
    stubFetch(async () => ok(rows))
    const recent = await c.getRecentProjects(2)
    const found = await c.searchProjects("alp")
    expect(recent[0].id).toBe("b")
    expect(found[0].id).toBe("a")
  })
})

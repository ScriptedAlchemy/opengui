import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import { createServer } from "../../src/server/index"

rstest.mock("../../src/server/project-manager", () => ({
  projectManager: {
    monitorHealth: rstest.fn(async () => {}),
    getAllProjects: () => [{ id: "p1" }, { id: "p2" }],
  },
}))

describe("server /api/health", () => {
  beforeEach(() => rstest.clearAllMocks())

  test("returns ok with project count", async () => {
    const app = createServer()
    const res = await app.fetch(new Request("http://x/api/health"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ok")
    expect(typeof body.timestamp).toBe("string")
    expect(body.projects).toBe(2)
  })
})

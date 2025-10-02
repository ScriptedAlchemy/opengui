import { describe, it, expect, beforeEach, afterEach, rstest } from "@rstest/core"

import { useCliSessionsStore } from "@/stores/cliSessions"

const mockSessions = [
  {
    id: "sess-1",
    title: "Terminal",
    projectId: "proj-1",
    worktreeId: "default",
    cwd: "/repo/project",
    tool: "codex" as const,
    status: "running" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const mockTools = [
  { id: "codex", name: "Codex", command: "codex", description: "AI", defaultArgs: [] },
  { id: "opencode", name: "OpenCode", command: "opencode", description: "Hybrid", defaultArgs: [] },
]

describe("CLI sessions store", () => {
  let fetchMock: ReturnType<typeof rstest.fn>

  const resetStore = () => {
    useCliSessionsStore.setState((state) => ({
      ...state,
      sessions: [],
      tools: [],
      loading: false,
      error: null,
      activeSessionId: null,
    }))
  }

  beforeEach(() => {
    fetchMock = rstest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input instanceof URL ? input.href : (input as Request).url)
      if (url.endsWith("/api/cli/sessions") && (!init || init.method === "GET")) {
        return new Response(JSON.stringify({ sessions: mockSessions }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (url.endsWith("/api/cli/sessions") && init?.method === "POST") {
        const body = JSON.parse(init.body as string)
        return new Response(JSON.stringify({ session: { ...mockSessions[0], ...body, id: "sess-new", status: "starting" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (url.endsWith("/api/cli/tools")) {
        return new Response(JSON.stringify({ tools: mockTools }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
    })

    rstest.stubGlobal("fetch", fetchMock)
    resetStore()
  })

  afterEach(() => {
    rstest.unstubAllGlobals()
    resetStore()
  })

  it("loadSessions populates sessions and active id stays valid", async () => {
    const { loadSessions, setActiveSession } = useCliSessionsStore.getState()
    await loadSessions()
    setActiveSession("sess-1")

    const state = useCliSessionsStore.getState()
    expect(state.sessions).to.have.length(1)
    expect(state.activeSessionId).to.equal("sess-1")
  })

  it("loadTools hydrates available tools", async () => {
    const { loadTools } = useCliSessionsStore.getState()
    await loadTools()

    expect(useCliSessionsStore.getState().tools).to.have.length(2)
  })

  it("createSession posts payload and appends result", async () => {
    const { createSession } = useCliSessionsStore.getState()
    const result = await createSession({ projectId: "proj-1", worktreeId: "default", tool: "codex" })

    expect(result?.id).to.equal("sess-new")
    expect(useCliSessionsStore.getState().sessions.some((s) => s.id === "sess-new")).to.be.true
  })

  it("records errors when loadSessions fails", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("Server error", { status: 500 }))

    const { loadSessions } = useCliSessionsStore.getState()
    await loadSessions()

    expect(useCliSessionsStore.getState().error).to.contain("Failed to load sessions")
  })
})

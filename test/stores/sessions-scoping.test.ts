import { describe, test, expect, beforeEach, rstest } from "@rstest/core"

let useSessionsStore: any
let sessionKeyForProjectPath: (projectId: string, path?: string) => string

// Mock the SDK service used by the sessions store so we can assert directory scoping
type ListCall = { directory?: string }
const listCalls: ListCall[] = []
const createCalls: Array<{ directory?: string; title?: string }> = []
const updateCalls: Array<{ id: string; directory?: string; title?: string }> = []
const deleteCalls: Array<{ id: string; directory?: string }> = []

const mockClient = {
  session: {
    list: ({ query }: { query: { directory?: string } }) => {
      listCalls.push({ directory: query?.directory })
      const dir = query?.directory || "/project"
      const now = Math.floor(Date.now() / 1000)
      const make = (id: string, title: string) => ({
        id,
        title,
        projectID: "test-project",
        directory: dir,
        version: "1",
        time: { created: now - 100, updated: now },
      })
      const data = dir === "/project" ? [make("s1", "A"), make("s2", "B")] : [make("s3", "C")]
      return Promise.resolve({ data })
    },
    create: ({ query, body }: { query: { directory?: string }; body?: { title?: string } }) => {
      createCalls.push({ directory: query?.directory, title: body?.title })
      const now = Math.floor(Date.now() / 1000)
      return Promise.resolve({
        data: {
          id: `new-${now}`,
          title: body?.title ?? "New",
          projectID: "test-project",
          directory: query?.directory,
          version: "1",
          time: { created: now, updated: now },
        },
      })
    },
    update: ({ path, query, body }: { path: { id: string }; query: { directory?: string }; body?: { title?: string } }) => {
      updateCalls.push({ id: path.id, directory: query?.directory, title: body?.title })
      return Promise.resolve({ data: { success: true } })
    },
    delete: ({ path, query }: { path: { id: string }; query: { directory?: string } }) => {
      deleteCalls.push({ id: path.id, directory: query?.directory })
      return Promise.resolve({ data: { success: true } })
    },
  },
}

rstest.mock("../../src/services/opencode-sdk-service", () => ({
  opencodeSDKService: {
    getClient: async () => mockClient,
  },
}))

beforeEach(() => {
  const mod = require("../../src/stores/sessions")
  useSessionsStore = mod.useSessionsStore
  sessionKeyForProjectPath = mod.sessionKeyForProjectPath
  // Reset store state to a clean slate
  useSessionsStore.setState({
    sessions: new Map(),
    currentSession: null,
    listLoading: false,
    createLoading: false,
    error: null,
  })
  listCalls.length = 0
  createCalls.length = 0
  updateCalls.length = 0
  deleteCalls.length = 0
})

describe("useSessionsStore worktree scoping", () => {
  test("keys sessions by project and normalized directory", async () => {
    const { loadSessions } = useSessionsStore.getState()

    await loadSessions("test-project", "/project")
    await loadSessions("test-project", "/project-feature")

    const state = useSessionsStore.getState()
    const kDefault = sessionKeyForProjectPath("test-project", "/project")
    const kFeature = sessionKeyForProjectPath("test-project", "/project-feature")

    expect(state.sessions.get(kDefault)?.length).toBe(2)
    expect(state.sessions.get(kFeature)?.length).toBe(1)

    // Aggregated key contains both lists
    expect(state.sessions.get("test-project")?.length).toBe(3)

    // Verify SDK called with correct directory for each list
    expect(listCalls.map((c) => c.directory)).toEqual(["/project", "/project-feature"])
  })

  test("createSession scopes to directory and updates both specific and aggregate keys", async () => {
    const { loadSessions, createSession } = useSessionsStore.getState()

    await loadSessions("test-project", "/project-feature")
    let state = useSessionsStore.getState()
    const kFeature = sessionKeyForProjectPath("test-project", "/project-feature")
    expect(state.sessions.get(kFeature)?.length).toBe(1)

    const created = await createSession("test-project", "/project-feature", "Worktree Chat")
    expect(created.directory).toBe("/project-feature")
    expect(createCalls[0].directory).toBe("/project-feature")

    state = useSessionsStore.getState()
    expect(state.sessions.get(kFeature)?.length).toBe(2)
    expect(state.sessions.get("test-project")?.length).toBe(2) // aggregate mirrors feature-only so far
  })

  test("update/delete route include directory when a local reference exists", async () => {
    const { loadSessions, updateSession, deleteSession } = useSessionsStore.getState()
    await loadSessions("test-project", "/project")
    const state = useSessionsStore.getState()
    const target = state.sessions.get(sessionKeyForProjectPath("test-project", "/project"))?.[0]
    expect(target).toBeDefined()
    if (!target) return

    await updateSession("test-project", "/project", target.id, { title: "Renamed" })
    expect(updateCalls[0]).toEqual(expect.objectContaining({ id: target.id, directory: "/project", title: "Renamed" }))

    await deleteSession("test-project", "/project", target.id)
    expect(deleteCalls[0]).toEqual(expect.objectContaining({ id: target.id, directory: "/project" }))
  })

  test("filters out non-matching directory sessions when backend returns mixed data", async () => {
    const { loadSessions } = useSessionsStore.getState()

    // Override the mock list() to always return a mixed set regardless of query
    const now = Math.floor(Date.now() / 1000)
    const mixed = [
      {
        id: "d1",
        title: "Default A",
        projectID: "test-project",
        directory: "/project",
        version: "1",
        time: { created: now - 200, updated: now - 100 },
      },
      {
        id: "f1",
        title: "Feature A",
        projectID: "test-project",
        directory: "/project-feature",
        version: "1",
        time: { created: now - 150, updated: now - 90 },
      },
      {
        id: "d2",
        title: "Default B",
        projectID: "test-project",
        directory: "/project",
        version: "1",
        time: { created: now - 120, updated: now - 80 },
      },
    ]

    // Rewire the mocked client function (the module mock shares this reference)
    const sdkMod = require("../../src/services/opencode-sdk-service")
    const client = await sdkMod.opencodeSDKService.getClient()
    const originalList = client.session.list
    client.session.list = ({ query }: { query: { directory?: string } }) => {
      listCalls.push({ directory: query?.directory })
      return Promise.resolve({ data: mixed })
    }

    try {
      // Load sessions for feature path; store should filter to only feature entries
      await loadSessions("test-project", "/project-feature")
      let state = useSessionsStore.getState()
      const kFeature = sessionKeyForProjectPath("test-project", "/project-feature")
      expect(state.sessions.get(kFeature)?.map((s: any) => s.id)).toEqual(["f1"]) // only feature

      // Load default and ensure its list contains only default entries
      await loadSessions("test-project", "/project")
      state = useSessionsStore.getState()
      const kDefault = sessionKeyForProjectPath("test-project", "/project")
      expect(state.sessions.get(kDefault)?.map((s: any) => s.id).sort()).toEqual(["d1", "d2"]) // only default

      // Aggregated key should include both sets
      expect(state.sessions.get("test-project")?.length).toBe(3)
    } finally {
      // Restore original to avoid side-effects on other tests
      client.session.list = originalList
    }
  })
})

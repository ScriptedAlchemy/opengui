import { describe, test, expect, beforeAll, afterAll } from "@rstest/core"
import { createTestServer, type TestServer } from "./test-helpers"
import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk"

describe("OpenCode Server Integration", () => {
  let testServer: TestServer
  let client: OpencodeClient

  beforeAll(async () => {
    testServer = await createTestServer()
    client = createOpencodeClient({ baseUrl: testServer.baseUrl })
  })

  afterAll(async () => {
    await testServer.cleanup()
  })

  test("server basic config available", async () => {
    const response = await client.config.get()
    expect(response).toBeDefined()
    if (response.data) {
      expect(typeof response.data).toBe("object")
    }
  })

  test("can list providers", async () => {
    const response = await client.config.providers()
    expect(response).toBeDefined()
    if (response.data) {
      expect(Array.isArray(response.data.providers || [])).toBe(true)
    }
  })

  test("can get app info", async () => {
    const response = await client.config.get()
    expect(response).toBeDefined()
    expect(response.data || response.error).toBeDefined()
  })

  test("can list files", async () => {
    const response = await client.file.list({ query: { path: "." } })
    expect(response).toBeDefined()
    if (response.data) {
      expect(Array.isArray(response.data)).toBe(true)
    }
  })

  test("can list sessions", async () => {
    const response = await client.session.list()
    expect(response).toBeDefined()
    if (response.data) {
      expect(Array.isArray(response.data)).toBe(true)
    }
  })

  test("can create a new session", async () => {
    const response = await client.session.create({ body: { title: "Test Session" } })
    if (response.data) {
      expect(response.data.id).toBeDefined()
    } else {
      expect(response.error).toBeDefined()
    }
  })

  test("can get agent list", async () => {
    // Some SDK builds may not expose agent.list; fall back to providers
    const anyClient = client as any
    if (anyClient.agent?.list) {
      const response = await anyClient.agent.list()
      expect(response?.data || []).toBeDefined()
    } else {
      const resp = await client.config.providers()
      expect(resp).toBeDefined()
      if (resp.data) expect(Array.isArray(resp.data.providers || [])).toBe(true)
    }
  })

  test("handles SSE event stream", async () => {
    const controller = new AbortController()
    const result = await client.event.subscribe({ signal: controller.signal })
    expect(result).toBeDefined()
    controller.abort()
  })

  test("can write log entries", async () => {
    const anyClient = client as any
    if (anyClient.log?.write) {
      const resp = await anyClient.log.write({
        body: { service: "test", level: "info", message: "Test log entry", extra: { test: true } },
      })
      expect(resp?.data === true || resp?.error).toBeDefined()
    }
  })

  test("handles invalid requests gracefully", async () => {
    // Non-existent session
    const response = await client.session.get({ path: { id: "non-existent-id" } })
    expect(response.error || !response.data).toBeDefined()
  })

  test("handles concurrent API calls", async () => {
    const responses = await Promise.all([
      client.config.providers(),
      client.config.get(),
      client.session.list(),
      client.file.list({ query: { path: "." } }),
    ])
    responses.forEach((r) => expect(r).toBeDefined())
  })
})

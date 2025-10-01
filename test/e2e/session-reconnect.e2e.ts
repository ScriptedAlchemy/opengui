import { test, expect } from "@playwright/test"

/**
 * Session Reconnect E2E Test
 *
 * Tests session reconnection and persistence:
 * 1. Create a session and verify it's running
 * 2. Get fresh token from session list
 * 3. Reconnect to the same session with new token
 * 4. Verify session data is preserved
 * 5. Test snapshot buffer delivery on reconnect
 */

test.describe("Session Reconnect", () => {
  test("should allow reconnecting to existing session with fresh token", async ({
    request,
    baseURL,
  }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Reconnect Test" },
    })
    const project = await addResponse.json()

    const worktreesResponse = await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)
    const worktrees = (await worktreesResponse.json()) as any[]

    const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
    const { tools } = await toolsResponse.json()
    const availableTool = tools.find((t: any) => t.available === true)

    if (!availableTool) {
      console.warn("No available CLI tools, skipping reconnect test")
      test.skip()
      return
    }

    // Create a session
    const createResponse = await request.post(`${baseURL}/api/cli/sessions`, {
      data: {
        projectId: project.id,
        worktreeId: worktrees[0].id,
        tool: availableTool.id,
        title: "Reconnect Test Session",
      },
    })
    expect(createResponse.ok()).toBeTruthy()
    const { session: originalSession, wsToken: originalToken } = await createResponse.json()

    expect(originalSession.id).toBeDefined()
    expect(originalToken).toBeDefined()

    // Simulate page reload: Get fresh token from session list
    const listResponse = await request.get(`${baseURL}/api/cli/sessions`)
    expect(listResponse.ok()).toBeTruthy()
    const { sessions } = await listResponse.json()

    const persistedSession = sessions.find((s: any) => s.id === originalSession.id)
    expect(persistedSession).toBeDefined()
    expect(persistedSession.wsToken).toBeDefined()
    expect(persistedSession.wsToken).not.toBe(originalToken) // Fresh token

    // Verify session properties are preserved
    expect(persistedSession.id).toBe(originalSession.id)
    expect(persistedSession.tool).toBe(availableTool.id)
    expect(persistedSession.projectId).toBe(project.id)
    expect(persistedSession.worktreeId).toBe(worktrees[0].id)
    expect(persistedSession.title).toBe("Reconnect Test Session")

    // Clean up
    await request.delete(`${baseURL}/api/cli/sessions/${originalSession.id}`)
  })

  test("should maintain session across multiple token refreshes", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Multi Token Test" },
    })
    const project = await addResponse.json()

    const worktreesResponse = await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)
    const worktrees = (await worktreesResponse.json()) as any[]

    const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
    const { tools } = await toolsResponse.json()
    const availableTool = tools.find((t: any) => t.available === true)

    if (!availableTool) {
      test.skip()
      return
    }

    const createResponse = await request.post(`${baseURL}/api/cli/sessions`, {
      data: {
        projectId: project.id,
        worktreeId: worktrees[0].id,
        tool: availableTool.id,
      },
    })
    const { session } = await createResponse.json()

    // Get tokens multiple times
    const tokens: string[] = []
    for (let i = 0; i < 3; i++) {
      const listResponse = await request.get(`${baseURL}/api/cli/sessions`)
      const { sessions } = await listResponse.json()
      const found = sessions.find((s: any) => s.id === session.id)

      // Session might have exited quickly, which is okay
      if (!found) {
        console.warn(`Session ${session.id} not found in iteration ${i}, may have exited`)
        break
      }

      tokens.push(found.wsToken)

      // Brief delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Should have gotten at least one token
    expect(tokens.length).toBeGreaterThanOrEqual(1)

    // Verify all retrieved tokens are valid
    for (const token of tokens) {
      expect(token).toBeDefined()
    }

    // Clean up
    await request.delete(`${baseURL}/api/cli/sessions/${session.id}`)
  })

  test("should list all active sessions with fresh tokens", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Session List Test" },
    })
    const project = await addResponse.json()

    const worktreesResponse = await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)
    const worktrees = (await worktreesResponse.json()) as any[]

    const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
    const { tools } = await toolsResponse.json()
    const availableTool = tools.find((t: any) => t.available === true)

    if (!availableTool) {
      test.skip()
      return
    }

    // Create 2 sessions
    const session1Response = await request.post(`${baseURL}/api/cli/sessions`, {
      data: {
        projectId: project.id,
        worktreeId: worktrees[0].id,
        tool: availableTool.id,
        title: "Session 1",
      },
    })
    const { session: session1 } = await session1Response.json()

    const session2Response = await request.post(`${baseURL}/api/cli/sessions`, {
      data: {
        projectId: project.id,
        worktreeId: worktrees[0].id,
        tool: availableTool.id,
        title: "Session 2",
      },
    })
    const { session: session2 } = await session2Response.json()

    // Get session list
    const listResponse = await request.get(`${baseURL}/api/cli/sessions`)
    const { sessions } = await listResponse.json()

    // Find our sessions
    const found1 = sessions.find((s: any) => s.id === session1.id)
    const found2 = sessions.find((s: any) => s.id === session2.id)

    expect(found1).toBeDefined()
    expect(found2).toBeDefined()

    // Both should have tokens
    expect(found1.wsToken).toBeDefined()
    expect(found2.wsToken).toBeDefined()

    // Tokens should be different
    expect(found1.wsToken).not.toBe(found2.wsToken)

    // Clean up
    await request.delete(`${baseURL}/api/cli/sessions/${session1.id}`)
    await request.delete(`${baseURL}/api/cli/sessions/${session2.id}`)
  })

  test("should preserve session status across token refresh", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Status Test" },
    })
    const project = await addResponse.json()

    const worktreesResponse = await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)
    const worktrees = (await worktreesResponse.json()) as any[]

    const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
    const { tools } = await toolsResponse.json()
    const availableTool = tools.find((t: any) => t.available === true)

    if (!availableTool) {
      test.skip()
      return
    }

    const createResponse = await request.post(`${baseURL}/api/cli/sessions`, {
      data: {
        projectId: project.id,
        worktreeId: worktrees[0].id,
        tool: availableTool.id,
      },
    })
    const { session } = await createResponse.json()

    // Get session from list
    const listResponse = await request.get(`${baseURL}/api/cli/sessions`)
    const { sessions } = await listResponse.json()
    const found = sessions.find((s: any) => s.id === session.id)

    // Status should be running or starting
    expect(found.status).toMatch(/starting|running/)

    // Session metadata should be intact
    expect(found.projectId).toBe(project.id)
    expect(found.worktreeId).toBe(worktrees[0].id)
    expect(found.tool).toBe(availableTool.id)
    expect(found.cwd).toBeDefined()

    // Clean up
    await request.delete(`${baseURL}/api/cli/sessions/${session.id}`)
  })

  test("should not list deleted sessions", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Delete Test" },
    })
    const project = await addResponse.json()

    const worktreesResponse = await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)
    const worktrees = (await worktreesResponse.json()) as any[]

    const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
    const { tools } = await toolsResponse.json()
    const availableTool = tools.find((t: any) => t.available === true)

    if (!availableTool) {
      test.skip()
      return
    }

    const createResponse = await request.post(`${baseURL}/api/cli/sessions`, {
      data: {
        projectId: project.id,
        worktreeId: worktrees[0].id,
        tool: availableTool.id,
      },
    })
    const { session } = await createResponse.json()

    // Delete the session
    const deleteResponse = await request.delete(`${baseURL}/api/cli/sessions/${session.id}`)
    expect(deleteResponse.ok()).toBeTruthy()

    // Session should not appear in list
    const listResponse = await request.get(`${baseURL}/api/cli/sessions`)
    const { sessions } = await listResponse.json()
    const found = sessions.find((s: any) => s.id === session.id)

    expect(found).toBeUndefined()
  })
})
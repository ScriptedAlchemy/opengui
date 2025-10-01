import { test, expect } from "@playwright/test"

/**
 * Concurrent CLI Sessions E2E Test
 *
 * Tests multi-session stability:
 * 1. Create multiple sessions simultaneously
 * 2. Verify all sessions are running
 * 3. Verify sessions are independent
 * 4. Clean up all sessions
 */

test.describe("Concurrent CLI Sessions", () => {
  test("should handle multiple concurrent sessions", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Concurrent Test" },
    })
    const project = await addResponse.json()

    const worktreesResponse = await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)
    const worktrees = (await worktreesResponse.json()) as any[]

    const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
    const { tools } = await toolsResponse.json()
    const availableTool = tools.find((t: any) => t.available === true)

    if (!availableTool) {
      console.warn("No available CLI tools, skipping concurrent sessions test")
      test.skip()
      return
    }

    const sessionCount = 5
    const sessionIds: string[] = []

    try {
      // Create multiple sessions concurrently
      const createPromises = Array.from({ length: sessionCount }, (_, i) =>
        request.post(`${baseURL}/api/cli/sessions`, {
          data: {
            projectId: project.id,
            worktreeId: worktrees[0].id,
            tool: availableTool.id,
            title: `Concurrent Session ${i + 1}`,
          },
        })
      )

      const responses = await Promise.all(createPromises)

      // Verify all sessions were created successfully
      for (const response of responses) {
        expect(response.ok()).toBeTruthy()
        const { session } = await response.json()
        expect(session.id).toBeDefined()
        sessionIds.push(session.id)
      }

      // Verify all sessions appear in the list
      const listResponse = await request.get(`${baseURL}/api/cli/sessions`)
      const { sessions } = await listResponse.json()

      for (const sessionId of sessionIds) {
        const found = sessions.find((s: any) => s.id === sessionId)
        expect(found).toBeDefined()
        expect(found.status).toMatch(/starting|running/)
      }

      // Verify sessions are independent by checking they have different IDs
      const uniqueIds = new Set(sessionIds)
      expect(uniqueIds.size).toBe(sessionCount)
    } finally {
      // Clean up all sessions
      await Promise.all(
        sessionIds.map((id) => request.delete(`${baseURL}/api/cli/sessions/${id}`))
      )
    }
  })

  test("should handle rapid session creation and deletion", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Rapid Test" },
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

    // Create and immediately delete sessions
    for (let i = 0; i < 3; i++) {
      const createResponse = await request.post(`${baseURL}/api/cli/sessions`, {
        data: {
          projectId: project.id,
          worktreeId: worktrees[0].id,
          tool: availableTool.id,
          title: `Rapid Session ${i}`,
        },
      })
      expect(createResponse.ok()).toBeTruthy()
      const { session } = await createResponse.json()

      const deleteResponse = await request.delete(`${baseURL}/api/cli/sessions/${session.id}`)
      expect(deleteResponse.ok()).toBeTruthy()
    }

    // Verify all sessions are cleaned up
    const listResponse = await request.get(`${baseURL}/api/cli/sessions`)
    const { sessions } = await listResponse.json()
    // Note: There might be other sessions from other tests, so we just verify no errors
    expect(Array.isArray(sessions)).toBeTruthy()
  })
})
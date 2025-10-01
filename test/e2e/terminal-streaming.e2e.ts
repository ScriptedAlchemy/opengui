import { test, expect } from "@playwright/test"
import * as path from "node:path"

/**
 * Terminal Streaming E2E Test
 *
 * Tests real-time WebSocket data streaming from PTY to browser:
 * 1. Create a CLI session
 * 2. Connect via WebSocket with valid token
 * 3. Send input to terminal
 * 4. Receive and verify output
 * 5. Test terminal resize events
 */

test.describe("Terminal Streaming", () => {
  test("should stream terminal output via WebSocket", async ({ page, request, baseURL }) => {
    // Get or create the default project
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: {
        path: testProjectPath,
        name: "Terminal Streaming Test",
      },
    })
    expect(addResponse.ok()).toBeTruthy()
    const project = await addResponse.json()

    const worktreesResponse = await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)
    const worktrees = (await worktreesResponse.json()) as any[]
    const defaultWorktree = worktrees[0]

    // Get available tools
    const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
    const { tools } = await toolsResponse.json()
    const availableTool = tools.find((t: any) => t.available === true)

    if (!availableTool) {
      console.warn("No available CLI tools, skipping terminal streaming test")
      test.skip()
      return
    }

    // Create a CLI session
    const sessionResponse = await request.post(`${baseURL}/api/cli/sessions`, {
      data: {
        projectId: project.id,
        worktreeId: defaultWorktree.id,
        tool: availableTool.id,
        title: "Streaming Test Session",
      },
    })
    expect(sessionResponse.ok()).toBeTruthy()
    const { session, wsToken } = await sessionResponse.json()

    // Connect via WebSocket
    const wsUrl = baseURL!.replace("http://", "ws://").replace("https://", "wss://")
    const wsMessages: string[] = []

    await page.evaluate(
      async ({ url, token, messages }) => {
        return new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(`${url}/ws/cli?token=${token}`)
          const timeout = setTimeout(() => {
            ws.close()
            reject(new Error("Test timeout"))
          }, 10000)

          ws.addEventListener("open", () => {
            // Send a simple command (echo test)
            ws.send(JSON.stringify({ type: "input", data: "echo 'Hello from WebSocket'\n" }))
          })

          ws.addEventListener("message", (event) => {
            const data = event.data
            if (typeof data === "string") {
              // Check if we received the expected output
              if (data.includes("Hello from WebSocket")) {
                clearTimeout(timeout)
                ws.close()
                resolve()
              }
            }
          })

          ws.addEventListener("error", (err) => {
            clearTimeout(timeout)
            reject(new Error("WebSocket error"))
          })

          ws.addEventListener("close", () => {
            clearTimeout(timeout)
          })
        })
      },
      { url: wsUrl, token: wsToken, messages: wsMessages }
    )

    // Clean up
    await request.delete(`${baseURL}/api/cli/sessions/${session.id}`)
  })

  test("should handle terminal resize events", async ({ page, request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Resize Test" },
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

    const sessionResponse = await request.post(`${baseURL}/api/cli/sessions`, {
      data: {
        projectId: project.id,
        worktreeId: worktrees[0].id,
        tool: availableTool.id,
      },
    })
    const { session, wsToken } = await sessionResponse.json()

    const wsUrl = baseURL!.replace("http://", "ws://").replace("https://", "wss://")

    await page.evaluate(
      async ({ url, token }) => {
        return new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(`${url}/ws/cli?token=${token}`)
          const timeout = setTimeout(() => {
            ws.close()
            reject(new Error("Resize test timeout"))
          }, 5000)

          ws.addEventListener("open", () => {
            // Send resize event
            ws.send(JSON.stringify({ type: "resize", cols: 120, rows: 40 }))
            setTimeout(() => {
              clearTimeout(timeout)
              ws.close()
              resolve()
            }, 500)
          })

          ws.addEventListener("error", () => {
            clearTimeout(timeout)
            reject(new Error("WebSocket error"))
          })
        })
      },
      { url: wsUrl, token: wsToken }
    )

    // Clean up
    await request.delete(`${baseURL}/api/cli/sessions/${session.id}`)
  })
})
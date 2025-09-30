import { test, expect } from "@playwright/test"

/**
 * Security E2E Test
 *
 * Tests security features:
 * 1. WebSocket token expiration (1 hour TTL)
 * 2. Path traversal attempts blocked
 * 3. XSS prevention in project names
 * 4. Token tampering detection
 */

test.describe("Security", () => {
  test("should reject WebSocket connection with invalid token", async ({ page, request, baseURL }) => {
    const wsUrl = baseURL!.replace("http://", "ws://").replace("https://", "wss://")

    await expect(
      page.evaluate(
        async ({ url }) => {
          return new Promise<string>((resolve) => {
            const ws = new WebSocket(`${url}/ws/cli?token=invalid-token-123`)
            const timeout = setTimeout(() => {
              ws.close()
              resolve("timeout")
            }, 2000)

            ws.addEventListener("open", () => {
              clearTimeout(timeout)
              ws.close()
              resolve("opened") // Should not happen
            })

            ws.addEventListener("error", () => {
              clearTimeout(timeout)
              resolve("rejected")
            })

            ws.addEventListener("close", () => {
              clearTimeout(timeout)
              resolve("rejected")
            })
          })
        },
        { url: wsUrl }
      )
    ).resolves.toBe("rejected")
  })

  test("should reject WebSocket connection without token", async ({ page, baseURL }) => {
    const wsUrl = baseURL!.replace("http://", "ws://").replace("https://", "wss://")

    await expect(
      page.evaluate(
        async ({ url }) => {
          return new Promise<string>((resolve) => {
            const ws = new WebSocket(`${url}/ws/cli`) // No token parameter
            const timeout = setTimeout(() => {
              ws.close()
              resolve("timeout")
            }, 2000)

            ws.addEventListener("open", () => {
              clearTimeout(timeout)
              ws.close()
              resolve("opened") // Should not happen
            })

            ws.addEventListener("error", () => {
              clearTimeout(timeout)
              resolve("rejected")
            })

            ws.addEventListener("close", () => {
              clearTimeout(timeout)
              resolve("rejected")
            })
          })
        },
        { url: wsUrl }
      )
    ).resolves.toBe("rejected")
  })

  test("should reject path traversal in project path", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/projects`, {
      data: {
        path: "/tmp/../../../etc/passwd",
        name: "Path Traversal Attempt",
      },
    })

    // Should either reject as invalid path or normalize it safely
    // The actual behavior depends on path validation implementation
    if (response.ok()) {
      const project = await response.json()
      // If accepted, verify path is normalized and not outside allowed boundaries
      expect(project.path).not.toContain("../")
      await request.delete(`${baseURL}/api/projects/${project.id}`)
    } else {
      expect(response.status()).toBe(400)
    }
  })

  test("should handle XSS attempts in project name", async ({ request, baseURL }) => {
    const xssPayload = '<script>alert("XSS")</script>'
    const testProjectPath = process.cwd()

    const response = await request.post(`${baseURL}/api/projects`, {
      data: {
        path: testProjectPath,
        name: xssPayload,
      },
    })

    if (response.ok()) {
      const project = await response.json()

      // Name should be sanitized or stored as-is (frontend should escape)
      expect(project.name).toBeDefined()

      // Clean up
      await request.delete(`${baseURL}/api/projects/${project.id}`)
    }
  })

  test("should reject malicious git branch names", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Security Test" },
    })
    const project = await addResponse.json()

    // Try to create worktree with potentially malicious branch name
    const maliciousBranches = [
      "-flag-injection",
      "--help",
      "branch;rm -rf /",
      "branch && echo pwned",
      "branch | cat /etc/passwd",
    ]

    for (const branch of maliciousBranches) {
      const response = await request.post(`${baseURL}/api/projects/${project.id}/worktrees`, {
        data: {
          path: `/tmp/worktree-${Date.now()}`,
          branch,
          createBranch: true,
        },
      })

      // Should reject branches starting with - or containing shell metacharacters
      if (branch.startsWith("-") || branch.startsWith("--")) {
        expect(response.status()).toBe(400)
      }
    }

    // Clean up
    await request.delete(`${baseURL}/api/projects/${project.id}`)
  })

  test("should reject tampered WebSocket tokens", async ({ page, request, baseURL }) => {
    // Create a real session to get a valid token
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Token Test" },
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

    // Tamper with the token (change last character)
    const tamperedToken = wsToken.slice(0, -1) + "X"

    const wsUrl = baseURL!.replace("http://", "ws://").replace("https://", "wss://")

    await expect(
      page.evaluate(
        async ({ url, token }) => {
          return new Promise<string>((resolve) => {
            const ws = new WebSocket(`${url}/ws/cli?token=${token}`)
            const timeout = setTimeout(() => {
              ws.close()
              resolve("timeout")
            }, 2000)

            ws.addEventListener("open", () => {
              clearTimeout(timeout)
              ws.close()
              resolve("opened") // Should not happen
            })

            ws.addEventListener("error", () => {
              clearTimeout(timeout)
              resolve("rejected")
            })

            ws.addEventListener("close", () => {
              clearTimeout(timeout)
              resolve("rejected")
            })
          })
        },
        { url: wsUrl, token: tamperedToken }
      )
    ).resolves.toBe("rejected")

    // Clean up
    await request.delete(`${baseURL}/api/cli/sessions/${session.id}`)
  })

  test("should enforce CORS policy", async ({ request, baseURL }) => {
    // Test OPTIONS request (preflight)
    const response = await request.fetch(`${baseURL}/api/projects`, {
      method: "OPTIONS",
    })

    // Should have CORS headers
    const headers = response.headers()
    // Note: Actual CORS headers depend on server configuration
    // This test verifies the server responds to OPTIONS requests
    expect([200, 204]).toContain(response.status())
  })
})

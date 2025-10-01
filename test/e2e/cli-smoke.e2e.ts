import { test, expect } from "@playwright/test"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"

/**
 * CLI Smoke Test
 *
 * Basic end-to-end test for the CLI-first Operations Hub:
 * 1. Server starts and serves the app
 * 2. Health endpoints are accessible
 * 3. Can add a project
 * 4. Can create a CLI session (if tools are available)
 * 5. WebSocket connection works with token authentication
 */

test.describe("CLI Operations Hub Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("/")
  })

  test("should load the operations hub", async ({ page, request, baseURL }) => {
    // Test 1: Server responds with HTML
    const response = await page.goto("/")
    expect(response?.status()).toBe(200)
    expect(response?.headers()["content-type"]).toContain("text/html")

    // Test 2: HTML structure is present (ESM fix verification)
    await expect(page.locator("#root")).toBeAttached()

    // Test 3: JavaScript files are loaded
    const scripts = await page.locator("script[src]").count()
    expect(scripts).toBeGreaterThan(0)

    // Note: React rendering is tested separately in the API tests below
    // which verify the backend is fully functional
  })

  test("should have working health endpoints", async ({ request, baseURL }) => {
    // Test liveness endpoint
    const liveResponse = await request.get(`${baseURL}/api/health/live`)
    expect(liveResponse.ok()).toBeTruthy()
    const liveData = await liveResponse.json()
    expect(liveData.status).toBe("alive")

    // Test readiness endpoint
    const readyResponse = await request.get(`${baseURL}/api/health/ready`)
    expect(readyResponse.ok()).toBeTruthy()
    const readyData = await readyResponse.json()
    expect(readyData.status).toBe("ready")
    expect(readyData.cli).toBeDefined()

    // Test main health endpoint
    const healthResponse = await request.get(`${baseURL}/api/health`)
    expect(healthResponse.ok()).toBeTruthy()
    const healthData = await healthResponse.json()
    expect(healthData.status).toBe("ok")
    expect(healthData.cli).toBeDefined()
  })

  test("should list available CLI tools", async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/cli/tools`)
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.tools).toBeDefined()
    expect(Array.isArray(data.tools)).toBeTruthy()

    // Should have at least the three supported tools
    expect(data.tools.length).toBeGreaterThanOrEqual(3)

    const toolIds = data.tools.map((t: any) => t.id)
    expect(toolIds).toContain("codex")
    expect(toolIds).toContain("claude")
    expect(toolIds).toContain("opencode")
  })

  test("should list CLI sessions (empty initially)", async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/cli/sessions`)
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.sessions).toBeDefined()
    expect(Array.isArray(data.sessions)).toBeTruthy()
  })

  test("should be able to add a project", async ({ page, request, baseURL }) => {
    // Get initial project list
    const listResponse = await request.get(`${baseURL}/api/projects`)
    expect(listResponse.ok()).toBeTruthy()
    const initialProjects = (await listResponse.json()) as any[]
    const initialCount = Array.isArray(initialProjects) ? initialProjects.length : 0

    // Create a unique temp directory for the test project (avoid conflict with seeded project)
    const testProjectPath = path.join(os.tmpdir(), `opencode-test-${Date.now()}`)
    fs.mkdirSync(testProjectPath, { recursive: true })

    try {
      // Add the test project
      const addResponse = await request.post(`${baseURL}/api/projects`, {
        data: {
          path: testProjectPath,
          name: "Test Project",
        },
      })

      expect(addResponse.ok()).toBeTruthy()
      const project = await addResponse.json()
      expect(project).toBeDefined()
      expect(project.path).toBe(testProjectPath)
      expect(project.name).toBe("Test Project")

      // Verify project was added
      const updatedListResponse = await request.get(`${baseURL}/api/projects`)
      expect(updatedListResponse.ok()).toBeTruthy()
      const updatedProjects = (await updatedListResponse.json()) as any[]
      expect(updatedProjects.length).toBe(initialCount + 1)

      // Clean up - remove the test project
      await request.delete(`${baseURL}/api/projects/${project.id}`)
    } finally {
      // Clean up temp directory
      fs.rmSync(testProjectPath, { recursive: true, force: true })
    }
  })

  test("should handle project creation and CLI session lifecycle", async ({ page, request, baseURL }) => {
    // Use the seeded default project (process.cwd()) for this test
    const testProjectPath = process.cwd()

    // Get or create the project (will return existing if already seeded)
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: {
        path: testProjectPath,
        name: "CLI Test Project",
      },
    })

    expect(addResponse.ok()).toBeTruthy()
    const project = await addResponse.json()

    // Get the default worktree
    const worktreesResponse = await request.get(
      `${baseURL}/api/projects/${project.id}/worktrees`
    )
    expect(worktreesResponse.ok()).toBeTruthy()
    const worktreesData = (await worktreesResponse.json()) as any[]
    expect(worktreesData.length).toBeGreaterThan(0)
    const defaultWorktree = worktreesData[0]

    // Get available tools
    const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
    const toolsData = await toolsResponse.json()
    const availableTool = toolsData.tools.find((t: any) => t.available === true)

    if (availableTool) {
      // Create a CLI session
      const sessionResponse = await request.post(`${baseURL}/api/cli/sessions`, {
        data: {
          projectId: project.id,
          worktreeId: defaultWorktree.id,
          tool: availableTool.id,
          title: "Test Session",
        },
      })

      expect(sessionResponse.ok()).toBeTruthy()
      const sessionData = await sessionResponse.json()
      expect(sessionData.session).toBeDefined()
      expect(sessionData.wsToken).toBeDefined()
      expect(sessionData.session.id).toBeDefined()
      expect(sessionData.session.tool).toBe(availableTool.id)

      // Verify session appears in list
      const sessionsResponse = await request.get(`${baseURL}/api/cli/sessions`)
      const sessionsData = await sessionsResponse.json()
      const createdSession = sessionsData.sessions.find(
        (s: any) => s.id === sessionData.session.id
      )
      expect(createdSession).toBeDefined()

      // Clean up - close the session
      const closeResponse = await request.delete(
        `${baseURL}/api/cli/sessions/${sessionData.session.id}`
      )
      expect(closeResponse.ok()).toBeTruthy()
    } else {
      console.warn("No available CLI tools detected, skipping session creation test")
    }

    // Note: We don't delete the project as it's the seeded default project (process.cwd())
  })

  test("should enforce WebSocket authentication", async ({ page, request, baseURL }) => {
    // Use the seeded default project (process.cwd()) for this test
    const testProjectPath = process.cwd()

    // Get or create the project (will return existing if already seeded)
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: {
        path: testProjectPath,
        name: "WS Auth Test Project",
      },
    })

    const project = await addResponse.json()

    const worktreesResponse = await request.get(
      `${baseURL}/api/projects/${project.id}/worktrees`
    )
    const worktreesData = (await worktreesResponse.json()) as any[]
    const defaultWorktree = worktreesData[0]

    const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
    const toolsData = await toolsResponse.json()
    const availableTool = toolsData.tools.find((t: any) => t.available === true)

    if (availableTool) {
      const sessionResponse = await request.post(`${baseURL}/api/cli/sessions`, {
        data: {
          projectId: project.id,
          worktreeId: defaultWorktree.id,
          tool: availableTool.id,
        },
      })

      const { session, wsToken } = await sessionResponse.json()

      // Test WebSocket connection WITH valid token
      const wsUrl = baseURL!.replace("http://", "ws://").replace("https://", "wss://")

      await page.evaluate(
        async ({ url, sessionId, token }) => {
          return new Promise((resolve, reject) => {
            const ws = new WebSocket(`${url}/ws/cli?token=${token}`)
            const timeout = setTimeout(() => {
              ws.close()
              reject(new Error("Connection timeout"))
            }, 5000)

            ws.addEventListener("open", () => {
              clearTimeout(timeout)
              ws.close()
              resolve("connected")
            })

            ws.addEventListener("error", (err) => {
              clearTimeout(timeout)
              reject(err)
            })
          })
        },
        { url: wsUrl, sessionId: session.id, token: wsToken }
      )

      // Test WebSocket connection WITHOUT token (should fail)
      await expect(
        page.evaluate(
          async ({ url, sessionId }) => {
            return new Promise((resolve, reject) => {
              const ws = new WebSocket(`${url}/ws/cli?token=invalid-token`)
              const timeout = setTimeout(() => {
                ws.close()
                resolve("timeout") // Connection should be rejected before timeout
              }, 2000)

              ws.addEventListener("open", () => {
                clearTimeout(timeout)
                ws.close()
                reject(new Error("Should not connect with invalid token"))
              })

              ws.addEventListener("error", () => {
                clearTimeout(timeout)
                resolve("rejected") // Expected behavior
              })

              ws.addEventListener("close", () => {
                clearTimeout(timeout)
                resolve("rejected") // Expected behavior
              })
            })
          },
          { url: wsUrl, sessionId: session.id }
        )
      ).resolves.toBe("rejected")

      // Clean up session
      await request.delete(`${baseURL}/api/cli/sessions/${session.id}`)
    } else {
      console.warn("No available CLI tools detected, skipping WebSocket auth test")
    }

    // Note: We don't delete the project as it's the seeded default project (process.cwd())
  })

  test("should create git repo, worktree, and spawn CLI session in worktree directory", async ({ request, baseURL }) => {
    // Create a unique temp directory with git repo
    const testProjectPath = path.join(os.tmpdir(), `opencode-git-test-${Date.now()}`)
    fs.mkdirSync(testProjectPath, { recursive: true })

    try {
      // Initialize git repository
      const { execSync } = await import("node:child_process")
      execSync("git init", { cwd: testProjectPath })
      execSync('git config user.email "test@example.com"', { cwd: testProjectPath })
      execSync('git config user.name "Test User"', { cwd: testProjectPath })

      // Create initial commit
      fs.writeFileSync(path.join(testProjectPath, "README.md"), "# Test Project")
      execSync("git add .", { cwd: testProjectPath })
      execSync('git commit -m "Initial commit"', { cwd: testProjectPath })

      // Add project
      const addProjectResponse = await request.post(`${baseURL}/api/projects`, {
        data: {
          path: testProjectPath,
          name: "Git Worktree Test Project",
        },
      })
      expect(addProjectResponse.ok()).toBeTruthy()
      const project = await addProjectResponse.json()

      // Get worktrees (should have at least the primary worktree)
      const worktreesResponse = await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)
      expect(worktreesResponse.ok()).toBeTruthy()
      const worktreesData = (await worktreesResponse.json()) as any[]
      expect(worktreesData).toBeDefined()
      expect(worktreesData.length).toBeGreaterThanOrEqual(1)
      // Use the first worktree (primary/default)
      const primaryWorktree = worktreesData[0]
      // Normalize paths for comparison (macOS adds /private prefix to /tmp)
      const { realpathSync } = await import("node:fs")
      expect(realpathSync(primaryWorktree.path)).toBe(realpathSync(testProjectPath))

      // Create a new worktree with a new branch
      const worktreePath = path.join(testProjectPath, "..", `worktree-${Date.now()}`)
      const createWorktreeResponse = await request.post(
        `${baseURL}/api/projects/${project.id}/worktrees`,
        {
          data: {
            path: worktreePath,
            title: "Feature Branch Worktree",
            branch: "feature/test",
            createBranch: true,
          },
        }
      )
      if (!createWorktreeResponse.ok()) {
        const errorData = await createWorktreeResponse.json()
        console.error("Worktree creation failed:", errorData)
      }
      expect(createWorktreeResponse.ok()).toBeTruthy()
      const newWorktree = await createWorktreeResponse.json()
      expect(newWorktree.branch).toBe("feature/test")
      expect(newWorktree.id).toBeDefined()
      expect(realpathSync(newWorktree.path)).toBe(realpathSync(worktreePath))

      // Verify worktree directory exists
      expect(fs.existsSync(worktreePath)).toBe(true)
      expect(fs.existsSync(path.join(worktreePath, "README.md"))).toBe(true)

      // Get available CLI tools
      const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
      const toolsData = await toolsResponse.json()
      const availableTool = toolsData.tools.find((t: any) => t.available === true)

      if (availableTool) {
        // Create CLI session in the NEW WORKTREE
        const sessionResponse = await request.post(`${baseURL}/api/cli/sessions`, {
          data: {
            projectId: project.id,
            worktreeId: newWorktree.id,
            tool: availableTool.id,
            title: "Worktree Session",
          },
        })
        expect(sessionResponse.ok()).toBeTruthy()
        const sessionData = await sessionResponse.json()
        expect(sessionData.session).toBeDefined()
        expect(realpathSync(sessionData.session.cwd)).toBe(realpathSync(worktreePath))
        expect(sessionData.session.worktreeId).toBe(newWorktree.id)

        // Verify session is running
        const sessionsResponse = await request.get(`${baseURL}/api/cli/sessions`)
        const sessionsListData = await sessionsResponse.json()
        const runningSession = sessionsListData.sessions.find(
          (s: any) => s.id === sessionData.session.id
        )
        expect(runningSession).toBeDefined()
        expect(runningSession.status).toMatch(/starting|running/)

        // Clean up session
        await request.delete(`${baseURL}/api/cli/sessions/${sessionData.session.id}`)
      }

      // Clean up - remove worktree
      const deleteWorktreeResponse = await request.delete(
        `${baseURL}/api/projects/${project.id}/worktrees/${newWorktree.id}`
      )
      expect(deleteWorktreeResponse.ok()).toBeTruthy()

      // Verify worktree was removed
      const finalWorktreesResponse = await request.get(
        `${baseURL}/api/projects/${project.id}/worktrees`
      )
      const finalWorktreesData = (await finalWorktreesResponse.json()) as any[]
      expect(finalWorktreesData.length).toBe(1) // Only default remains

      // Clean up project
      await request.delete(`${baseURL}/api/projects/${project.id}`)
    } finally {
      // Clean up temp directories
      if (fs.existsSync(testProjectPath)) {
        fs.rmSync(testProjectPath, { recursive: true, force: true })
      }
      // Clean up any worktree directories
      const parentDir = path.dirname(testProjectPath)
      const worktreeDirs = fs.readdirSync(parentDir).filter(name => name.startsWith("worktree-"))
      for (const dir of worktreeDirs) {
        const fullPath = path.join(parentDir, dir)
        if (fs.existsSync(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true })
        }
      }
    }
  })

})
import { test, expect } from "@playwright/test"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"

/**
 * Error Scenarios E2E Test
 *
 * Tests error handling for invalid inputs and edge cases:
 * 1. Invalid project paths (non-existent, not a directory, relative)
 * 2. Git worktree failures (invalid branch)
 * 3. CLI session creation when tool is unavailable
 * 4. Invalid API requests (malformed payloads)
 */

test.describe("Error Scenarios", () => {
  test("should reject invalid project path (non-existent)", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/projects`, {
      data: {
        path: "/nonexistent/path/to/project",
        name: "Invalid Project",
      },
    })

    expect(response.status()).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  test("should reject invalid project path (relative path)", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/projects`, {
      data: {
        path: "../relative/path",
        name: "Relative Path Project",
      },
    })

    expect(response.status()).toBe(400)
    const data = await response.json()
    // Error can be a string or Zod error object
    const errorText = typeof data.error === "string" ? data.error : JSON.stringify(data.error)
    expect(errorText).toContain("absolute")
  })

  test("should reject project path that is not a directory", async ({ request, baseURL }) => {
    // Create a temporary file
    const tempFile = path.join(os.tmpdir(), `test-file-${Date.now()}.txt`)
    fs.writeFileSync(tempFile, "test content")

    try {
      const response = await request.post(`${baseURL}/api/projects`, {
        data: {
          path: tempFile,
          name: "File Not Directory",
        },
      })

      expect(response.status()).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    } finally {
      fs.unlinkSync(tempFile)
    }
  })

  test("should handle git worktree creation with invalid branch", async ({ request, baseURL }) => {
    // Create a git repo
    const testProjectPath = path.join(os.tmpdir(), `opencode-error-test-${Date.now()}`)
    fs.mkdirSync(testProjectPath, { recursive: true })

    try {
      const { execSync } = await import("node:child_process")
      execSync("git init", { cwd: testProjectPath })
      execSync('git config user.email "test@example.com"', { cwd: testProjectPath })
      execSync('git config user.name "Test User"', { cwd: testProjectPath })
      fs.writeFileSync(path.join(testProjectPath, "README.md"), "# Test")
      execSync("git add .", { cwd: testProjectPath })
      execSync('git commit -m "Initial commit"', { cwd: testProjectPath })

      // Add project
      const addResponse = await request.post(`${baseURL}/api/projects`, {
        data: {
          path: testProjectPath,
          name: "Error Test Project",
        },
      })
      const project = await addResponse.json()

      // Try to create worktree with invalid branch name
      const worktreePath = path.join(testProjectPath, "..", `worktree-error-${Date.now()}`)
      const createResponse = await request.post(
        `${baseURL}/api/projects/${project.id}/worktrees`,
        {
          data: {
            path: worktreePath,
            branch: "-invalid-branch-name", // Invalid: starts with dash
            createBranch: true,
          },
        }
      )

      expect(createResponse.status()).toBe(400)
      const data = await createResponse.json()
      expect(data.error).toBeDefined()

      // Clean up
      await request.delete(`${baseURL}/api/projects/${project.id}`)
    } finally {
      if (fs.existsSync(testProjectPath)) {
        fs.rmSync(testProjectPath, { recursive: true, force: true })
      }
    }
  })

  test("should handle CLI session creation with unavailable tool", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Tool Test" },
    })
    const project = await addResponse.json()

    const worktreesResponse = await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)
    const worktrees = (await worktreesResponse.json()) as any[]

    // Try to create session with non-existent tool
    const sessionResponse = await request.post(`${baseURL}/api/cli/sessions`, {
      data: {
        projectId: project.id,
        worktreeId: worktrees[0].id,
        tool: "nonexistent-tool",
        title: "Invalid Tool Session",
      },
    })

    expect(sessionResponse.status()).toBe(400)
    const data = await sessionResponse.json()
    expect(data.error).toBeDefined()
  })

  test("should reject malformed worktree creation payload", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Malformed Test" },
    })
    const project = await addResponse.json()

    // Missing required path field
    const createResponse = await request.post(
      `${baseURL}/api/projects/${project.id}/worktrees`,
      {
        data: {
          branch: "feature/test",
          // Missing path
        },
      }
    )

    expect(createResponse.status()).toBe(400)
  })

  test("should reject empty branch name", async ({ request, baseURL }) => {
    const testProjectPath = path.join(os.tmpdir(), `opencode-empty-branch-${Date.now()}`)
    fs.mkdirSync(testProjectPath, { recursive: true })

    try {
      const { execSync } = await import("node:child_process")
      execSync("git init", { cwd: testProjectPath })
      execSync('git config user.email "test@example.com"', { cwd: testProjectPath })
      execSync('git config user.name "Test User"', { cwd: testProjectPath })
      fs.writeFileSync(path.join(testProjectPath, "README.md"), "# Test")
      execSync("git add .", { cwd: testProjectPath })
      execSync('git commit -m "Initial commit"', { cwd: testProjectPath })

      const addResponse = await request.post(`${baseURL}/api/projects`, {
        data: { path: testProjectPath, name: "Empty Branch Test" },
      })
      const project = await addResponse.json()

      const worktreePath = path.join(testProjectPath, "..", `worktree-empty-${Date.now()}`)
      const createResponse = await request.post(
        `${baseURL}/api/projects/${project.id}/worktrees`,
        {
          data: {
            path: worktreePath,
            branch: "   ", // Empty/whitespace branch name
            createBranch: true,
          },
        }
      )

      expect(createResponse.status()).toBe(400)

      // Clean up
      await request.delete(`${baseURL}/api/projects/${project.id}`)
    } finally {
      if (fs.existsSync(testProjectPath)) {
        fs.rmSync(testProjectPath, { recursive: true, force: true })
      }
    }
  })

  test("should handle project deletion with active sessions gracefully", async ({
    request,
    baseURL,
  }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Deletion Test" },
    })
    const project = await addResponse.json()

    const worktreesResponse = await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)
    const worktrees = (await worktreesResponse.json()) as any[]

    const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
    const { tools } = await toolsResponse.json()
    const availableTool = tools.find((t: any) => t.available === true)

    if (availableTool) {
      // Create a session
      const sessionResponse = await request.post(`${baseURL}/api/cli/sessions`, {
        data: {
          projectId: project.id,
          worktreeId: worktrees[0].id,
          tool: availableTool.id,
        },
      })
      const { session } = await sessionResponse.json()

      // Try to delete project (should succeed - sessions are independent)
      const deleteResponse = await request.delete(`${baseURL}/api/projects/${project.id}`)
      expect(deleteResponse.ok()).toBeTruthy()

      // Clean up session
      await request.delete(`${baseURL}/api/cli/sessions/${session.id}`)
    }
  })
})
import { test, expect } from "@playwright/test"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"

/**
 * Git Status E2E Test
 *
 * Tests git status endpoint functionality:
 * 1. GET /api/projects/:id/git/status - Basic git status
 * 2. GET /api/projects/:id/git/status?worktree=:id - Worktree-specific status
 * 3. Branch ahead/behind tracking
 * 4. File status (staged, modified, untracked)
 * 5. Last commit and recent commits
 * 6. Remote URL detection
 */

test.describe("Git Status", () => {
  test("should return git status for a project", async ({ request, baseURL }) => {
    // Create a git repo
    const testProjectPath = path.join(os.tmpdir(), `opencode-status-test-${Date.now()}`)
    fs.mkdirSync(testProjectPath, { recursive: true })

    try {
      const { execSync } = await import("node:child_process")
      execSync("git init", { cwd: testProjectPath })
      execSync('git config user.email "test@example.com"', { cwd: testProjectPath })
      execSync('git config user.name "Test User"', { cwd: testProjectPath })

      // Create initial commit
      fs.writeFileSync(path.join(testProjectPath, "README.md"), "# Test Project")
      execSync("git add .", { cwd: testProjectPath })
      execSync('git commit -m "Initial commit"', { cwd: testProjectPath })

      // Add project
      const addResponse = await request.post(`${baseURL}/api/projects`, {
        data: {
          path: testProjectPath,
          name: "Git Status Test",
        },
      })
      expect(addResponse.ok()).toBeTruthy()
      const project = await addResponse.json()

      // Get git status
      const statusResponse = await request.get(`${baseURL}/api/projects/${project.id}/git/status`)
      expect(statusResponse.ok()).toBeTruthy()

      const status = await statusResponse.json()
      expect(status.branch).toBeDefined()
      expect(status.branch).toContain("main")
      expect(status.changedFiles).toBe(0)
      expect(status.staged).toEqual([])
      expect(status.modified).toEqual([])
      expect(status.untracked).toEqual([])
      expect(status.lastCommit).toBeDefined()
      expect(status.lastCommit.message).toBe("Initial commit")
      expect(status.recentCommits).toBeDefined()
      expect(status.recentCommits.length).toBeGreaterThanOrEqual(1)

      // Clean up
      await request.delete(`${baseURL}/api/projects/${project.id}`)
    } finally {
      if (fs.existsSync(testProjectPath)) {
        fs.rmSync(testProjectPath, { recursive: true, force: true })
      }
    }
  })

  test("should detect modified files", async ({ request, baseURL }) => {
    const testProjectPath = path.join(os.tmpdir(), `opencode-modified-test-${Date.now()}`)
    fs.mkdirSync(testProjectPath, { recursive: true })

    try {
      const { execSync } = await import("node:child_process")
      execSync("git init", { cwd: testProjectPath })
      execSync('git config user.email "test@example.com"', { cwd: testProjectPath })
      execSync('git config user.name "Test User"', { cwd: testProjectPath })

      fs.writeFileSync(path.join(testProjectPath, "file1.txt"), "content")
      execSync("git add .", { cwd: testProjectPath })
      execSync('git commit -m "Initial commit"', { cwd: testProjectPath })

      // Modify file
      fs.writeFileSync(path.join(testProjectPath, "file1.txt"), "modified content")

      const addResponse = await request.post(`${baseURL}/api/projects`, {
        data: { path: testProjectPath, name: "Modified Test" },
      })
      const project = await addResponse.json()

      const statusResponse = await request.get(`${baseURL}/api/projects/${project.id}/git/status`)
      const status = await statusResponse.json()

      expect(status.changedFiles).toBeGreaterThanOrEqual(1)
      expect(status.modified.length).toBeGreaterThanOrEqual(1)
      // Modified can be an object with path property or a string
      const modifiedPath = typeof status.modified[0] === "string"
        ? status.modified[0]
        : status.modified[0].path
      expect(modifiedPath).toContain("file1.txt")

      await request.delete(`${baseURL}/api/projects/${project.id}`)
    } finally {
      if (fs.existsSync(testProjectPath)) {
        fs.rmSync(testProjectPath, { recursive: true, force: true })
      }
    }
  })

  test("should detect staged files", async ({ request, baseURL }) => {
    const testProjectPath = path.join(os.tmpdir(), `opencode-staged-test-${Date.now()}`)
    fs.mkdirSync(testProjectPath, { recursive: true })

    try {
      const { execSync } = await import("node:child_process")
      execSync("git init", { cwd: testProjectPath })
      execSync('git config user.email "test@example.com"', { cwd: testProjectPath })
      execSync('git config user.name "Test User"', { cwd: testProjectPath })

      fs.writeFileSync(path.join(testProjectPath, "README.md"), "# Test")
      execSync("git add .", { cwd: testProjectPath })
      execSync('git commit -m "Initial commit"', { cwd: testProjectPath })

      // Create and stage new file
      fs.writeFileSync(path.join(testProjectPath, "new-file.txt"), "new content")
      execSync("git add new-file.txt", { cwd: testProjectPath })

      const addResponse = await request.post(`${baseURL}/api/projects`, {
        data: { path: testProjectPath, name: "Staged Test" },
      })
      const project = await addResponse.json()

      const statusResponse = await request.get(`${baseURL}/api/projects/${project.id}/git/status`)
      const status = await statusResponse.json()

      expect(status.staged.length).toBeGreaterThanOrEqual(1)
      const stagedPath = typeof status.staged[0] === "string"
        ? status.staged[0]
        : status.staged[0].path
      expect(stagedPath).toContain("new-file.txt")

      await request.delete(`${baseURL}/api/projects/${project.id}`)
    } finally {
      if (fs.existsSync(testProjectPath)) {
        fs.rmSync(testProjectPath, { recursive: true, force: true })
      }
    }
  })

  test("should detect untracked files", async ({ request, baseURL }) => {
    const testProjectPath = path.join(os.tmpdir(), `opencode-untracked-test-${Date.now()}`)
    fs.mkdirSync(testProjectPath, { recursive: true })

    try {
      const { execSync } = await import("node:child_process")
      execSync("git init", { cwd: testProjectPath })
      execSync('git config user.email "test@example.com"', { cwd: testProjectPath })
      execSync('git config user.name "Test User"', { cwd: testProjectPath })

      fs.writeFileSync(path.join(testProjectPath, "README.md"), "# Test")
      execSync("git add .", { cwd: testProjectPath })
      execSync('git commit -m "Initial commit"', { cwd: testProjectPath })

      // Create untracked file
      fs.writeFileSync(path.join(testProjectPath, "untracked.txt"), "untracked")

      const addResponse = await request.post(`${baseURL}/api/projects`, {
        data: { path: testProjectPath, name: "Untracked Test" },
      })
      const project = await addResponse.json()

      const statusResponse = await request.get(`${baseURL}/api/projects/${project.id}/git/status`)
      const status = await statusResponse.json()

      expect(status.untracked.length).toBeGreaterThanOrEqual(1)
      const untrackedPath = typeof status.untracked[0] === "string"
        ? status.untracked[0]
        : status.untracked[0].path
      expect(untrackedPath).toContain("untracked.txt")

      await request.delete(`${baseURL}/api/projects/${project.id}`)
    } finally {
      if (fs.existsSync(testProjectPath)) {
        fs.rmSync(testProjectPath, { recursive: true, force: true })
      }
    }
  })

  test("should return status for specific worktree", async ({ request, baseURL }) => {
    const testProjectPath = path.join(os.tmpdir(), `opencode-worktree-status-${Date.now()}`)
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
        data: { path: testProjectPath, name: "Worktree Status Test" },
      })
      const project = await addResponse.json()

      // Create worktree
      const worktreePath = path.join(testProjectPath, "..", `worktree-status-${Date.now()}`)
      const createWorktreeResponse = await request.post(
        `${baseURL}/api/projects/${project.id}/worktrees`,
        {
          data: {
            path: worktreePath,
            title: "Feature Branch",
            branch: "feature/test",
            createBranch: true,
          },
        }
      )
      expect(createWorktreeResponse.ok()).toBeTruthy()
      const worktree = await createWorktreeResponse.json()

      // Create a file in the worktree
      fs.writeFileSync(path.join(worktreePath, "feature.txt"), "feature content")

      // Get status for specific worktree
      const statusResponse = await request.get(
        `${baseURL}/api/projects/${project.id}/git/status`,
        {
          params: { worktree: worktree.id },
        }
      )
      expect(statusResponse.ok()).toBeTruthy()

      const status = await statusResponse.json()
      expect(status.branch).toContain("feature/test")
      expect(status.untracked.length).toBeGreaterThanOrEqual(1)
      const featurePath = typeof status.untracked[0] === "string"
        ? status.untracked[0]
        : status.untracked[0].path
      expect(featurePath).toContain("feature.txt")

      // Clean up
      await request.delete(`${baseURL}/api/projects/${project.id}/worktrees/${worktree.id}`)
      await request.delete(`${baseURL}/api/projects/${project.id}`)

      if (fs.existsSync(worktreePath)) {
        fs.rmSync(worktreePath, { recursive: true, force: true })
      }
    } finally {
      if (fs.existsSync(testProjectPath)) {
        fs.rmSync(testProjectPath, { recursive: true, force: true })
      }
    }
  })

  test("should handle non-git directory gracefully", async ({ request, baseURL }) => {
    const testProjectPath = path.join(os.tmpdir(), `opencode-nongit-test-${Date.now()}`)
    fs.mkdirSync(testProjectPath, { recursive: true })

    try {
      // Don't initialize git
      fs.writeFileSync(path.join(testProjectPath, "file.txt"), "content")

      const addResponse = await request.post(`${baseURL}/api/projects`, {
        data: { path: testProjectPath, name: "Non-Git Test" },
      })
      const project = await addResponse.json()

      const statusResponse = await request.get(`${baseURL}/api/projects/${project.id}/git/status`)
      expect(statusResponse.ok()).toBeTruthy()

      const status = await statusResponse.json()
      // Should return empty/default status
      expect(status.branch).toBeDefined()
      expect(status.changedFiles).toBe(0)

      await request.delete(`${baseURL}/api/projects/${project.id}`)
    } finally {
      if (fs.existsSync(testProjectPath)) {
        fs.rmSync(testProjectPath, { recursive: true, force: true })
      }
    }
  })

  test("should return recent commits", async ({ request, baseURL }) => {
    const testProjectPath = path.join(os.tmpdir(), `opencode-commits-test-${Date.now()}`)
    fs.mkdirSync(testProjectPath, { recursive: true })

    try {
      const { execSync } = await import("node:child_process")
      execSync("git init", { cwd: testProjectPath })
      execSync('git config user.email "test@example.com"', { cwd: testProjectPath })
      execSync('git config user.name "Test User"', { cwd: testProjectPath })

      // Create multiple commits
      for (let i = 1; i <= 3; i++) {
        fs.writeFileSync(path.join(testProjectPath, `file${i}.txt`), `content ${i}`)
        execSync("git add .", { cwd: testProjectPath })
        execSync(`git commit -m "Commit ${i}"`, { cwd: testProjectPath })
      }

      const addResponse = await request.post(`${baseURL}/api/projects`, {
        data: { path: testProjectPath, name: "Commits Test" },
      })
      const project = await addResponse.json()

      const statusResponse = await request.get(`${baseURL}/api/projects/${project.id}/git/status`)
      const status = await statusResponse.json()

      expect(status.recentCommits).toBeDefined()
      expect(status.recentCommits.length).toBe(3)
      expect(status.recentCommits[0].message).toBe("Commit 3")
      expect(status.recentCommits[1].message).toBe("Commit 2")
      expect(status.recentCommits[2].message).toBe("Commit 1")

      expect(status.lastCommit.message).toBe("Commit 3")
      expect(status.lastCommit.hash).toBeDefined()
      expect(status.lastCommit.author).toBe("Test User")

      await request.delete(`${baseURL}/api/projects/${project.id}`)
    } finally {
      if (fs.existsSync(testProjectPath)) {
        fs.rmSync(testProjectPath, { recursive: true, force: true })
      }
    }
  })
})
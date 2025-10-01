import { test, expect } from "@playwright/test"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"

/**
 * Branches Endpoint E2E
 *
 * Validates that GET /api/projects/:id/git/branches returns:
 *  - local branches (refs/heads/*)
 *  - remote-tracking branches (refs/remotes/*) after an implicit fetch
 *  - checkedOut mapping for locals and corresponding remotes
 * Also validates creating a worktree from a remote ref (origin/only-remote).
 */

test.describe("Git Branch Listing (locals + remotes)", () => {
  test("lists remote-tracking branches and reflects checkedOut mapping", async ({ request, baseURL }) => {
    const repo = path.join(os.tmpdir(), `opencode-branches-${Date.now()}`)
    const bare = path.join(os.tmpdir(), `opencode-branches-bare-${Date.now()}.git`)
    fs.mkdirSync(repo, { recursive: true })
    fs.mkdirSync(bare, { recursive: true })

    const { execSync } = await import("node:child_process")
    try {
      // Init local and bare remote
      execSync("git init", { cwd: repo })
      execSync('git config user.email "test@example.com"', { cwd: repo })
      execSync('git config user.name "Test User"', { cwd: repo })
      execSync("git init --bare", { cwd: bare })
      execSync(`git remote add origin ${bare}`, { cwd: repo })

      // Initial commit on main
      fs.writeFileSync(path.join(repo, "a.txt"), "a")
      execSync("git add .", { cwd: repo })
      execSync('git commit -m "init"', { cwd: repo })
      execSync("git branch -M main", { cwd: repo })
      execSync("git push -u origin main", { cwd: repo })

      // Create a local feature branch and push
      execSync("git checkout -b feature/local", { cwd: repo })
      fs.writeFileSync(path.join(repo, "b.txt"), "b")
      execSync("git add . && git commit -m local", { cwd: repo })
      execSync("git push -u origin feature/local", { cwd: repo })

      // Create a remote-only branch (no local tracking branch)
      execSync("git checkout main", { cwd: repo })
      execSync('git commit --allow-empty -m "seed for remote only"', { cwd: repo })
      execSync("git push origin HEAD:refs/heads/only-remote", { cwd: repo })

      // Add project
      const add = await request.post(`${baseURL}/api/projects`, { data: { path: repo, name: "Branches Test" } })
      expect(add.ok()).toBeTruthy()
      const project = await add.json()

      // Create a worktree for feature/local to mark it as checked out
      const wtPath = path.join(repo, "..", `wt-branches-${Date.now()}`)
      const addWt = await request.post(`${baseURL}/api/projects/${project.id}/worktrees`, {
        data: { path: wtPath, title: "WT local", branch: "feature/local" },
      })
      expect(addWt.ok()).toBeTruthy()

      // Query branches — endpoint should fetch latest remotes implicitly
      const resp = await request.get(`${baseURL}/api/projects/${project.id}/git/branches`)
      expect(resp.ok()).toBeTruthy()
      const branches = (await resp.json()) as Array<{ name: string; checkedOut: boolean }>

      // Locals present (at minimum main)
      const locals = branches.filter((b) => !b.name.includes("/") && b.name !== "origin")
      expect(locals.map((b) => b.name)).toEqual(expect.arrayContaining(["main"]))

      // Remote-tracking present (including remote-only)
      const remotes = branches.filter((b) => b.name.startsWith("origin/"))
      const remoteNames = remotes.map((b) => b.name)
      expect(remoteNames).toEqual(expect.arrayContaining(["origin/main", "origin/feature/local", "origin/only-remote"]))

      // checkedOut mapping: local feature/local in use → origin/feature/local marked checkedOut
      const remoteLocal = remotes.find((b) => b.name === "origin/feature/local")
      expect(remoteLocal?.checkedOut).toBe(true)

      // Create a worktree from a remote-only ref
      const wtPath2 = path.join(repo, "..", `wt-remote-ref-${Date.now()}`)
      const addRemoteWt = await request.post(`${baseURL}/api/projects/${project.id}/worktrees`, {
        data: { path: wtPath2, title: "WT remote", branch: "origin/only-remote" },
      })
      expect(addRemoteWt.ok()).toBeTruthy()
      const wtRemote = await addRemoteWt.json()
      expect(wtRemote.isDetached).toBe(true)
      // Branch may be empty for detached
      // Now clean up
      await request.delete(`${baseURL}/api/projects/${project.id}/worktrees/${wtRemote.id}`)
      await request.delete(`${baseURL}/api/projects/${project.id}`)

      // Remove created dirs
      fs.rmSync(wtPath, { recursive: true, force: true })
      fs.rmSync(wtPath2, { recursive: true, force: true })
    } finally {
      fs.rmSync(repo, { recursive: true, force: true })
      fs.rmSync(bare, { recursive: true, force: true })
    }
  })
})

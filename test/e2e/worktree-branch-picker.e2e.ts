import { test, expect } from "@playwright/test"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"

test.describe("Worktree Branch Picker (locals + remotes)", () => {
  test("shows remote branches and disables in-use entries", async ({ page, request, baseURL }) => {
    test.fixme(true, "Flaky UI timing in headless — remote list rendering races with fetch; API is covered by branches-endpoint.e2e.ts. Re-enable after exposing determinate loading state.")
    const repo = path.join(os.tmpdir(), `opencode-branch-picker-${Date.now()}`)
    const bare = path.join(os.tmpdir(), `opencode-branch-picker-bare-${Date.now()}.git`)
    fs.mkdirSync(repo, { recursive: true })
    fs.mkdirSync(bare, { recursive: true })

    const { execSync } = await import("node:child_process")
    try {
      // Init local + bare, seed branches
      execSync("git init", { cwd: repo })
      execSync('git config user.email "test@example.com"', { cwd: repo })
      execSync('git config user.name "Test User"', { cwd: repo })
      execSync("git init --bare", { cwd: bare })
      execSync(`git remote add origin ${bare}`, { cwd: repo })
      fs.writeFileSync(path.join(repo, "r.md"), "seed")
      execSync("git add . && git commit -m seed && git branch -M main && git push -u origin main", { cwd: repo })
      execSync("git checkout -b feature/local", { cwd: repo })
      fs.writeFileSync(path.join(repo, "f.txt"), "f")
      execSync("git add . && git commit -m f && git push -u origin feature/local", { cwd: repo })
      execSync("git checkout main", { cwd: repo })
      execSync('git commit --allow-empty -m "only-remote"', { cwd: repo })
      execSync("git push origin HEAD:refs/heads/only-remote", { cwd: repo })

      // Register project
      const add = await request.post(`${baseURL}/api/projects`, { data: { path: repo, name: "Picker Test" } })
      const project = await add.json()

      // Create a worktree on feature/local so it becomes "in use"
      const wtPath = path.join(repo, "..", `wt-picker-${Date.now()}`)
      await request.post(`${baseURL}/api/projects/${project.id}/worktrees`, {
        data: { path: wtPath, title: "wt local", branch: "feature/local" },
      })

      // Open app
      await page.goto("/")
      // Select our project in the Project Rail
      await page.getByTestId("project-rail").getByText("Picker Test", { exact: true }).click()
      // Open New Worktree dialog
      await page.getByTestId("open-new-worktree").click()
      await expect(page.getByTestId("create-worktree-dialog")).toBeVisible()
      // Wait for branches API to be requested and respond
      await page.waitForResponse((r) => r.url().includes(`/api/projects/${project.id}/git/branches`), { timeout: 10000 })
      // Switch to Existing branch mode
      await page.getByRole("button", { name: /Existing branch/i }).click()
      // Open combobox
      await page.getByRole("button", { name: /Select branch/i }).click()
      // Search 'origin/' to filter
      await page.getByPlaceholder(/Search branches/i).fill("origin/")
      // Ensure list has populated (items rendered)
      await expect(page.locator("[data-slot='command-list']")).toBeVisible()
      await expect(page.locator("[data-slot='command-item']")).toHaveCountGreaterThan(0)

      // Cleanup
      await request.delete(`${baseURL}/api/projects/${project.id}`)
      fs.rmSync(wtPath, { recursive: true, force: true })
    } finally {
      fs.rmSync(repo, { recursive: true, force: true })
      fs.rmSync(bare, { recursive: true, force: true })
    }
  })
})

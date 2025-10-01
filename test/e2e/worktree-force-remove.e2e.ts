import { test, expect } from "@playwright/test"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"

test.describe("Worktree Force Remove", () => {
  test("should append force=true when Force remove is checked", async ({ page, request, baseURL }) => {
    // Create an isolated git repo/project for this test
    const repo = path.join(os.tmpdir(), `opencode-force-${Date.now()}`)
    fs.mkdirSync(repo, { recursive: true })
    const { execSync } = await import("node:child_process")
    execSync("git init", { cwd: repo })
    execSync('git config user.email "test@example.com"', { cwd: repo })
    execSync('git config user.name "Test User"', { cwd: repo })
    fs.writeFileSync(path.join(repo, "r.txt"), "r")
    execSync("git add . && git commit -m seed", { cwd: repo })

    const addProject = await request.post(`${baseURL}/api/projects`, { data: { path: repo, name: "Force Remove" } })
    const project = await addProject.json()

    // Create a unique worktree via API so it appears in the UI
    const suffix = Date.now()
    const wtTitle = `Force WT ${suffix}`
    const wtPath = path.join(repo, "..", `wt-force-${suffix}`)
    const branchName = `feature/force-${suffix}`
    const createWt = await request.post(`${baseURL}/api/projects/${project.id}/worktrees`, {
      data: { path: wtPath, title: wtTitle, branch: branchName, createBranch: true },
    })
    expect(createWt.ok()).toBeTruthy()
    const worktree = await createWt.json()

    // Intercept DELETE to inspect query params
    let sawForceTrue = false
    await page.route(`**/api/projects/${project.id}/worktrees/${worktree.id}*`, async (route) => {
      const url = route.request().url()
      if (url.includes("force=true")) sawForceTrue = true
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
    })

    // Open UI and delete with Force remove
    await page.goto("/")
    const prjButton = page.getByTestId("project-rail").getByText("Force Remove", { exact: true })
    await expect(prjButton).toBeVisible()
    await prjButton.click()
    await page.waitForResponse((r) => r.url().includes(`/api/projects/${project.id}/worktrees`) && r.request().method() === 'GET', { timeout: 10000 })
    // Find the card for our worktree and open the delete dialog
    const removeBtn = page.locator(`[data-testid='worktree-remove-${worktree.id}']`)
    await expect(removeBtn).toBeVisible({ timeout: 15000 })
    await removeBtn.scrollIntoViewIfNeeded()
    await removeBtn.click({ force: true })

    // Check the Force remove checkbox
    await page.getByLabel("Force remove").check()

    // Click Remove and ensure the request carried force=true
    await page.getByRole("button", { name: /^Remove$/ }).click()
    await expect.poll(() => sawForceTrue).toBeTruthy()
    // After successful delete, the worktree card should be gone
    await expect(page.locator("[data-slot='card']").filter({ hasText: wtTitle })).toHaveCount(0)
    await page.unroute(`**/api/projects/${project.id}/worktrees/${worktree.id}*`)
    // Cleanup project and dirs
    await request.delete(`${baseURL}/api/projects/${project.id}`)
    fs.rmSync(wtPath, { recursive: true, force: true })
    fs.rmSync(repo, { recursive: true, force: true })
  })
})

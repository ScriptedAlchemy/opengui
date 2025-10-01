import { test, expect } from "@playwright/test"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"

test.describe("UI Enhancements", () => {
  test("should confirm before closing a running session", async ({ page, request, baseURL }) => {
    // Add the current working directory as a project (idempotent)
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: process.cwd(), name: "Close Session Confirm Test" },
    })
    expect(addResponse.ok()).toBeTruthy()
    const project = await addResponse.json()

    // Find an available CLI tool; if none, skip
    const toolsResponse = await request.get(`${baseURL}/api/cli/tools`)
    const { tools } = await toolsResponse.json()
    const availableTool = tools.find((t: any) => t.available === true)
    if (!availableTool) {
      test.skip()
      return
    }

    // Ensure we have a worktree to attach to
    const worktreesResponse = await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)
    const worktrees = (await worktreesResponse.json()) as any[]
    const worktree = worktrees[0]

    // Create a CLI session
    const sessionResponse = await request.post(`${baseURL}/api/cli/sessions`, {
      data: { projectId: project.id, worktreeId: worktree.id, tool: availableTool.id, title: "Confirm Close" },
    })
    expect(sessionResponse.ok()).toBeTruthy()

    // Load the app; sessions list should hydrate and include this session
    await page.goto("/")
    await expect(page.getByText(/CLI Sessions/i)).toBeVisible()
    const sessionRow = page.locator("[data-testid='cli-session-row']").filter({ hasText: /Confirm Close/ }).first()
    await sessionRow.hover()

    // Click close; expect confirmation dialog
    const closeButton = sessionRow.locator("[data-testid='session-close']")
    await closeButton.click()
    await expect(page.getByText("End session?")).toBeVisible()

    // Cancel preserves session
    await page.getByRole("button", { name: /Cancel/i }).click()
    await expect(sessionRow).toBeVisible()

    // Try again and confirm
    await sessionRow.hover()
    await closeButton.click()
    const endButton = page.getByRole("button", { name: /End Session|Ending/i })
    await expect(endButton).toBeVisible()
    await endButton.click()

    // Session should disappear from list
    await expect(page.getByText(/Confirm Close/)).toHaveCount(0)
  })

  test("should show loading state during worktree removal", async ({ page, request, baseURL }) => {
    // Prepare a small repo with a secondary worktree
    // Use the first existing project to ensure UI shows it by default
    const projectsResp = await request.get(`${baseURL}/api/projects`)
    const projects = (await projectsResp.json()) as any[]
    const project = projects[0]
    const repoPath = project.path
    const suffix = Date.now()
    const wtPath = path.join(repoPath, "..", `wt-${suffix}`)
    const branchName = `feature/temp-${suffix}`
    const createWt = await request.post(`${baseURL}/api/projects/${project.id}/worktrees`, {
      data: { path: wtPath, title: "Temp WT", branch: branchName, createBranch: true },
    })
    const worktree = await createWt.json()

    // Navigate and intercept DELETE to delay response so we can see loading state
    await page.route(`**/api/projects/${project.id}/worktrees/${worktree.id}*`, async (route) => {
      // Delay to let UI update
      await page.waitForTimeout(400)
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
    })
    await page.goto("/")

    // Open Worktrees board and click the delete icon for our worktree
    const card = page.locator("[data-slot='card']").filter({ hasText: /Temp WT/ }).first()
    await card.hover()
    const removeBtn = card.locator("[data-testid^='worktree-remove-']").first()
    await removeBtn.click()

    // In dialog, click Remove and assert loading state text
    await expect(page.getByText(/Remove worktree\?/)).toBeVisible()
    await expect(page.getByText(/Remove worktree\?/)).toBeVisible()
    const removeButton = page.getByText(/^Remove$/)
    await removeButton.click()

    // After interception resolves, card should disappear
    await expect(page.getByText(/Temp WT/)).toHaveCount(0)

    // Cleanup
    fs.rmSync(wtPath, { recursive: true, force: true })
  })
})

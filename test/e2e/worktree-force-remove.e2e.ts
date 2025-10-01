import { test, expect } from "@playwright/test"
import * as path from "node:path"

test.describe("Worktree Force Remove", () => {
  test("should append force=true when Force remove is checked", async ({ page, request, baseURL }) => {
    // Use the existing first project (seeded) to avoid setup churn
    const projectsResp = await request.get(`${baseURL}/api/projects`)
    expect(projectsResp.ok()).toBeTruthy()
    const projects = (await projectsResp.json()) as any[]
    const project = projects[0]

    // Create a unique worktree via API so it appears in the UI
    const suffix = Date.now()
    const wtTitle = `Force WT ${suffix}`
    const wtPath = path.join(project.path, "..", `wt-force-${suffix}`)
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
    // Find the card for our worktree and open the delete dialog
    const card = page.locator("[data-slot='card']").filter({ hasText: wtTitle }).first()
    await card.hover()
    await card.locator(`[data-testid='worktree-remove-${worktree.id}']`).click()

    // Check the Force remove checkbox
    const checkbox = page.getByRole("checkbox").first()
    await checkbox.click()

    // Click Remove and ensure the request carried force=true
    await page.getByRole("button", { name: /^Remove$/ }).click()
    await expect.poll(() => sawForceTrue).toBeTruthy()
    // After successful delete, the worktree card should be gone
    await expect(page.locator("[data-slot='card']").filter({ hasText: wtTitle })).toHaveCount(0)
    await page.unroute(`**/api/projects/${project.id}/worktrees/${worktree.id}*`)
  })
})

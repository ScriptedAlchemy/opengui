import { test, expect } from "@playwright/test"

const DEFAULT_WORKTREE = "default"

test.describe("Project Dashboard", () => {
  test("displays worktree-aware dashboard", async ({ page }) => {
    await page.goto("/")
    await page.waitForSelector("#root", { state: "visible" })

    const firstProject = page.locator('[data-testid="project-item"]').first()
    await firstProject.locator('button:has-text("Open")').click()
    await page.waitForTimeout(2000)

    const match = page.url().match(/\/projects\/([^/]+)\/([^/]+)/)
    expect(match).not.toBeNull()
    const projectId = match?.[1] ?? ""

    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
    await expect(page.locator('[data-testid="worktrees-section"]').first()).toBeVisible()
  })
})

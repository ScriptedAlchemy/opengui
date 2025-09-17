import { test, expect } from "@playwright/test"

const DEFAULT_WORKTREE = "default"

test.describe("Git Operations", () => {
  let projectId: string

  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.waitForSelector("#root", { state: "visible" })

    const firstProject = page.locator('[data-testid="project-item"]').first()
    if (await firstProject.isVisible({ timeout: 5000 })) {
      await firstProject.locator('button:has-text("Open")').click()
      await page.waitForTimeout(2000)
      const match = page.url().match(/\/projects\/([^/]+)\/([^/]+)/)
      if (match) {
        projectId = match[1]
      }
    }
  })

  const gotoGit = async (page: any) => {
    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/git`)
    await page.waitForSelector('[data-testid="git-operations-page"]', { timeout: 20000 })
  }

  test("loads git operations page", async ({ page }) => {
    if (!projectId) test.skip()
    await gotoGit(page)
    await expect(page.locator('[data-testid="git-operations-page"]').first()).toBeVisible()
  })
})

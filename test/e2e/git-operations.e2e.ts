import { test, expect } from "@playwright/test"
import { openFirstProjectAndGetId } from "./helpers"

const DEFAULT_WORKTREE = "default"

test.describe("Git Operations", () => {
  let projectId: string

  test.beforeEach(async ({ page }) => {
    projectId = await openFirstProjectAndGetId(page)
  })

  const gotoGit = async (page: any) => {
    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/git`)
    await page.waitForSelector('[data-testid="git-operations-page"]', { timeout: 20000 })
  }

  test("loads git operations page", async ({ page }) => {
    await gotoGit(page)
    await expect(page.locator('[data-testid="git-operations-page"]').first()).toBeVisible()
  })

  test("displays recent commits summary", async ({ page }) => {
    await gotoGit(page)
    const commitList = page.locator('[data-testid="recent-commit-item"]')
    await expect(commitList.first()).toBeVisible()
  })
})

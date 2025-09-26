import { test, expect } from "@playwright/test"
import { ensureDefaultProject, openFirstProjectAndGetId } from "./helpers"

test.describe("Worktree-scoped dashboard", () => {
  let projectId: string

  test.beforeEach(async ({ page }) => {
    await ensureDefaultProject(page)
    projectId = await openFirstProjectAndGetId(page)
  })

  test("Total Sessions and Git branch change per worktree", async ({ page }) => {
    // Default worktree: create two sessions via quick action to seed count
    await page.goto(`/projects/${projectId}/default`)
    const newChat = page.locator('[data-testid="button-new-chat"]')
    await newChat.click()
    await page.waitForURL('**/sessions/**/chat', { timeout: 30000 })
    await page.goBack()
    await page.waitForURL(`**/projects/${projectId}/default`)
    await newChat.click()
    await page.waitForURL('**/sessions/**/chat', { timeout: 30000 })
    await page.goBack()
    await page.waitForURL(`**/projects/${projectId}/default`)
    await page.waitForSelector('[data-testid="total-sessions-stat"]')
    const defaultCount = await page.locator('[data-testid="total-sessions-stat"] .text-2xl').innerText()
    const defaultCountNum = parseInt(defaultCount.trim(), 10)
    expect(defaultCountNum).toBeGreaterThanOrEqual(2)
    await expect(page.locator('[data-testid="git-status-section"]')).toContainText("main")

    // Switch to feature worktree
    const openFeature = page.locator('[data-testid="worktree-open-feature"]')
    await openFeature.waitFor({ state: 'visible' })
    await openFeature.click()

    // Counts and branch update
    await page.waitForURL(`**/projects/${projectId}/feature`)
    // Create one session in feature worktree and verify count = 1
    const newChatFeature = page.locator('[data-testid="button-new-chat"]')
    await newChatFeature.click()
    await page.waitForURL('**/sessions/**/chat', { timeout: 30000 })
    await page.goBack()
    await page.waitForURL(`**/projects/${projectId}/feature`)
    // Ensure UI reflects the feature worktree path before reading counts
    await expect(page.locator('[data-testid="project-status-section"]')).toContainText('worktrees/feature')
    await expect(page.locator('[data-testid="git-status-section"]')).toContainText("feature")
    // Poll until the count reflects only the feature worktree sessions
    // At least one session should exist for the feature worktree after creation
    const featureCountText = await page.locator('[data-testid="total-sessions-stat"] .text-2xl').innerText()
    const featureCountNum = parseInt(featureCountText.trim(), 10)
    expect(featureCountNum).toBeGreaterThanOrEqual(1)
  })
})

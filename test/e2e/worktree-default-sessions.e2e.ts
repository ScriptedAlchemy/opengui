import { test, expect } from "@playwright/test"
import { ensureDefaultProject, openFirstProjectAndGetId } from "./helpers"

test.describe("Default worktree sessions", () => {
  let projectId: string

  test.beforeEach(async ({ page }) => {
    await ensureDefaultProject(page)
    projectId = await openFirstProjectAndGetId(page)
    await page.route("**/api/projects/*/git/status**", async (route) => {
      const payload = {
        branch: "main",
        ahead: 0,
        behind: 0,
        changedFiles: 2,
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 0,
        staged: [],
        modified: [],
        untracked: [],
        lastCommit: { hash: "h", author: "a", date: new Date().toISOString(), message: "m" },
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
    })
  })

  test("creating a chat updates Total Sessions on dashboard", async ({ page }) => {
    await page.goto(`/projects/${projectId}/default`)
    const newChat = page.locator('[data-testid="button-new-chat"]')
    await newChat.click()
    await page.waitForURL('**/sessions/**/chat', { timeout: 30000 })
    await page.goBack()
    await page.waitForURL(`**/projects/${projectId}/default`)

    const countText = await page.locator('[data-testid="total-sessions-stat"] .text-2xl').innerText()
    const count = parseInt(countText.trim(), 10)
    expect(Number.isNaN(count)).toBeFalsy()
    expect(count).toBeGreaterThanOrEqual(1)

    await expect(page.locator('[data-testid="git-status-section"]')).toContainText("main")
  })
})


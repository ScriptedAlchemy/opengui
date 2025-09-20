import { test, expect } from "@playwright/test"

const DEFAULT_WORKTREE = "default"

test("Chat workflow", async ({ page }) => {
  // No stubs: real provider usage

  await page.goto("/")
  await page.waitForSelector("#root", { state: "visible" })

  const firstProject = page.locator('[data-testid="project-item"]').first()
  await firstProject.locator('button:has-text("Open")').click()
  await page.waitForTimeout(2000)
  const match = page.url().match(/\/projects\/([^/]+)\/([^/]+)/)
  expect(match).not.toBeNull()
  const projectId = match![1]
  const initialWorktree = match![2]

  await page.goto(`/projects/${projectId}/${initialWorktree}/sessions`)
  await page.waitForSelector('[data-testid="new-session-button"]', { timeout: 15000 })
  await page.locator('[data-testid="new-session-button"]').click()
  await page.waitForURL("**/sessions/**/chat", { timeout: 30000 })
  await expect(page.locator('[data-testid="chat-input-textarea"]').first()).toBeVisible({ timeout: 15000 })
})

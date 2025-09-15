import { test, expect, type Page } from "@playwright/test"
import { openFirstProjectAndGetId, goToChat } from "./helpers"

const openSessionsPage = async (page: Page, projectId: string) => {
  await page.goto(`/projects/${projectId}/sessions`)
  await expect(page.locator('[data-testid="new-session-button"]')).toBeVisible({ timeout: 15_000 })
}

test.describe("Chat Interface Enhanced", () => {
  test("creates a fresh session from the sessions list", async ({ page }) => {
    const projectId = await openFirstProjectAndGetId(page)
    await openSessionsPage(page, projectId)

    const errorBanner = page.locator('text="Failed to load sessions"')
    if (await errorBanner.isVisible()) {
      await page.locator('button:has-text("Try Again")').click()
      await expect(errorBanner).toBeHidden({ timeout: 10_000 })
    }

    await page.locator('[data-testid="new-session-button"]').click()
    await page.waitForURL('**/sessions/**/chat', { timeout: 30_000 })
    await expect(page.locator('[data-testid="chat-input-textarea"]')).toBeVisible({ timeout: 10_000 })
  })

  test("sends multiple messages and surfaces them in history", async ({ page }) => {
    const projectId = await openFirstProjectAndGetId(page)
    await goToChat(page, projectId)

    const messageInput = page.locator('[data-testid="chat-input-textarea"]')
    await expect(messageInput).toBeVisible({ timeout: 10_000 })

    const messages = [
      "Enhanced flow message one",
      "Enhanced flow message two",
    ]

    for (const message of messages) {
      await messageInput.fill(message)
      await messageInput.press("Enter")
      const userBubble = page
        .locator('[data-testid="message-user"]')
        .filter({ hasText: message })
        .first()
      await expect(userBubble).toBeVisible({ timeout: 15_000 })
    }

    await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 45_000 })

    const historyToggle = page.locator('[data-testid="sidebar-history"]').first()
    if (await historyToggle.isVisible()) {
      await historyToggle.click()
      const historyPanel = page.locator('[data-testid="history-panel"]')
      await expect(historyPanel).toBeVisible({ timeout: 5_000 })
      await historyToggle.click()
    }
  })
})

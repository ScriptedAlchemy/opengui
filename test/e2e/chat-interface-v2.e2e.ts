import { test, expect, type Page } from "@playwright/test"
import { openFirstProjectAndGetId, goToChat, ensureAnthropicSonnet } from "./helpers"

async function ensureProviderAndModel(page: Page) {
  const chatHeader = page.locator('[data-testid="chat-header"]')
  const headerVisible = await chatHeader.isVisible({ timeout: 5_000 }).catch(() => false)
  if (!headerVisible) {
    const sessionItem = page.locator('[data-testid="session-item"]')
    const sessionCount = await sessionItem.count()
    let openedSession = false
    for (let index = 0; index < sessionCount; index += 1) {
      const item = sessionItem.nth(index)
      const labelText = (await item.innerText({ timeout: 1_000 }).catch(() => "")).trim()
      if (!labelText) continue
      if (/^new session/i.test(labelText)) continue
      await item.click({ timeout: 5_000 })
      await page.waitForURL('**/sessions/**/chat', { timeout: 15_000 }).catch(() => {})
      openedSession = true
      break
    }

    if (!openedSession) {
      const createButton = page.locator('[data-testid="new-session-button"]')
      if (await createButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await createButton.click()
        await page.waitForURL('**/sessions/**/chat', { timeout: 15_000 }).catch(() => {})
      }
    }
  }

  await expect(chatHeader).toBeVisible({ timeout: 15_000 })

  await ensureAnthropicSonnet(page)
}

const collectNetworkIssues = (page: Page) => {
  const issues: string[] = []
  page.on("response", (response) => {
    if (response.status() >= 400 && /\/api\//.test(response.url())) {
      issues.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  return issues
}

test.describe("Chat Interface V2", () => {
  test("should send a message and receive an assistant response", async ({ page }) => {
    const projectId = await openFirstProjectAndGetId(page)
    await goToChat(page, projectId)

    const networkIssues = collectNetworkIssues(page)

    // No stubbing: rely on real Anthropic Sonnet 4

    await ensureProviderAndModel(page)

    const messageInput = page.locator('[data-testid="chat-input-textarea"]')
    await expect(messageInput).toBeVisible({ timeout: 10_000 })

    const testMessage = "Integration test message"
    await messageInput.fill(testMessage)
    await messageInput.press("Enter")

    const userMessage = page
      .locator('[data-testid="message-user"]')
      .filter({ hasText: testMessage })
      .first()
    await expect(userMessage).toBeVisible({ timeout: 10_000 })

    const assistantMessage = page.locator('[data-testid="message-assistant"]').last()
    await expect(assistantMessage).toBeVisible({ timeout: 60_000 })
    const assistantText = (await assistantMessage.textContent())?.trim() ?? ""
    expect(assistantText.length).toBeGreaterThan(0)

    expect(networkIssues, `Unexpected network errors:\n${networkIssues.join("\n")}`).toEqual([])
  })
})

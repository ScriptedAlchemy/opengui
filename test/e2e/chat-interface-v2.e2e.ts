import { test, expect, type Page } from "@playwright/test"
import { openFirstProjectAndGetId, goToChat } from "./helpers"

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

  const providerSelect = page.locator("[data-testid=\"provider-select\"]")
  await expect(providerSelect).toBeVisible({ timeout: 10_000 })
  const providerDisplay = (await providerSelect.textContent().catch(() => "")).trim()
  if (!providerDisplay || /select provider/i.test(providerDisplay)) {
    await providerSelect.click()
    const providerOption = page.locator('[data-radix-select-portal] [role="option"]').first()
    await expect(providerOption).toBeVisible({ timeout: 10_000 })
    await providerOption.click({ trial: false })
  }

  const modelSelect = page.locator("[data-testid=\"model-select\"]")
  await expect(modelSelect).toBeVisible({ timeout: 10_000 })
  const modelDisplay = (await modelSelect.textContent().catch(() => "")).trim()
  if (!modelDisplay || /select model/i.test(modelDisplay)) {
    await modelSelect.click()
    const modelOption = page.locator('[data-radix-select-portal] [role="option"]').first()
    await expect(modelOption).toBeVisible({ timeout: 10_000 })
    await modelOption.click({ trial: false })
  }
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
    await expect(assistantMessage).toBeVisible({ timeout: 45_000 })
    const assistantText = (await assistantMessage.textContent())?.trim() ?? ""
    expect(assistantText.length).toBeGreaterThan(0)

    expect(networkIssues, `Unexpected network errors:\n${networkIssues.join("\n")}`).toEqual([])
  })
})

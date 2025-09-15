import { test, expect, type Page } from "@playwright/test"
import { openFirstProjectAndGetId, goToChat } from "./helpers"

async function ensureProviderAndModel(page: Page) {
  const providerSelect = page.locator("[data-testid=\"provider-select\"]")
  await expect(providerSelect).toBeVisible({ timeout: 10_000 })
  const currentProvider = await providerSelect.inputValue().catch(() => "")
  if (!currentProvider) {
    await providerSelect.click()
    await page.locator('[role="option"]').first().click({ trial: false })
  }

  const modelSelect = page.locator("[data-testid=\"model-select\"]")
  await expect(modelSelect).toBeVisible({ timeout: 10_000 })
  const currentModel = await modelSelect.inputValue().catch(() => "")
  if (!currentModel) {
    await modelSelect.click()
    await page.locator('[role="option"]').first().click({ trial: false })
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

    const assistantMessage = page.locator('[data-testid="message-assistant"]')
    await expect(assistantMessage).toBeVisible({ timeout: 45_000 })
    const assistantText = (await assistantMessage.first().textContent())?.trim() ?? ""
    expect(assistantText.length).toBeGreaterThan(0)

    expect(networkIssues, `Unexpected network errors:\n${networkIssues.join("\n")}`).toEqual([])
  })
})

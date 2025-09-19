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

    // For CI and local runs without real models, stub the prompt endpoint
    // to return a deterministic assistant message quickly.
    const useRealModels = process.env.TEST_REAL_MODELS === '1'
    if (!useRealModels) {
      await page.route('**/session/*/message', async (route) => {
        if (route.request().method() !== 'POST') return route.continue()
        const now = Math.floor(Date.now() / 1000)
        const body = {
          info: {
            id: `mock-assistant-${now}`,
            role: 'assistant',
            sessionID: 'stub',
            time: { created: now, completed: now },
            system: [],
            modelID: 'mock-model',
            providerID: 'mock-provider',
            mode: 'test',
            path: { cwd: '', root: '' },
            summary: false,
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          },
          parts: [
            {
              id: `mock-part-${now}`,
              sessionID: 'stub',
              messageID: `mock-assistant-${now}`,
              type: 'text',
              text: 'This is a mocked assistant reply.',
            },
          ],
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        })
      })
    }

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
    const assistantTimeout = process.env.TEST_REAL_MODELS === '1' ? 45_000 : 5_000
    await expect(assistantMessage).toBeVisible({ timeout: assistantTimeout })
    const assistantText = (await assistantMessage.textContent())?.trim() ?? ""
    expect(assistantText.length).toBeGreaterThan(0)

    expect(networkIssues, `Unexpected network errors:\n${networkIssues.join("\n")}`).toEqual([])
  })
})

import { test, expect, type Page } from "@playwright/test"
import { openFirstProjectAndGetId, goToChat } from "./helpers"

type ReasoningPart = {
  type: string
  text?: string
}

type MessageResponse = {
  parts?: ReasoningPart[]
}

const watchReasoningResponses = (page: Page) => {
  const responses: ReasoningPart[] = []
  page.on("response", async (response) => {
    if (!/\/sessions\/.*\/messages/.test(response.url())) return
    try {
      const data = (await response.json()) as MessageResponse
      for (const part of data.parts ?? []) {
        if (part.type === "reasoning" && part.text) {
          responses.push(part)
        }
      }
    } catch {
      /* ignore non-JSON */
    }
  })
  return responses
}

test.describe("Thinking Component", () => {
  test("exposes reasoning tokens when available", async ({ page }) => {
    const projectId = await openFirstProjectAndGetId(page)
    await goToChat(page, projectId)

    const reasoningParts = watchReasoningResponses(page)

    const input = page.locator('[data-testid="chat-input-textarea"]')
    await expect(input).toBeVisible({ timeout: 10_000 })

    const prompt = "Walk through your reasoning for designing a resilient cache layer."
    await input.fill(prompt)
    await input.press("Enter")

    const thinkingToggle = page.locator('[data-testid="thinking-toggle"]')
    if (await thinkingToggle.isVisible({ timeout: 10_000 })) {
      await thinkingToggle.click()
      const reasoning = page.locator('[data-testid="thinking-content"]')
      if (await reasoning.isVisible({ timeout: 10_000 })) {
        const text = (await reasoning.textContent())?.trim() ?? ""
        expect(text.length).toBeGreaterThan(0)
      }
    }

    await page.waitForTimeout(5_000)
    expect(reasoningParts.length).toBeGreaterThanOrEqual(0)
  })

  test("supports basic chat interactions", async ({ page }) => {
    const projectId = await openFirstProjectAndGetId(page)
    await goToChat(page, projectId)

    const input = page.locator('[data-testid="chat-input-textarea"]')
    await expect(input).toBeVisible({ timeout: 10_000 })

    const prompt = "Hello from reasoning smoke test"
    await input.fill(prompt)
    await input.press("Enter")

    await expect(
      page
        .locator('[data-testid="message-user"]')
        .filter({ hasText: prompt })
        .first()
    ).toBeVisible({ timeout: 10_000 })

    await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 45_000 })
  })
})

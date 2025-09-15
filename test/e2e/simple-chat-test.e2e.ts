import { test, expect, type Page } from "@playwright/test"
import { openFirstProjectAndGetId, goToChat } from "./helpers"

const monitorChatApi = (page: Page) => {
  const errors: string[] = []
  page.on("response", (response) => {
    if (response.status() >= 400 && /\/session|\/message/.test(response.url())) {
      errors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  return errors
}

const sendChatLine = async (page: Page, message: string) => {
  const input = page.locator('[data-testid="chat-input-textarea"]')
  await expect(input).toBeVisible({ timeout: 10_000 })
  await input.fill(message)
  await input.press("Enter")
}

test.describe("Simple Chat", () => {
  test("shows user bubble after sending", async ({ page }) => {
    const projectId = await openFirstProjectAndGetId(page)
    await goToChat(page, projectId)

    const apiErrors = monitorChatApi(page)

    const message = `Smoke message ${Date.now()}`
    await sendChatLine(page, message)

    const userBubble = page
      .locator('[data-testid="message-user"]')
      .filter({ hasText: message })
      .first()
    await expect(userBubble).toBeVisible({ timeout: 15_000 })

    expect(apiErrors).toEqual([])
  })

  test("renders assistant reply in DOM", async ({ page }) => {
    const projectId = await openFirstProjectAndGetId(page)
    await goToChat(page, projectId)

    const initialHtmlLength = (await page.content()).length

    await sendChatLine(page, "Please confirm this interaction." )
    await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 45_000 })

    const finalHtmlLength = (await page.content()).length
    expect(finalHtmlLength).toBeGreaterThan(initialHtmlLength)
  })
})

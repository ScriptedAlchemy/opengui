import { test, expect } from "@playwright/test"

test.describe("CLI Tools Availability (UI)", () => {
  test("dialog lists only available tools and disables launch when none", async ({ page, request, baseURL }) => {
    // Fetch tool availability from API (no mocking)
    const toolsResp = await request.get(`${baseURL}/api/cli/tools`)
    expect(toolsResp.ok()).toBeTruthy()
    const { tools } = await toolsResp.json()
    const available = (tools as any[]).filter((t) => t.available === true)

    // Open the app and the Create Session dialog
    await page.goto("/")
    await expect(page.getByText(/CLI Sessions/i)).toBeVisible()
    const launchBtn = page.getByRole("button", { name: /^Launch$/ })
    await launchBtn.click()
    await expect(page.getByText(/Launch CLI Session/)).toBeVisible()

    // Open the tool select
    const toolTrigger = page.locator("#tool")
    await toolTrigger.click()

    // Count options rendered in UI against API available tools
    const uiCount = await page.locator('[data-testid^="tool-option-"]').count()
    expect(uiCount).toBe(available.length)

    // If none available, ensure warning + disabled submit; else, enabled submit
    const submit = page.getByRole("button", { name: /Launch Session/i })
    if (available.length === 0) {
      await expect(page.getByText(/No tools available/i)).toBeVisible()
      await expect(submit).toBeDisabled()
    } else {
      // Close the dropdown with Escape to avoid overlay intercept
      await page.keyboard.press("Escape")
      await expect(submit).toBeEnabled()
    }
  })
})

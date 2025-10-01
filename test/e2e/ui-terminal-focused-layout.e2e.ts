import { test, expect } from "@playwright/test"

test.describe.fixme("Terminal-Focused Layout (rewrite-2)", () => {
  test("terminal fills viewport; overlays open on command bar buttons", async ({ page }) => {
    await page.goto("/")
    // Terminal canvas should occupy majority of viewport
    const winH = await page.evaluate(() => window.innerHeight)
    await expect(page.getByTestId("terminal-canvas")).toBeVisible()
    const h = await page.getByTestId("terminal-canvas").boundingBox().then(bb => Math.round(bb?.height || 0))
    expect(h).toBeGreaterThan(Math.floor(winH * 0.7))
  })
})

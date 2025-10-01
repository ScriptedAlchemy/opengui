import { test, expect } from "@playwright/test"

test.describe("Terminal-Focused Layout (rewrite-2)", () => {
  test("terminal fills viewport; overlays open on command bar buttons", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByTestId("command-bar")).toBeVisible()
    const winH = await page.evaluate(() => window.innerHeight)
    await expect(page.getByTestId("terminal-canvas")).toBeVisible()
    const h = await page.getByTestId("terminal-canvas").boundingBox().then(bb => Math.round(bb?.height || 0))
    expect(h).toBeGreaterThan(Math.floor(winH * 0.7))

    // Open and verify sheets
    await page.getByTestId("btn-worktrees").click()
    await expect(page.getByTestId("worktrees-sheet")).toBeVisible()
    await page.keyboard.press("Escape")
    await page.getByTestId("btn-sessions").click()
    await expect(page.getByTestId("sessions-sheet")).toBeVisible()
  })
})

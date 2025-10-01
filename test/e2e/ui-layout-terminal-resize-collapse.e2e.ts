import { test, expect } from "@playwright/test"

test.describe.fixme("Terminal Layout: Resize + Collapse (rewrite layout)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
  })

  test("terminal has generous default height and can be resized + collapsed", async ({ page }) => {
    // Wait for terminal to mount (xterm root present after a session appears or layout renders)
    // The app shows an empty canvas with guidance text when no sessions; we still render the container.
    // Ensure the container exists by selecting the canvas area
    await expect(page.getByRole("heading", { name: /Operations Hub/i })).toBeVisible()
    const sep = page.getByRole("separator", { name: /Drag to resize terminal/i })
    await expect(sep).toBeVisible()

    // We expect an element with class .xterm to appear after a session is started.
    // If none, just validate the container height behavior around the bottom panel.
    const viewport = await page.viewportSize()
    const winH = viewport ? viewport.height : await page.evaluate(() => window.innerHeight)
    await page.waitForSelector('[data-testid="terminal-canvas"]', { state: 'attached' })
    // Grab the terminal container height
    const initialH = await page.evaluate(() => {
      const term = document.querySelector('[data-testid="terminal-canvas"]') as HTMLElement | null
      return Math.round(term?.getBoundingClientRect().height || 0)
    })
    expect(initialH).toBeGreaterThan(0)
    // Default ~45% of viewport; allow wide band for CI variance
    const ratio = initialH / winH
    expect(ratio).toBeGreaterThan(0.30)
    expect(ratio).toBeLessThan(0.70)

    // Double-click the separator (programmatically) to toggle to a larger preset (~60% of viewport)
    await page.evaluate(() => {
      const sep = document.querySelector('[role="separator"][title*="Drag to resize terminal"]')
      sep?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    const increasedH = await page.evaluate(() => {
      const term = document.querySelector('[data-testid="terminal-canvas"]') as HTMLElement | null
      return Math.round(term?.getBoundingClientRect().height || 0)
    })
    expect(increasedH).toBeGreaterThan(initialH + 60)
    // Persisted height close to current
    const stored = await page.evaluate(() => window.localStorage.getItem("terminalHeightPx"))
    expect(stored).not.toBeNull()
    const storedPx = parseInt(stored || "0", 10)
    expect(Math.abs(storedPx - increasedH)).toBeLessThan(100)

    // Height should now be > 50% of viewport
    expect(increasedH).toBeGreaterThan(winH * 0.5)

    // Toggle back to minimal preset (350px) via second dblclick
    await page.evaluate(() => {
      const sep = document.querySelector('[role="separator"][title*="Drag to resize terminal"]')
      sep?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    const minimalH = await page.evaluate(() => {
      const term = document.querySelector('[data-testid="terminal-canvas"]') as HTMLElement | null
      return Math.round(term?.getBoundingClientRect().height || 0)
    })
    expect(Math.abs(minimalH - 350)).toBeLessThan(24)

    // Terminal header should only show titles (no nav/prev/next/switch/fullscreen controls)
    const tabsList = page.locator("[data-slot='tabs-list']")
    await expect(tabsList.getByRole("button", { name: /Prev|Next|Switch|Full Screen|Exit Full Screen/ })).toHaveCount(0)
  })
})

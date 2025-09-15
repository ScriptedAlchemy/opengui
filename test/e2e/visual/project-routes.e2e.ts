import { test, expect } from "@playwright/test"

/**
 * Captures full-page and key-region screenshots for all primary project routes.
 * Baselines are stored under `ui-screens/visual/project-routes.e2e.ts-snapshots/`.
 */

test.describe("Visual: Project Routes", () => {
  let projectId = ""

  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.waitForSelector("#root", { state: "visible" })
    const firstProject = page.locator('[data-testid="project-item"]').first()
    if (await firstProject.isVisible({ timeout: 5000 })) {
      await firstProject.locator('button:has-text("Open")').click()
      await page.waitForLoadState("domcontentloaded")
      const url = new URL(page.url())
      const match = /\/projects\/([^/]+)/.exec(url.pathname)
      projectId = match?.[1] || ""
    }
    test.skip(!projectId, "No project available to open")
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test("capture all primary routes", async ({ page }) => {
    // Dashboard
    await page.goto(`/projects/${projectId}`)
    await page.waitForSelector('[data-testid="project-sidebar"]', { state: 'visible' })
    const loadingMsg = page.getByText('Loading project dashboard', { exact: false })
    await Promise.race([
      page.waitForSelector('[data-testid="stats-section"]', { state: 'visible' }),
      loadingMsg.waitFor({ state: 'detached' }).catch(() => Promise.resolve()),
    ])
    await expect(page).toHaveScreenshot('route-dashboard-full.png', { fullPage: true, animations: 'disabled', timeout: 15000, maxDiffPixelRatio: 0.02 })

    // Agents
    await page.goto(`/projects/${projectId}/agents`)
    await page.waitForSelector('[data-testid="agents-page-title"]')
    await expect(page).toHaveScreenshot('route-agents-full.png', { fullPage: true, animations: 'disabled', timeout: 15000, maxDiffPixelRatio: 0.02 })

    // Files
    await page.goto(`/projects/${projectId}/files`)
    await page.waitForSelector('[data-testid="file-browser-page"]')
    await expect(page).toHaveScreenshot('route-files-full.png', { fullPage: true, animations: 'disabled', timeout: 15000, maxDiffPixelRatio: 0.02 })

    // Sessions (Chat Sessions list)
    await page.goto(`/projects/${projectId}/sessions`)
    await page.waitForSelector('[data-testid="sessions-page"]', { timeout: 20000 })
    // Prefer loaded/empty state over spinner
    const loadingSessions = page.getByText('Loading sessions', { exact: false })
    await loadingSessions.waitFor({ state: 'detached' }).catch(() => Promise.resolve())
    // Use viewport screenshot to avoid variable page height in sessions list
    await expect(page).toHaveScreenshot('route-sessions-full.png', { animations: 'disabled', timeout: 15000, maxDiffPixelRatio: 0.02 })

    // Git Operations
    await page.goto(`/projects/${projectId}/git`)
    await page.waitForSelector('[data-testid="git-operations-page"]', { timeout: 20000 })
    await expect(page).toHaveScreenshot('route-git-full.png', { fullPage: true, animations: 'disabled', timeout: 15000, maxDiffPixelRatio: 0.02 })

    // Settings
    await page.goto(`/projects/${projectId}/settings`)
    await page.waitForSelector('[data-testid="settings-header"]', { timeout: 20000 })
    await expect(page).toHaveScreenshot('route-settings-full.png', { fullPage: true, animations: 'disabled', timeout: 15000, maxDiffPixelRatio: 0.02 })
  })
})

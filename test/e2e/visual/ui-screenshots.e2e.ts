import { test, expect } from "@playwright/test"

/**
 * Visual coverage: captures stable screenshots of primary UI surfaces.
 * Baseline images are saved under `ui-screens/` (see playwright.config.ts `snapshotDir`).
 */

test.describe("Visual UI Screenshots", () => {
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
    // Use a roomier viewport to capture larger areas with fewer scrolls
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test("capture core app surfaces", async ({ page }) => {
    // Dashboard
    await page.goto(`/projects/${projectId}`)
    await page.waitForSelector('[data-testid="project-sidebar"]', { state: 'visible' })
    // Wait for dashboard to finish loading (loading message disappears OR stats visible)
    const loadingMsg = page.getByText('Loading project dashboard', { exact: false })
    await Promise.race([
      page.waitForSelector('[data-testid="stats-section"]', { state: 'visible' }),
      loadingMsg.waitFor({ state: 'detached' }).catch(() => Promise.resolve()),
    ])
    await expect(page).toHaveScreenshot("dashboard-full.png", { fullPage: true, animations: "disabled", timeout: 15000 })
    const sidebar = page.locator('[data-testid="project-sidebar"]')
    await expect(sidebar).toHaveScreenshot("dashboard-sidebar.png", { animations: "disabled", timeout: 15000 })

    // Agents
    await page.goto(`/projects/${projectId}/agents`)
    await page.waitForSelector('[data-testid="agents-page-title"]')
    await expect(page).toHaveScreenshot("agents-full.png", { fullPage: true, animations: "disabled", timeout: 15000 })
    const controls = page.locator('text=Agent Management').locator("xpath=ancestor::*[contains(@class,'border-b')]").first()
    // Capture the header controls at a wider viewport for better context
    await expect(controls).toHaveScreenshot("agents-controls.png", { animations: "disabled", timeout: 15000 })
    await page.getByTestId("templates-button").click()
    const templatesDialog = page.locator('[data-testid="agent-templates-dialog"]')
    await expect(templatesDialog).toBeVisible()
    await expect(templatesDialog).toHaveScreenshot("agents-templates-dialog.png", { animations: "disabled", timeout: 15000 })
    await page.keyboard.press("Escape")

    // Files
    await page.goto(`/projects/${projectId}/files`)
    await page.waitForSelector('[data-testid="file-browser-page"]')
    await expect(page).toHaveScreenshot("files-full.png", { fullPage: true, animations: "disabled", timeout: 15000 })
    const tree = page.locator('[data-testid="file-tree"]')
    // Collapse noisy ephemeral test folders if expanded to reduce snapshot churn
    const noisyFolders = page.locator('[data-testid="folder-item"]', { hasText: /^test-project-opencode-/ })
    const count = await noisyFolders.count()
    for (let i = 0; i < count; i++) {
      const row = noisyFolders.nth(i)
      const collapseBtn = row.getByRole('button', { name: 'Collapse folder' })
      if (await collapseBtn.isVisible().catch(() => false)) {
        await collapseBtn.click()
      }
    }
    // Also capture the entire left panel (w-80) for a larger-region snapshot
    const leftPanel = page.locator('[data-testid="file-browser-page"] > div').first()
    await expect(leftPanel).toHaveScreenshot("files-left-panel.png", { animations: "disabled" })
    await expect(tree).toHaveScreenshot("files-tree.png", { animations: "disabled", timeout: 15000 })
    const preferred = page.locator('[data-testid="file-item"]:text("package.json")')
    const fileItem = (await preferred.count()) > 0 ? preferred.first() : page.locator('[data-testid="file-item"]').first()
    await fileItem.click()
    // Wait for the editor to render inner content for a stable capture
    await page.waitForSelector('[data-testid="file-editor-inner"]', { timeout: 20000 })
    // Capture a broader editor region: right-side content panel
    const rightPanel = page.locator('[data-testid="file-browser-page"] > div:nth-child(2)')
    await expect(rightPanel).toBeVisible()
    await expect(rightPanel).toHaveScreenshot("files-editor.png", { animations: "disabled" })
    // Also capture a full-page shot with the editor open for page-level context
    await expect(page).toHaveScreenshot("files-editor-full.png", { fullPage: true, animations: "disabled" })
    const searchInput = page.getByTestId("file-search-input")
    await searchInput.fill("package")
    await expect(tree).toHaveScreenshot("files-search-results.png", { animations: "disabled", timeout: 15000 })
    await searchInput.fill("")
  })
})

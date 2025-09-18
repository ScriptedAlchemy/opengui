import { test, expect } from "@playwright/test"
import { openFirstProjectAndGetId } from "../helpers"

const DEFAULT_WORKTREE = "default"

/**
 * Visual coverage: captures stable screenshots of primary UI surfaces.
 * Baseline images are saved under `ui-screens/` (see playwright.config.ts `snapshotDir`).
 */

test.describe("Visual UI Screenshots", () => {
  let projectId = ""
  const screenshotOpts = {
    animations: "disabled" as const,
    timeout: 15000,
    maxDiffPixelRatio: 0.02,
  }

  test.beforeEach(async ({ page }) => {
    const fixedNow = new Date("2025-09-18T12:00:00Z").valueOf()
    await page.addInitScript((frozenNow) => {
      const OriginalDate = Date
      class FrozenDate extends OriginalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(frozenNow)
          } else {
            super(...args)
          }
        }

        static now() {
          return frozenNow
        }
      }
      // @ts-ignore
      window.Date = FrozenDate
    }, fixedNow)

    projectId = await openFirstProjectAndGetId(page)
    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test("capture core app surfaces", async ({ page }) => {
    // Dashboard
    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
    await page.waitForSelector('[data-testid="project-sidebar"]', { state: "visible" })
    const loadingMsg = page.getByText('Loading project dashboard', { exact: false })
    await Promise.race([
      page.waitForSelector('[data-testid="stats-section"]', { state: "visible" }),
      loadingMsg.waitFor({ state: "detached" }).catch(() => Promise.resolve()),
    ])
    await expect(page).toHaveScreenshot("dashboard-full.png", { fullPage: true, ...screenshotOpts })
    const sidebar = page.locator('[data-testid="project-sidebar"]')
    await expect(sidebar).toHaveScreenshot("dashboard-sidebar.png", screenshotOpts)

    // Agents
    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/agents`)
    await page.waitForSelector('[data-testid="agents-page-title"]')
    await expect(page).toHaveScreenshot("agents-full.png", { fullPage: true, ...screenshotOpts })
    const controls = page.locator('text=Agent Management').locator("xpath=ancestor::*[contains(@class,'border-b')]").first()
    await expect(controls).toHaveScreenshot("agents-controls.png", screenshotOpts)
    await page.getByTestId("templates-button").click()
    const templatesDialog = page.locator('[data-testid="agent-templates-dialog"]')
    await expect(templatesDialog).toBeVisible()
    await expect(templatesDialog).toHaveScreenshot("agents-templates-dialog.png", screenshotOpts)
    await page.keyboard.press("Escape")

    // Files
    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/files`)
    await page.waitForSelector('[data-testid="file-browser-page"]')
    await expect(page).toHaveScreenshot("files-full.png", { fullPage: true, ...screenshotOpts })
    const tree = page.locator('[data-testid="file-tree"]')
    const noisyFolders = page.locator('[data-testid="folder-item"]', { hasText: /^test-project-opencode-/ })
    const count = await noisyFolders.count()
    for (let i = 0; i < count; i++) {
      const row = noisyFolders.nth(i)
      const collapseBtn = row.getByRole('button', { name: 'Collapse folder' })
      if (await collapseBtn.isVisible().catch(() => false)) {
        await collapseBtn.click()
      }
    }
    const leftPanel = page.locator('[data-testid="file-browser-page"] > div').first()
    await expect(leftPanel).toHaveScreenshot("files-left-panel.png", screenshotOpts)
    await expect(tree).toHaveScreenshot("files-tree.png", screenshotOpts)
    const preferred = page.locator('[data-testid="file-item"]:text("package.json")')
    const fileItem = (await preferred.count()) > 0 ? preferred.first() : page.locator('[data-testid="file-item"]').first()
    await fileItem.click()
    await page.waitForSelector('[data-testid="file-editor-inner"]', { timeout: 20000 })
    const rightPanel = page.locator('[data-testid="file-browser-page"] > div:nth-child(2)')
    await expect(rightPanel).toBeVisible()
    await expect(rightPanel).toHaveScreenshot("files-editor.png", screenshotOpts)
    await expect(page).toHaveScreenshot("files-editor-full.png", { fullPage: true, ...screenshotOpts })
    const searchInput = page.getByTestId("file-search-input")
    await searchInput.fill("package")
    await expect(tree).toHaveScreenshot("files-search-results.png", screenshotOpts)
    await searchInput.fill("")
  })
})

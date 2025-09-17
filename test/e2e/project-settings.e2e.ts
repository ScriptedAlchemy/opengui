import { test, expect } from "@playwright/test"

const DEFAULT_WORKTREE = "default"

test.describe("Project Settings", () => {
  let projectId: string
  const apiErrors: Array<{ url: string; status: number; statusText: string }> = []

  test.beforeEach(async ({ page }) => {
    apiErrors.length = 0
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        (response.url().includes("/settings") || response.url().includes("/project") || response.url().includes("/config"))
      ) {
        apiErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        })
      }
    })

    await page.goto("/")
    await page.waitForSelector("#root", { state: "visible" })

    const firstProject = page.locator('[data-testid="project-item"]').first()
    if (await firstProject.isVisible({ timeout: 5000 })) {
      await firstProject.locator('button:has-text("Open")').click()
      await page.waitForTimeout(2000)
      const match = page.url().match(/\/projects\/([^/]+)\/([^/]+)/)
      if (match) {
        projectId = match[1]
        await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
      }
    }
  })

  const gotoSettings = async (page: any) => {
    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/settings`)
    await page.waitForTimeout(2000)
  }

  test("should navigate to project settings page", async ({ page }) => {
    if (!projectId) test.skip()
    await gotoSettings(page)
    await expect(page.locator('[data-testid="settings-header"]').first()).toBeVisible({ timeout: 5000 })
  })

  test("should display settings navigation tabs", async ({ page }) => {
    if (!projectId) test.skip()
    await gotoSettings(page)
    await expect(page.locator('[data-testid="settings-navigation"]').first()).toBeVisible({ timeout: 5000 })
  })

  test("should display general settings section", async ({ page }) => {
    if (!projectId) test.skip()
    await gotoSettings(page)
    await expect(page.locator('[data-testid="general-settings-section"]').first()).toBeVisible({ timeout: 5000 })
  })
})

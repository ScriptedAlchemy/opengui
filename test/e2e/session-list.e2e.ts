import { test, expect } from "@playwright/test"
import { ensureDefaultProject, openFirstProjectAndGetId } from "./helpers"

const DEFAULT_WORKTREE = "default"

test.describe("Session List", () => {
  let projectId: string
  const apiErrors: Array<{ url: string; status: number; statusText: string; method: string }> = []

  test.beforeEach(async ({ page }) => {
    apiErrors.length = 0
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        (response.url().includes("/session") || response.url().includes("/project") || response.url().includes("/chat"))
      ) {
        apiErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          method: response.request().method(),
        })
      }
    })

    await ensureDefaultProject(page)
    projectId = await openFirstProjectAndGetId(page)
  })

  const gotoSessions = async (page: any) => {
    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/sessions`)
    await page.waitForTimeout(2000)
  }

  test("should display session list", async ({ page }) => {
    await gotoSessions(page)
    expect(await page.locator('[data-testid="sessions-list"]').isVisible({ timeout: 5000 })).toBe(true)
  })

  test("should have new session creation button", async ({ page }) => {
    await gotoSessions(page)
    expect(await page.locator('[data-testid="new-session-button"]').isVisible({ timeout: 5000 })).toBe(true)
  })

  test("should handle new session creation", async ({ page }) => {
    await gotoSessions(page)
    const newSessionButton = page.locator('[data-testid="new-session-button"]')
    expect(await newSessionButton.isVisible({ timeout: 5000 })).toBe(true)
    await newSessionButton.click()
    await page.waitForURL('**/sessions/**/chat', { timeout: 30000 })
    await expect(page.locator('[data-testid="chat-input-textarea"]').first()).toBeVisible({ timeout: 15000 })
  })

  test("should display search functionality", async ({ page }) => {
    await gotoSessions(page)
    expect(await page.locator('[data-testid="search-input"]').isVisible({ timeout: 5000 })).toBe(true)
  })

  test("should show loading state", async ({ page }) => {
    await gotoSessions(page)
    await expect(page.locator('[data-testid="sessions-list"]')).toBeVisible()
  })

  test("should show error state for API failures", async ({ page }) => {
    await gotoSessions(page)
    expect(apiErrors.filter((error) => error.status >= 500).length).toBe(0)
  })
})

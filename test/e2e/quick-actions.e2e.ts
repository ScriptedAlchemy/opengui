/**
 * E2E test for project dashboard and quick actions functionality
 */

import { test, expect } from "@playwright/test"

const DEFAULT_WORKTREE = "default"

test.describe("Quick Actions Navigation", () => {
  let projectId: string

  test.beforeEach(async ({ page }) => {
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

  test("should navigate correctly when clicking quick action buttons", async ({ page }) => {
    if (!projectId) test.skip()

    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
    await expect(page.locator('[data-testid="project-dashboard"]').first()).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-testid="quick-actions-section"]').first()).toBeVisible({ timeout: 10000 })

    const manageAgents = page.locator('[data-testid="manage-agents-button"]')
    await expect(manageAgents).toBeVisible({ timeout: 5000 })
    await manageAgents.click()
    await page.waitForTimeout(1000)
    expect(page.url()).toContain(`/projects/${projectId}/${DEFAULT_WORKTREE}/agents`)

    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
    const newChatButton = page.locator('[data-testid="button-new-chat"]')
    await expect(newChatButton).toBeVisible({ timeout: 5000 })
    await newChatButton.click()
    await page.waitForURL("**/sessions/**/chat", { timeout: 30000 })
  })
})

test.describe("Project Dashboard", () => {
  let projectId: string

  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.waitForSelector("#root", { state: "visible" })

    const firstProject = page.locator('[data-testid="project-item"]').first()
    if (await firstProject.isVisible({ timeout: 5000 })) {
      await firstProject.locator('button:has-text("Open")').click()
      await page.waitForTimeout(2000)
      const match = page.url().match(/\/projects\/([^/]+)\/([^/]+)/)
      if (match) {
        projectId = match[1]
      }
    }
  })

  test("should navigate to project dashboard", async ({ page }) => {
    if (!projectId) test.skip()

    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
    await expect(page.locator('[data-testid="project-dashboard"]').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="total-sessions-stat"]').first()).toBeVisible()
  })

  test("should handle session navigation", async ({ page }) => {
    if (!projectId) test.skip()

    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
    await expect(page.locator('[data-testid="project-dashboard"]').first()).toBeVisible({ timeout: 10000 })

    const newSessionButton = page.locator('[data-testid="button-new-chat"]')
    if (await newSessionButton.isVisible({ timeout: 5000 })) {
      await newSessionButton.click()
      await page.waitForURL("**/sessions/**/chat", { timeout: 10000 })
    } else {
      const sessionItem = page.locator('[data-testid="session-item"]').first()
      await expect(sessionItem).toBeVisible({ timeout: 2000 })
      await sessionItem.click()
      await page.waitForURL("**/sessions/**/chat", { timeout: 10000 })
    }
  })
})

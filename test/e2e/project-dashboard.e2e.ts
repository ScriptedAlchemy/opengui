import { test, expect, type Page } from "@playwright/test"
import { openFirstProjectAndGetId } from "./helpers"

const waitForDashboard = async (page: Page, projectId: string) => {
  await page.goto(`/projects/${projectId}`)
  await expect(page.locator('[data-testid="project-dashboard"]')).toBeVisible({ timeout: 15_000 })
}

const captureApiIssues = (page: Page) => {
  const issues: string[] = []
  page.on("response", (response) => {
    if (response.status() >= 400 && /\/project|\/session/.test(response.url())) {
      const method = response.request().method()
      issues.push(`${response.status()} ${method} ${response.url()}`)
    }
  })
  return issues
}

test.describe("Project Dashboard", () => {
  let projectId: string

  test.beforeEach(async ({ page }) => {
    projectId = await openFirstProjectAndGetId(page)
    await waitForDashboard(page, projectId)
  })

  test("shows key dashboard widgets", async ({ page }) => {
    const issues = captureApiIssues(page)

    await expect(page.locator('[data-testid="quick-actions-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="project-info-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="stats-section"]')).toBeVisible()

    expect(issues).toEqual([])
  })

  test("quick actions navigate to expected routes", async ({ page }) => {
    const newChat = page.locator('[data-testid="quick-action-new-chat"]')
    await expect(newChat).toBeVisible()
    await newChat.click()
    await page.waitForURL('**/sessions/**/chat', { timeout: 30_000 })

    await waitForDashboard(page, projectId)

    const manageAgents = page.locator('[data-testid="quick-action-manage-agents"]')
    await expect(manageAgents).toBeVisible()
    await manageAgents.click()
    await expect(page).toHaveURL(/agents/)
  })

  test("main navigation links work", async ({ page }) => {
    const navSessions = page.locator('[data-testid="nav-sessions"]').first()
    await expect(navSessions).toBeVisible({ timeout: 10_000 })
    await navSessions.scrollIntoViewIfNeeded()
    await navSessions.click()
    await expect(page).toHaveURL(/sessions/)
  })
})

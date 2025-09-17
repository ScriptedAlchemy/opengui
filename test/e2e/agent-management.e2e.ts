import { test, expect, type Page } from "@playwright/test"
import { openFirstProjectAndGetId } from "./helpers"

const DEFAULT_WORKTREE = "default"

type ApiIssue = {
  url: string
  status: number
  statusText: string
  body?: string
  method: string
}

const watchAgentApi = (page: Page) => {
  const issues: ApiIssue[] = []
  page.on("response", async (response) => {
    if (!/\/agent|\/session|\/message/.test(response.url())) {
      return
    }
    const status = response.status()
    if (status < 400) {
      return
    }
    const method = response.request().method()
    let body: string | undefined
    try {
      body = await response.text()
    } catch {
      /* ignore */
    }
    issues.push({
      url: response.url(),
      status,
      statusText: response.statusText(),
      body: body?.slice(0, 1_000),
      method,
    })
  })
  return issues
}

test.describe("Agent Management", () => {
  let projectId: string

  test.beforeEach(async ({ page }) => {
    projectId = await openFirstProjectAndGetId(page)
  })

  test("navigates to agent list", async ({ page }) => {
    const issues = watchAgentApi(page)

    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/agents`)
    await expect(page.locator('[data-testid="agents-page-title"]')).toBeVisible({ timeout: 15_000 })

    expect(issues).toEqual([])
  })

  test("opens templates dialog", async ({ page }) => {
    const issues = watchAgentApi(page)

    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/agents`)
    const templatesButton = page.locator('[data-testid="templates-button"]')
    await expect(templatesButton).toBeVisible()
    await templatesButton.click()
    await expect(page.locator('[data-testid="agent-templates-dialog"]')).toBeVisible()

    expect(issues).toEqual([])
  })

  test("creates a new agent", async ({ page }) => {
    const issues = watchAgentApi(page)

    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/agents`)
    await page.locator('[data-testid="create-agent-button"]').click()

    await page.locator('[data-testid="agent-name-input"]').fill("Test Agent E2E")
    await page.locator('[data-testid="agent-description-input"]').fill("Created by Playwright")
    await page.locator('[data-testid="agent-prompt-input"]').fill("You are a helpful assistant.")

    const responsePromise = page.waitForResponse((response) => response.url().includes("/agents") && response.request().method() === "POST")
    await page.locator('[data-testid="create-agent-submit"]').click()
    await responsePromise

    await expect(
      page.locator('[data-testid="agent-item"]').filter({ hasText: /Test Agent E2E/i })
    ).toBeVisible({ timeout: 10_000 })

    expect(issues).toEqual([])
  })

  test("supports search and filter controls", async ({ page }) => {
    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/agents`)

    const searchInput = page.locator('[data-testid="agents-search-input"]')
    await expect(searchInput).toBeVisible()
    await searchInput.fill("test")

    const filterButton = page.locator('[data-testid="agents-filter-button"]')
    const sortButton = page.locator('[data-testid="agents-sort-button"]')
    await expect(filterButton).toBeVisible()
    await expect(sortButton).toBeVisible()

    await filterButton.click()
    await page.keyboard.press("Escape")
    await sortButton.click()
    await page.keyboard.press("Escape")
  })
})

import { expect, Page } from "@playwright/test"

// Opens the app, clicks the first project's Open button, ensures dashboard,
// and returns the resolved projectId from the URL.
const DEFAULT_WORKTREE = "default"

export async function openFirstProjectAndGetId(page: Page): Promise<string> {
  await page.goto("/")
  await page.waitForSelector("#root", { state: "visible" })

  const firstProject = page.locator('[data-testid="project-item"]').first()
  await expect(firstProject).toBeVisible({ timeout: 15000 })

  const openButton = firstProject.locator('[data-testid="button-open-project"]')
  await expect(openButton).toBeVisible({ timeout: 15000 })
  await openButton.click()

  // Ensure we land on a project URL and dashboard is available (best effort)
  let projectId = ""
  try {
    await page.waitForURL(/\/projects\/[^/]+\/[^/]+/, { timeout: 20000 })
    const match = page.url().match(/\/projects\/([^/]+)\/([^/]+)/)
    projectId = match?.[1] || ""
    const worktree = match?.[2] || DEFAULT_WORKTREE
    if (projectId) {
      await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
    }
    await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 15000 })
  } catch {
    // Best-effort fallback: try to load dashboard directly if we captured id
    projectId = page.url().match(/\/projects\/([^/]+)/)?.[1] || projectId
    if (projectId) {
      await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
      await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 15000 }).catch(() => {})
    }
  }

  if (!projectId) {
    // Try to derive projectId from any project card link if URL parsing failed
    const url = page.url()
    const match = url.match(/\/projects\/([^/]+)\/([^/]+)/)
    if (match) projectId = match[1]
  }

  expect(projectId, "Project ID should be resolved after opening").not.toEqual("")
  return projectId
}

// Navigates to the chat page for a given project and waits for the chat input to be visible.
export async function goToChat(page: Page, projectId: string): Promise<void> {
  const basePath = `/projects/${projectId}/${DEFAULT_WORKTREE}`
  // Try project dashboard quick action first
  await page.goto(basePath)
  await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 15000 }).catch(() => {})

  const newChatButton = page.locator('[data-testid="button-new-chat"]').first()
  if (await newChatButton.isVisible({ timeout: 5000 })) {
    await newChatButton.click()
    // Wait for navigation to occur with a more flexible URL pattern
    // Session creation happens asynchronously, so we need to be patient
    await page.waitForTimeout(2000) // Give time for session creation
    try {
      await page.waitForURL('**/sessions/**/chat', { timeout: 30000 })
    } catch (error) {
      // If URL wait fails, check if we're on chat page anyway
      const currentUrl = page.url()
      // Check if URL contains both a session ID and /chat
      const hasSessionId = /\/sessions\/[^/]+\/chat/.test(currentUrl)
      if (!hasSessionId) {
        console.error(`Failed to navigate to chat page. Current URL: ${currentUrl}`)
        throw error
      }
    }
  } else {
    // If dashboard button not available, try sessions list flow
    // First ensure project context is established
    await page.goto(basePath)
    await page.waitForTimeout(2000)
    
    // Now go to sessions page
    await page.goto(`${basePath}/sessions`)
    await page.waitForTimeout(2000)
    
    // Check for error state and retry if needed
    const errorState = page.locator('text="Failed to load sessions"')
    if (await errorState.isVisible({ timeout: 2000 })) {
      const retryButton = page.locator('button:has-text("Try Again")')
      if (await retryButton.isVisible({ timeout: 2000 })) {
        await retryButton.click()
        await page.waitForTimeout(3000)
      }
    }
    
    const createBtn = page.locator('[data-testid="new-session-button"]')
    await expect(createBtn).toBeVisible({ timeout: 10000 })
    await createBtn.click()
    await page.waitForURL('**/sessions/**/chat', { timeout: 30000 })
  }

  // Wait for chat interface to be ready
  await page.waitForSelector('[data-testid="chat-input-textarea"]', { timeout: 15000 })
}

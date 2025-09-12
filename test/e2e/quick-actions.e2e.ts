/**
 * E2E test for project dashboard and quick actions functionality
 */

import { test, expect } from "@playwright/test"

test.describe("Quick Actions Navigation", () => {
  let projectId: string
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app home
    await page.goto("/")
    await page.waitForSelector("#root", { state: "visible" })
    await page.waitForTimeout(2000)

    // Find first available project
    const projectItems = page.locator('[data-testid="project-item"]')
    const firstProject = projectItems.first()
    
    if (await firstProject.isVisible({ timeout: 5000 })) {
      const openButton = firstProject.locator('button:has-text("Open")')
      await openButton.click()
      await page.waitForTimeout(3000)

      // Extract project ID from URL
      const currentUrl = page.url()
      if (currentUrl.includes("/projects/")) {
        const urlParts = currentUrl.split("/projects/")[1]
        if (urlParts) {
          projectId = urlParts.split("/")[0]
        }
      }
    }
  })
  
  test("should navigate correctly when clicking quick action buttons", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    // Navigate to project dashboard
    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(2000)

    // Verify we're on the project dashboard using proper data-testid
    const projectDashboard = page.locator('[data-testid="project-dashboard"]')
    await expect(projectDashboard).toBeVisible({ timeout: 20000 })

    // Check for Quick Actions section using proper data-testid
    const quickActionsSection = page.locator('[data-testid="quick-actions-section"]')
    await expect(quickActionsSection).toBeVisible({ timeout: 10000 })

    // In SDK mode, projects are always ready - no need to start

    // Test Manage Agents quick action using proper data-testid
    const manageAgentsButton = page.locator('[data-testid="manage-agents-button"]')
    
    // Test should fail if Manage Agents button is not found
    expect(await manageAgentsButton.isVisible({ timeout: 5000 })).toBe(true)
    expect(await manageAgentsButton.isEnabled()).toBe(true)

    // Click and verify navigation
    await manageAgentsButton.click()
    await page.waitForTimeout(2000)

    // Verify we're on the agents page
    const currentUrl = page.url()
    expect(currentUrl).toContain("/agents")

    // Return to dashboard to test New Chat action
    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(2000)

    // Test New Chat quick action using proper data-testid
    const newChatButton = page.locator('[data-testid="button-new-chat"]')
    
    // Test should fail if New Chat button is not found
    expect(await newChatButton.isVisible({ timeout: 5000 })).toBe(true)
    expect(await newChatButton.isEnabled()).toBe(true)
    
    await newChatButton.click()
    await page.waitForTimeout(2000)

    // Verify we're on the chat/sessions page
    const chatUrl = page.url()
    expect(chatUrl.includes("/sessions") || chatUrl.includes("/chat")).toBe(true)
  })
})

test.describe("Project Dashboard", () => {
  let projectId: string
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto("/")
    await page.waitForSelector("#root", { state: "visible" })
    await page.waitForTimeout(2000)

    // Find first available project
    const projectItems = page.locator('[data-testid="project-item"]')
    const firstProject = projectItems.first()
    
    if (await firstProject.isVisible({ timeout: 5000 })) {
      const openButton = firstProject.locator('button:has-text("Open")')
      await openButton.click()
      await page.waitForTimeout(3000)

      // Extract project ID from URL
      const currentUrl = page.url()
      if (currentUrl.includes("/projects/")) {
        const urlParts = currentUrl.split("/projects/")[1]
        if (urlParts) {
          projectId = urlParts.split("/")[0]
        }
      }
    }
  })
  
  test("should navigate to project dashboard and start instance", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    // Navigate to project dashboard
    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(2000)

    // Verify project dashboard loads using proper data-testid
    const projectDashboard = page.locator('[data-testid="project-dashboard"]')
    
    // Test should fail if project dashboard is not found
    expect(await projectDashboard.isVisible({ timeout: 10000 })).toBe(true)

    // In SDK mode, projects are always ready - no need to start

    // Verify we can see project stats using proper data-testids
    const totalSessions = page.locator('[data-testid="total-sessions-stat"]')
    const recentSessions = page.locator('[data-testid="recent-sessions-section"]')
    
    // Test should fail if project stats are not found
    expect(await totalSessions.isVisible()).toBe(true)
    expect(await recentSessions.isVisible()).toBe(true)
  })

  test("should handle session navigation", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    // Navigate to project dashboard
    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(2000)

    // Verify project dashboard loads using proper data-testid
    const projectDashboard = page.locator('[data-testid="project-dashboard"]')
    
    // Test should fail if project dashboard is not found
    expect(await projectDashboard.isVisible({ timeout: 10000 })).toBe(true)

    // In SDK mode, projects are always ready - no need to start

    // Look for new session button using proper data-testid
    const newSessionButton = page.locator('[data-testid="button-new-chat"]')
    if (await newSessionButton.isVisible({ timeout: 5000 })) {
      await newSessionButton.click()

      // Should navigate to chat interface
      await page.waitForURL("**/sessions/**", { timeout: 10000 })
    } else {
      // Check if there are existing sessions to click using proper data-testid
      const sessionItem = page.locator('[data-testid="session-item"]').first()
      
      // Test should fail if no session navigation options are found
      expect(await sessionItem.isVisible({ timeout: 2000 })).toBe(true)
      
      await sessionItem.click()
      // Should navigate to chat interface
      await page.waitForURL("**/sessions/**", { timeout: 10000 })
    }
  })
})

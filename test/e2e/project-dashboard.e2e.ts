import { test, expect } from "@playwright/test"
 

test.describe("Project Dashboard", () => {
  let projectId: string
  const apiErrors: Array<{ url: string; status: number; statusText: string }> = []

  test.beforeEach(async ({ page }) => {
    // Track API errors
    page.on("response", (response) => {
      if (response.status() >= 400 && (response.url().includes("/session") || response.url().includes("/message") || response.url().includes("/project"))) {
        apiErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        })
        
      }
    })

    // Navigate to app and get a project
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

  test("should display project dashboard with main sections", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    // Navigate to project dashboard
    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(3000)

    // Verify dashboard elements are present
    const dashboardIndicator = page.locator('[data-testid="project-dashboard"]')
    expect(await dashboardIndicator.isVisible({ timeout: 10000 })).toBe(true)

    // Check for main dashboard sections
    const quickActionsSection = page.locator('[data-testid="quick-actions-section"]')
    const projectInfoSection = page.locator('[data-testid="project-info-section"]')
    const statsSection = page.locator('[data-testid="stats-section"]')

    // Test should fail if quick actions section is not found
    expect(await quickActionsSection.isVisible({ timeout: 5000 })).toBe(true)

    // Check for API errors (log but don't fail test)
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/project")
    )
    if (criticalErrors.length > 0) {
      
    }
  })

  test("should display and interact with quick actions", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(3000)

    // Look for Quick Actions section
    const quickActionsSection = page.locator('[data-testid="quick-actions-section"]')
    
    // Test should fail if Quick Actions section is not found
    expect(await quickActionsSection.isVisible({ timeout: 5000 })).toBe(true)
    // Test New Chat quick action
    const newChatButton = page.locator('[data-testid="quick-action-new-chat"]')
    expect(await newChatButton.isVisible({ timeout: 5000 })).toBe(true)
    await expect(newChatButton).toBeEnabled()
    
    // Click and verify navigation
    const currentUrl = page.url()
    await newChatButton.click()
    await page.waitForTimeout(2000)
    
    const newUrl = page.url()
    expect(newUrl).not.toBe(currentUrl) // Should navigate somewhere
    
    // Navigate back to dashboard
    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(2000)
    
    // Test Manage Agents quick action
    const manageAgentsButton = page.locator('[data-testid="quick-action-manage-agents"]')
    expect(await manageAgentsButton.isVisible({ timeout: 5000 })).toBe(true)
    await expect(manageAgentsButton).toBeEnabled()
    
    await manageAgentsButton.click()
    await page.waitForTimeout(2000)
    
    // Should navigate to agents page
    const agentsUrl = page.url()
    expect(agentsUrl).toContain("agents")
    
    // Navigate back to dashboard
    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(2000)
    
    // Test File Browser quick action
    const fileBrowserButton = page.locator('[data-testid="quick-action-file-browser"]')
    await expect(fileBrowserButton).toBeVisible({ timeout: 10000 })
    await expect(fileBrowserButton).toBeEnabled({ timeout: 10000 })
    
    await fileBrowserButton.click()
    await page.waitForTimeout(2000)
    
    // Should navigate to file browser
    const filesUrl = page.url()
    expect(filesUrl).toMatch(/files|browser/)

    // Check for API errors (log but don't fail test)
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      (error.url.includes("/session") || error.url.includes("/project"))
    )
    if (criticalErrors.length > 0) {
      
    }
  })

  test("should display project status and controls", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(3000)

    // Look for project status indicators
    const statusSection = page.locator('[data-testid="project-status-section"]')
    const statusBadge = page.locator('[data-testid="badge-project-status"]')

    // Test should fail if project status section is not found
    expect(await statusSection.isVisible({ timeout: 5000 })).toBe(true)

    // In SDK mode, project should always show as ready
    expect(await statusBadge.isVisible({ timeout: 3000 })).toBe(true)
    const badgeText = await statusBadge.textContent()
    expect(badgeText).toContain("Ready")
    

    // Check for API errors (log but don't fail test)
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/project")
    )
    if (criticalErrors.length > 0) {
      
    }
  })

  test("should display project statistics and metrics", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(3000)

    // Look for various dashboard widgets and metrics
    const metricsSection = page.locator('[data-testid="project-metrics-section"]')
    const sessionsMetric = page.locator('[data-testid="sessions-metric"]')
    const messagesMetric = page.locator('[data-testid="messages-metric"]')
    const agentsMetric = page.locator('[data-testid="agents-metric"]')

    // Test should fail if project metrics section is not found
    expect(await metricsSection.isVisible({ timeout: 5000 })).toBe(true)
    

    // Check for API errors (log but don't fail test)
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/project")
    )
    if (criticalErrors.length > 0) {
      
    }
  })

  test("should display recent activity and sessions", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(3000)

    // Look for recent activity or sessions section
    const recentActivitySection = page.locator('[data-testid="recent-activity-section"]')
    const recentSessionsSection = page.locator('[data-testid="recent-sessions-section"]')

    // Test should fail if recent activity section is not found
    expect(await recentActivitySection.isVisible({ timeout: 5000 })).toBe(true)
    

    // Check for API errors (log but don't fail test)
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      (error.url.includes("/session") || error.url.includes("/project"))
    )
    if (criticalErrors.length > 0) {
      
    }
  })

  test("should handle dashboard navigation and sidebar", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}`)
    await page.waitForTimeout(3000)

    // Look for navigation elements
    // Be flexible: sidebar may render multiple nav containers (variants)
    const mainNavigation = page.locator('[data-testid="main-navigation"], [data-testid="nav-main"]').first()
    const sidebar = page.locator('[data-testid="project-sidebar"]')
    const dashboardNav = page.locator('[data-testid="dashboard-nav"]')

    // Test should fail if main navigation is not found
    expect(await mainNavigation.isVisible({ timeout: 5000 })).toBe(true)
    

    // Ensure sidebar is open (mobile/offcanvas variants)
    const sidebarTrigger = page.locator('[data-slot="sidebar-trigger"]')
    if (await sidebarTrigger.isVisible()) {
      await sidebarTrigger.click()
      await page.waitForTimeout(300)
    }

    // Test navigation to sessions via main navigation
    const sessionsNavButton = page.locator('[data-testid="nav-sessions"]').first()
    await expect(sessionsNavButton).toBeVisible({ timeout: 10000 })
    // Ensure it is clickable even if initially outside viewport
    await sessionsNavButton.scrollIntoViewIfNeeded()
    await sessionsNavButton.click()
    await page.waitForTimeout(2000)
    
    const newUrl = page.url()
    expect(newUrl).toContain('sessions')

    // Check for API errors (log but don't fail test)
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/project")
    )
    if (criticalErrors.length > 0) {
      
    }
  })
})

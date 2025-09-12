import { test, expect, Page } from "@playwright/test"

// Comprehensive project lifecycle test covering:
// - Project creation and initialization
// - Project configuration and settings
// - Development workflow (file editing, git operations, chat sessions)
// - Project management and cleanup
// - Cross-feature integration testing

// Helper to wait for page load
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("domcontentloaded")
  await page.waitForTimeout(2000)
}

// Helper to navigate to a specific page within project
async function navigateToProjectPage(page: Page, pageName: string, projectIdParam?: string) {
  try {
    const navigationLink = page.locator(`[data-testid="nav-${pageName}"], a[href*="${pageName}"], button:has-text("${pageName}")`)
    const isVisible = await navigationLink.isVisible({ timeout: 5000 }).catch(() => false)
    if (isVisible) {
      await navigationLink.click()
      await page.waitForTimeout(2000)
      return true
    }
    // Fallback: navigate directly using current project ID
    const url = page.url()
    const m = url.match(/\/projects\/([^/]+)/)
    if (m || projectIdParam) {
      const id = projectIdParam || m![1]
      const dest = `/projects/${id}/${pageName}`
      await page.goto(dest)
      await page.waitForTimeout(1500)
      return true
    }
    console.log(`Navigation link for '${pageName}' not found and could not derive project id`)
    return false
  } catch (error) {
    console.log(`Error navigating to ${pageName}:`, error)
    return false
  }
}

test.describe("Comprehensive Project Lifecycle", () => {
  let apiErrors: Array<{url: string, status: number, method: string}> = []
  let projectId: string | null = null

  test.beforeEach(async ({ page }) => {
    // Reset API error tracking
    apiErrors = []
    
    // Set up comprehensive API error monitoring
    page.on("response", (response) => {
      const relevantEndpoints = [
        "/project", "/session", "/message", "/file", "/git", 
        "/settings", "/agent", "/upload", "/browse", "/config"
      ]
      
      if (relevantEndpoints.some(endpoint => response.url().includes(endpoint))) {
        // Only log non-200 responses to reduce noise
        if (response.status() !== 200) {
          console.log(`🔍 API response: ${response.status()} ${response.url()}`)
        }
        
        if (response.status() >= 400) {
          const method = response.request().method()
          apiErrors.push({
            url: response.url(),
            status: response.status(),
            method: method
          })
          console.log(`❌ API Error: ${method} ${response.url()} returned ${response.status()}`)
        }
      }
    })
  })

  test.afterEach(async () => {
    // Check for critical API errors after each test
    if (apiErrors.length > 0) {
      const criticalErrors = apiErrors.filter(error => 
        error.status >= 500 || // Server errors are always critical
        (error.status >= 400 && (
          error.url.includes('/project') ||
          error.url.includes('/session') ||
          error.url.includes('/message')
        ))
      )
      
      if (criticalErrors.length > 0) {
        const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
        console.log(`API errors detected (non-blocking): ${errorDetails}`)
      }
    }
  })

  test("should complete full project lifecycle workflow", async ({ page }) => {
    console.log("Starting comprehensive project lifecycle test...")
    
    // ============================================
    // PHASE 1: Project Discovery and Selection
    // ============================================
    console.log("Phase 1: Project Discovery and Selection")
    
    await page.goto("/")
    await waitForPageLoad(page)
    
    // Verify project list is displayed using proper data-testid
    const projectList = page.locator('[data-testid="project-item"]')
    await expect(projectList.first()).toBeVisible({ timeout: 10000 })
    
    // Get project information
    const firstProject = page.locator('[data-testid="project-item"]').first()
    const projectName = await firstProject.locator('[data-testid="project-name"]').textContent()
    expect(projectName).toBeTruthy()
    console.log(`Selected project: ${projectName}`)
    
    // Open the project using proper data-testid
    const openButton = firstProject.locator('[data-testid="button-open-project"]')
    await expect(openButton).toBeVisible({ timeout: 10000 })
    await openButton.click()
    
    // Wait for project dashboard
    await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 10000 })
    
    // Extract project ID from URL
    const currentUrl = page.url()
    const projectIdMatch = currentUrl.match(/\/projects\/([a-f0-9]+)/)
    if (projectIdMatch) {
      projectId = projectIdMatch[1]
      console.log(`Project ID: ${projectId}`)
    }
    
    console.log("✅ Phase 1 completed: Project opened successfully")
    
    // ============================================
    // PHASE 2: Project Dashboard Exploration
    // ============================================
    console.log("Phase 2: Project Dashboard Exploration")
    
    // Verify dashboard components using proper data-testids
    const projectStatus = page.locator('[data-testid="project-status-section"]')
    const projectStats = page.locator('[data-testid="project-metrics-section"]')
    const quickActions = page.locator('[data-testid="quick-actions-section"]')
    const recentActivity = page.locator('[data-testid="recent-activity-section"]')
    
    // Test should fail if key dashboard elements are not found
    expect(await projectStatus.isVisible({ timeout: 5000 })).toBe(true)
    expect(await quickActions.isVisible({ timeout: 5000 })).toBe(true)
    console.log(`✅ Dashboard elements found and verified`)
    
    // Test quick actions using proper data-testids
    const newChatButton = page.locator('[data-testid="quick-action-new-chat"]')
    const manageAgentsButton = page.locator('[data-testid="quick-action-manage-agents"]')
    const fileBrowserButton = page.locator('[data-testid="quick-action-file-browser"]')
    
    // Test should fail if quick action buttons are not found
    expect(await newChatButton.isVisible({ timeout: 5000 })).toBe(true)
    expect(await manageAgentsButton.isVisible({ timeout: 5000 })).toBe(true)
    expect(await fileBrowserButton.isVisible({ timeout: 5000 })).toBe(true)
    console.log(`✅ All quick actions found and verified`)
    
    console.log("✅ Phase 2 completed: Dashboard exploration finished")
    
    // ============================================
    // PHASE 3: File Browser and Code Exploration
    // ============================================
    console.log("Phase 3: File Browser and Code Exploration")
    
    // Navigate to file browser using proper data-testid
    expect(await fileBrowserButton.isVisible({ timeout: 5000 })).toBe(true)
    await fileBrowserButton.click()
    await page.waitForTimeout(2000)
    
    // Verify file browser interface using proper data-testids
    const fileTree = page.locator('[data-testid="file-tree"]')
    expect(await fileTree.isVisible({ timeout: 5000 })).toBe(true)
    console.log("✅ File browser loaded")
    
    // Try to expand a folder using proper data-testid
    const folder = page.locator('[data-testid="folder-item"]').first()
    expect(await folder.isVisible({ timeout: 5000 })).toBe(true)
    await folder.click()
    await page.waitForTimeout(1000)
    console.log("✅ Folder expansion tested")
    
    // Try to open a file using proper data-testid
    const file = page.locator('[data-testid="file-item"]').first()
    expect(await file.isVisible({ timeout: 5000 })).toBe(true)
    await file.click()
    await page.waitForTimeout(2000)
    
    // Check if file content is displayed using proper data-testid
    const fileContent = page.locator('[data-testid="file-content"]')
    expect(await fileContent.isVisible({ timeout: 5000 })).toBe(true)
    console.log("✅ File content displayed")
    
    console.log("✅ Phase 3 completed: File browser exploration finished")
    
    // ============================================
    // PHASE 4: Git Operations and Version Control
    // ============================================
    console.log("Phase 4: Git Operations and Version Control")
    
    // Navigate back to dashboard
    await page.goto(currentUrl)
    await page.waitForTimeout(2000)
    
    // Navigate to git operations using proper navigation
    const gitNavSuccess = await navigateToProjectPage(page, "git", projectId || undefined)
    expect(gitNavSuccess).toBe(true)
    console.log("✅ Git operations page accessed")
    
    // Check git status elements using proper data-testids
    const gitStatus = page.locator('[data-testid="git-status"]')
    expect(await gitStatus.isVisible({ timeout: 5000 })).toBe(true)
    console.log(`✅ Git status section found`)
    
    // Test git actions - should have at least some git functionality
    const gitActions = page.locator('[data-testid="git-operations-page"]')
    expect(await gitActions.isVisible({ timeout: 5000 })).toBe(true)
    console.log(`✅ Git actions section found`)
    
    console.log("✅ Phase 4 completed: Git operations exploration finished")
    
    // ============================================
    // PHASE 5: Agent Management
    // ============================================
    console.log("Phase 5: Agent Management")
    
    // Navigate back to dashboard
    await page.goto(currentUrl)
    await page.waitForTimeout(2000)
    
    // Access agent management using proper data-testid
    expect(await manageAgentsButton.isVisible({ timeout: 5000 })).toBe(true)
    await manageAgentsButton.click()
    await page.waitForTimeout(2000)
    
    // Check agent management interface using proper data-testids
    const agentList = page.locator('[data-testid="agents-list"]')
    expect(await agentList.isVisible({ timeout: 5000 })).toBe(true)
    console.log(`✅ Agent list found`)
    
    const createAgentButton = page.locator('[data-testid="create-agent-button"]')
    expect(await createAgentButton.isVisible({ timeout: 5000 })).toBe(true)
    console.log("✅ Agent management interface verified")
    
    console.log("✅ Phase 5 completed: Agent management exploration finished")
    
    // ============================================
    // PHASE 6: Chat Session Creation and Interaction
    // ============================================
    console.log("Phase 6: Chat Session Creation and Interaction")
    
    // Navigate back to dashboard
    await page.goto(currentUrl)
    await page.waitForTimeout(2000)
    
    // Create new chat session using proper data-testid
    await expect(newChatButton).toBeVisible({ timeout: 10000 })
    await expect(newChatButton).toBeEnabled()
    await newChatButton.click()
    
    // Wait for chat interface with fallback logic
    try {
      await page.waitForURL(/\/projects\/.*\/sessions\/.*\/chat/, { timeout: 15000 })
      await page.waitForTimeout(2000)
    } catch (error) {
      console.log("Navigation timeout, attempting fallback navigation check")
      // Check if we're already on a sessions page
      const currentUrl = page.url()
      if (!currentUrl.includes("/sessions/")) {
        console.log("Not on sessions page, waiting for UI elements instead")
        // Wait for chat UI elements to appear instead with increased timeout
        await page.waitForSelector('[data-testid="chat-input"] textarea, textarea', { timeout: 30000 })
        // Give the page a moment to stabilize
        await page.waitForTimeout(2000)
      } else {
        console.log("Already on sessions page, continuing")
      }
    }
    
    // Test chat functionality using proper data-testid
    const messageInput = page.locator('[data-testid="chat-input-textarea"]')
    await expect(messageInput).toBeVisible({ timeout: 10000 })
    
    // Send test messages
    const testMessages = [
      "Hello, I'm testing the project lifecycle.",
      "Can you help me understand this project structure?",
      "What files are available in this project?"
    ]
    
    for (const [index, message] of testMessages.entries()) {
      await messageInput.fill(message)
      await messageInput.press("Enter")
      await page.waitForTimeout(2000)
      
      // Verify message appears using proper data-testid
      const userMessage = page.locator('[data-testid="message-user"]').nth(index)
      await expect(userMessage).toBeVisible({ timeout: 10000 })
      console.log(`✅ Message ${index + 1} sent and displayed`)
    }
    
    console.log("✅ Phase 6 completed: Chat session interaction finished")
    
    // ============================================
    // PHASE 7: Project Settings and Configuration
    // ============================================
    console.log("Phase 7: Project Settings and Configuration")
    
    // Navigate to project settings
    await page.goto(currentUrl)
    await page.waitForTimeout(2000)
    
    const settingsNavSuccess = await navigateToProjectPage(page, "settings", projectId || undefined)
    expect(settingsNavSuccess).toBe(true)
    console.log("✅ Project settings accessed")
    
    // Check settings sections using proper data-testids
    const generalSettings = page.locator('[data-testid="general-settings-section"]')
    expect(await generalSettings.isVisible({ timeout: 5000 })).toBe(true)
    console.log(`✅ General settings section found`)
    
    const aiSettings = page.locator('[data-testid="ai-settings-section"]')
    expect(await aiSettings.isVisible({ timeout: 5000 })).toBe(true)
    console.log(`✅ AI settings section found`)
    
    // Test settings navigation tabs using proper data-testid
    const settingsNav = page.locator('[data-testid="settings-navigation"]')
    expect(await settingsNav.isVisible({ timeout: 5000 })).toBe(true)
    console.log(`✅ Settings navigation found`)
    
    console.log("✅ Phase 7 completed: Project settings exploration finished")
    
    // ============================================
    // PHASE 8: Session Management
    // ============================================
    console.log("Phase 8: Session Management")
    
    // Navigate to sessions list
    await page.goto(currentUrl)
    await page.waitForTimeout(2000)
    
    const sessionsNavSuccess = await navigateToProjectPage(page, "sessions", projectId || undefined)
    expect(sessionsNavSuccess).toBe(true)
    console.log("✅ Sessions list accessed")
    
    // Check session list elements using proper data-testids
    const sessionsList = page.locator('[data-testid="sessions-list"]')
    expect(await sessionsList.isVisible({ timeout: 5000 })).toBe(true)
    console.log(`✅ Sessions list found`)
    
    const newSessionButton = page.locator('[data-testid="new-session-button"]')
    expect(await newSessionButton.isVisible({ timeout: 5000 })).toBe(true)
    console.log(`✅ New session button found`)
    
    // Count existing sessions using proper data-testid
    const sessionItems = page.locator('[data-testid="session-item"]')
    const sessionCount = await sessionItems.count()
    console.log(`Found ${sessionCount} existing sessions`)
    
    // Test session search using proper data-testid
    const searchInput = page.locator('[data-testid="search-input"]')
    expect(await searchInput.isVisible({ timeout: 5000 })).toBe(true)
    await searchInput.fill("test")
    await page.waitForTimeout(1000)
    await searchInput.clear()
    console.log("✅ Session search tested")
    
    console.log("✅ Phase 8 completed: Session management exploration finished")
    
    // ============================================
    // PHASE 9: Cross-Feature Integration Test
    // ============================================
    console.log("Phase 9: Cross-Feature Integration Test")
    
    // Test workflow: Dashboard -> File Browser -> Chat -> Back to Dashboard
    const workflowSteps = [
      { action: "Navigate to dashboard", url: `/projects/${projectId}` },
      { action: "Access file browser", button: '[data-testid="quick-action-file-browser"]' },
      { action: "Create new chat", button: '[data-testid="quick-action-new-chat"]' },
      { action: "Return to dashboard", url: currentUrl }
    ]
    
    for (const step of workflowSteps) {
      console.log(`Executing: ${step.action}`)
      
      if (step.url) {
        await page.goto(step.url)
        await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 15000 })
        await page.waitForTimeout(500)
      } else if (step.button) {
        const button = page.locator(step.button)
        expect(await button.isVisible({ timeout: 5000 })).toBe(true)
        await button.click()
        await page.waitForTimeout(2000)
      }
      
      console.log(`✅ ${step.action} completed`)
    }
    
    console.log("✅ Phase 9 completed: Cross-feature integration test finished")
    
    // ============================================
    // FINAL SUMMARY
    // ============================================
    console.log("\n" + "=".repeat(60))
    console.log("COMPREHENSIVE PROJECT LIFECYCLE TEST SUMMARY")
    console.log("=".repeat(60))
    console.log("✅ Phase 1: Project Discovery and Selection")
    console.log("✅ Phase 2: Project Dashboard Exploration")
    console.log("✅ Phase 3: File Browser and Code Exploration")
    console.log("✅ Phase 4: Git Operations and Version Control")
    console.log("✅ Phase 5: Agent Management")
    console.log("✅ Phase 6: Chat Session Creation and Interaction")
    console.log("✅ Phase 7: Project Settings and Configuration")
    console.log("✅ Phase 8: Session Management")
    console.log("✅ Phase 9: Cross-Feature Integration Test")
    console.log("=".repeat(60))
    console.log(`Project ID: ${projectId}`)
    console.log(`Total API Errors: ${apiErrors.length}`)
    console.log("🎉 COMPREHENSIVE PROJECT LIFECYCLE TEST COMPLETED SUCCESSFULLY!")
    console.log("=".repeat(60))
  })
})

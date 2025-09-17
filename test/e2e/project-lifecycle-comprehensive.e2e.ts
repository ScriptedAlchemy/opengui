import { test, expect, Page } from "@playwright/test"

const DEFAULT_WORKTREE = "default"

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
    const worktreeMatch = url.match(/\/projects\/[^/]+\/([^/]+)/)
    const worktreeId = worktreeMatch?.[1] || DEFAULT_WORKTREE
    if (m || projectIdParam) {
      const id = projectIdParam || m![1]
      const dest = `/projects/${id}/${worktreeId}/${pageName}`
      await page.goto(dest)
      await page.waitForTimeout(1500)
      return true
    }
    
    return false
  } catch (error) {
    
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
          console.log(`Non-200 response: ${response.status()} ${response.url()}`)
        }
        
        if (response.status() >= 400) {
          const method = response.request().method()
          apiErrors.push({
            url: response.url(),
            status: response.status(),
            method: method
          })
          
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
        
      }
    }
  })

  test("should complete full project lifecycle workflow", async ({ page }) => {
    
    
    // ============================================
    // PHASE 1: Project Discovery and Selection
    // ============================================
    
    
    await page.goto("/")
    await waitForPageLoad(page)
    
    // Verify project list is displayed using proper data-testid
    const projectList = page.locator('[data-testid="project-item"]')
    await expect(projectList.first()).toBeVisible({ timeout: 10000 })
    
    // Get project information
    const firstProject = page.locator('[data-testid="project-item"]').first()
    const projectName = await firstProject.locator('[data-testid="project-name"]').textContent()
    expect(projectName).toBeTruthy()
    
    
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
      
    }
    
    
    
    // ============================================
    // PHASE 2: Project Dashboard Exploration
    // ============================================
    
    
    // Ensure dashboard root is present first
    await expect(page.locator('[data-testid="project-dashboard"]')).toBeVisible({ timeout: 30000 })
    // Verify dashboard components using proper data-testids
    const projectStatus = page.locator('[data-testid="project-status-section"]')
    const projectStats = page.locator('[data-testid="project-metrics-section"]')
    const quickActions = page.locator('[data-testid="quick-actions-section"]')
    const recentActivity = page.locator('[data-testid="recent-activity-section"]')
    
    // Test should fail if key dashboard elements are not found
    expect(await projectStatus.isVisible({ timeout: 30000 })).toBe(true)
    expect(await quickActions.isVisible({ timeout: 30000 })).toBe(true)
    
    
    // Test quick actions using proper data-testids
    const newChatButton = page.locator('[data-testid="quick-action-new-chat"]')
    const manageAgentsButton = page.locator('[data-testid="quick-action-manage-agents"]')
    const fileBrowserButton = page.locator('[data-testid="quick-action-file-browser"]')
    
    // Test should fail if quick action buttons are not found
    expect(await newChatButton.isVisible({ timeout: 5000 })).toBe(true)
    expect(await manageAgentsButton.isVisible({ timeout: 5000 })).toBe(true)
    expect(await fileBrowserButton.isVisible({ timeout: 5000 })).toBe(true)
    
    
    
    
    // ============================================
    // PHASE 3: File Browser and Code Exploration
    // ============================================
    
    
    // Navigate to file browser using proper data-testid
    expect(await fileBrowserButton.isVisible({ timeout: 5000 })).toBe(true)
    await fileBrowserButton.click()
    await page.waitForTimeout(2000)
    
    // Verify file browser interface using proper data-testids
    const fileTree = page.locator('[data-testid="file-tree"]')
    expect(await fileTree.isVisible({ timeout: 5000 })).toBe(true)
    
    
    // Try to expand a folder using proper data-testid
    const folder = page.locator('[data-testid="folder-item"]').first()
    expect(await folder.isVisible({ timeout: 5000 })).toBe(true)
    await folder.click()
    await page.waitForTimeout(1000)
    
    
    // Try to open a file using proper data-testid
    const file = page.locator('[data-testid="file-item"]').first()
    expect(await file.isVisible({ timeout: 5000 })).toBe(true)
    await file.click()
    await page.waitForTimeout(2000)
    
    // Check if file content is displayed using proper data-testid
    const fileEditor = page.locator('[data-testid="file-editor"]')
    expect(await fileEditor.isVisible({ timeout: 15000 })).toBe(true)
    
    
    
    
    // ============================================
    // PHASE 4: Git Operations and Version Control
    // ============================================
    
    
    // Navigate back to dashboard
    await page.goto(currentUrl)
    await page.waitForTimeout(2000)
    
    // Navigate to git operations using proper navigation
    const gitNavSuccess = await navigateToProjectPage(page, "git", projectId || undefined)
    expect(gitNavSuccess).toBe(true)
    
    
    // Check git status elements using proper data-testids
    const gitStatus = page.locator('[data-testid="git-status"]')
    expect(await gitStatus.isVisible({ timeout: 5000 })).toBe(true)
    
    
    // Test git actions - should have at least some git functionality
    const gitActions = page.locator('[data-testid="git-operations-page"]')
    expect(await gitActions.isVisible({ timeout: 5000 })).toBe(true)
    
    
    
    
    // ============================================
    // PHASE 5: Agent Management
    // ============================================
    
    
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
    
    
    const createAgentButton = page.locator('[data-testid="create-agent-button"]')
    expect(await createAgentButton.isVisible({ timeout: 5000 })).toBe(true)
    
    
    
    
    // ============================================
    // PHASE 6: Chat Session Creation and Interaction
    // ============================================
    
    
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
      
      // Check if we're already on a sessions page
      const currentUrl = page.url()
      if (!currentUrl.includes("/sessions/")) {
        
        // Wait for chat UI elements to appear instead with increased timeout
        await page.waitForSelector('[data-testid="chat-input"] textarea, textarea', { timeout: 30000 })
        // Give the page a moment to stabilize
        await page.waitForTimeout(2000)
      } else {
        console.log('Already on sessions page, continuing with chat test')
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
    
    for (let index = 0; index < testMessages.length; index++) {
      const message = testMessages[index]
      await messageInput.fill(message)
      await messageInput.press("Enter")
      await page.waitForTimeout(2000)
      
      // Verify message appears using proper data-testid
      const userMessage = page.locator('[data-testid="message-user"]').nth(index)
      await expect(userMessage).toBeVisible({ timeout: 10000 })
      
    }
    
    
    
    // ============================================
    // PHASE 7: Project Settings and Configuration
    // ============================================
    
    
    // Navigate to project settings
    await page.goto(currentUrl)
    await page.waitForTimeout(2000)
    
    const settingsNavSuccess = await navigateToProjectPage(page, "settings", projectId || undefined)
    expect(settingsNavSuccess).toBe(true)
    
    
    // Check settings sections using proper data-testids
    const generalSettings = page.locator('[data-testid="general-settings-section"]')
    expect(await generalSettings.isVisible({ timeout: 5000 })).toBe(true)
    
    
    const aiSettings = page.locator('[data-testid="ai-settings-section"]')
    expect(await aiSettings.isVisible({ timeout: 5000 })).toBe(true)
    
    
    // Test settings navigation tabs using proper data-testid
    const settingsNav = page.locator('[data-testid="settings-navigation"]')
    expect(await settingsNav.isVisible({ timeout: 5000 })).toBe(true)
    
    
    
    
    // ============================================
    // PHASE 8: Session Management
    // ============================================
    
    
    // Navigate to sessions list
    await page.goto(currentUrl)
    await page.waitForTimeout(2000)
    
    const sessionsNavSuccess = await navigateToProjectPage(page, "sessions", projectId || undefined)
    expect(sessionsNavSuccess).toBe(true)
    
    
    // Wait for either a sessions list or an empty state after loading
    const sessionsList = page.locator('[data-testid="sessions-list"]')
    const emptySessions = page.locator('[data-testid="empty-sessions"]')
    await page.waitForTimeout(1000)
    const appeared = await Promise.race([
      sessionsList.isVisible({ timeout: 7000 }).then(() => true).catch(() => false),
      emptySessions.isVisible({ timeout: 7000 }).then(() => true).catch(() => false),
    ])
    if (!appeared) {
      // As a last resort, ensure the page is interactive via New Session
      const newSessionBtn = page.locator('[data-testid="new-session-button"]')
      expect(await newSessionBtn.isVisible({ timeout: 3000 })).toBe(true)
    }
    
    
    const newSessionButton = page.locator('[data-testid="new-session-button"]')
    expect(await newSessionButton.isVisible({ timeout: 5000 })).toBe(true)
    
    
    // Count existing sessions using proper data-testid
    const sessionItems = page.locator('[data-testid="session-item"]')
    const sessionCount = await sessionItems.count()
    
    
    // Test session search using proper data-testid
    const searchInput = page.locator('[data-testid="search-input"]')
    expect(await searchInput.isVisible({ timeout: 5000 })).toBe(true)
    await searchInput.fill("test")
    await page.waitForTimeout(1000)
    await searchInput.clear()
    
    
    
    
    // ============================================
    // PHASE 9: Cross-Feature Integration Test
    // ============================================
    
    
    // Test workflow: Dashboard -> File Browser -> Chat -> Back to Dashboard
    const workflowSteps = [
      { action: "Navigate to dashboard", url: `/projects/${projectId}/${DEFAULT_WORKTREE}` },
      { action: "Access file browser", url: `/projects/${projectId}/${DEFAULT_WORKTREE}/files` },
      { action: "Return to dashboard", url: `/projects/${projectId}/${DEFAULT_WORKTREE}` },
      // Use the dashboard quick action to create a chat (button is on dashboard)
      { action: "Create new chat", button: '[data-testid="quick-action-new-chat"]' },
      { action: "Return to dashboard", url: `/projects/${projectId}/${DEFAULT_WORKTREE}` }
    ]
    
    for (const step of workflowSteps) {
      

      if (step.url) {
        await page.goto(step.url)

        // Wait for a context-appropriate selector based on destination
        if (/\/projects\/.+\/files/.test(step.url)) {
          await page.waitForSelector('[data-testid="file-tree"]', { timeout: 15000 })
        } else if (/\/projects\/.+\/sessions\/.+\/chat/.test(step.url) || /\/sessions\/new\/chat/.test(step.url)) {
          await page.waitForSelector('[data-testid="chat-input-textarea"]', { timeout: 15000 })
        } else {
          await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 15000 })
        }

        await page.waitForTimeout(500)
      } else if (step.button) {
        const button = page.locator(step.button)
        expect(await button.isVisible({ timeout: 15000 })).toBe(true)
        await button.click()
        await page.waitForTimeout(2000)
      }

      
    }
    
    
    
    // ============================================
    // FINAL SUMMARY
    // ============================================
    
  })
})

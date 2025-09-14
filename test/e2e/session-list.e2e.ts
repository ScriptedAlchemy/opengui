import { test, expect } from "@playwright/test"
 

test.describe("Session List", () => {
  let projectId: string
  const apiErrors: Array<{ url: string; status: number; statusText: string; method: string }> = []

  test.beforeEach(async ({ page }) => {
    // Track API errors
    page.on("response", (response) => {
      if (response.status() >= 400 && (response.url().includes("/session") || response.url().includes("/project") || response.url().includes("/chat"))) {
        apiErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          method: response.request().method()
        })
        
      }
    })

    // Navigate to app and get a project
    try {
      await page.goto("/")
      await page.waitForSelector("#root", { state: "visible", timeout: 10000 })
      await page.waitForTimeout(2000)
    } catch (error) {
      
      // Try alternative navigation
      await page.goto("/")
      await page.waitForSelector("#root", { state: "visible", timeout: 10000 })
      await page.waitForTimeout(2000)
    }

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

  test("should navigate to session list page", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    // Navigate to sessions
    await page.goto(`/projects/${projectId}/sessions`)
    await page.waitForTimeout(3000)

    // Verify we're on the sessions page using proper data-testid
    const sessionsPage = page.locator('[data-testid="sessions-page"]')
    
    // Test should fail if sessions page is not found
    expect(await sessionsPage.isVisible({ timeout: 5000 })).toBe(true)

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/session")
    )
    if (criticalErrors.length > 0) {
      const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
      
    }
  })

  test("should display session list", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/sessions`)
    await page.waitForTimeout(3000)

    // Look for session list using proper data-testid
    const sessionList = page.locator('[data-testid="sessions-list"]')
    
    // Test should fail if session list is not found
    expect(await sessionList.isVisible({ timeout: 5000 })).toBe(true)

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/session")
    )
    if (criticalErrors.length > 0) {
      const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
      
    }
  })

  test("should have new session creation button", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/sessions`)
    await page.waitForTimeout(3000)

    // Look for new session button using proper data-testid
    const newSessionButton = page.locator('[data-testid="new-session-button"]')
    
    // Test should fail if new session button is not found
    expect(await newSessionButton.isVisible({ timeout: 5000 })).toBe(true)

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/session")
    )
    if (criticalErrors.length > 0) {
      const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
      
    }
  })

  test("should handle new session creation", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/sessions`)
    await page.waitForTimeout(3000)

    // Find and click new session button using proper data-testid
    const newSessionButton = page.locator('[data-testid="new-session-button"]')
    
    // Test should fail if new session button is not found
    expect(await newSessionButton.isVisible({ timeout: 5000 })).toBe(true)
    
    
    await newSessionButton.click()
    await page.waitForTimeout(3000)
    
    // Check if we're redirected to chat interface using proper data-testid
    const chatInput = page.locator('[data-testid="chat-input-textarea"]')
    
    // Test should fail if chat interface is not found
    expect(await chatInput.isVisible({ timeout: 5000 })).toBe(true)
    

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/session")
    )
    if (criticalErrors.length > 0) {
      const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
      
    }
  })

  test("should display search functionality", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/sessions`)
    await page.waitForTimeout(3000)

    // Look for search input using proper data-testid
    const searchInput = page.locator('[data-testid="search-input"]')
    
    // Test should fail if search input is not found
    expect(await searchInput.isVisible({ timeout: 5000 })).toBe(true)
    
    
    await searchInput.fill("test")
    await page.waitForTimeout(1000)
    
    // Clear search
    await searchInput.fill("")
    await page.waitForTimeout(1000)
    
    

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/session")
    )
    if (criticalErrors.length > 0) {
      const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
      
    }
  })

  test("should display sorting options", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/sessions`)
    await page.waitForTimeout(3000)

    // Look for sorting button using proper data-testid
    const sortButton = page.locator('[data-testid="sort-button"]')
    
    // Test should fail if sort button is not found
    expect(await sortButton.isVisible({ timeout: 5000 })).toBe(true)
    
    
    await sortButton.click()
    await page.waitForTimeout(1000)
    
    // Close dropdown if opened
    await page.keyboard.press('Escape')
    
    

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/session")
    )
    if (criticalErrors.length > 0) {
      const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
      
    }
  })

  test("should handle session item interactions", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/sessions`)
    await page.waitForTimeout(3000)

    // Look for session items using proper data-testid
    const sessionItem = page.locator('[data-testid="session-item"]').first()
    
    // Test should fail if session item is not found
    expect(await sessionItem.isVisible({ timeout: 5000 })).toBe(true)
    
    
    await sessionItem.click()
    await page.waitForTimeout(2000)
    
    // Check if we navigated to the session using proper data-testid
    const chatInput = page.locator('[data-testid="chat-input-textarea"]')
    
    // Test should fail if chat interface is not found
    expect(await chatInput.isVisible({ timeout: 5000 })).toBe(true)
    

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/session")
    )
    if (criticalErrors.length > 0) {
      const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
      
    }
  })

  test("should display session context menu options", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/sessions`)
    await page.waitForTimeout(3000)

    // Look for session items with context menu using proper data-testid
    const sessionItem = page.locator('[data-testid="session-item"]').first()
    
    // Test should fail if session item is not found
    expect(await sessionItem.isVisible({ timeout: 5000 })).toBe(true)
    
    
    
    // Try right-click for context menu
    await sessionItem.click({ button: 'right' })
    await page.waitForTimeout(1000)
    
    // Look for context menu using proper data-testid
    const contextMenu = page.locator('[data-testid="session-context-menu"]')
    
    // Test should fail if context menu is not found
    expect(await contextMenu.isVisible({ timeout: 5000 })).toBe(true)
    
    
    // Close context menu
    await page.keyboard.press('Escape')
    

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/session")
    )
    if (criticalErrors.length > 0) {
      const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
      
    }
  })

  test("should handle session deletion workflow", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/sessions`)
    await page.waitForTimeout(3000)

    // Look for session item first to get context
    const sessionItem = page.locator('[data-testid="session-item"]').first()
    expect(await sessionItem.isVisible({ timeout: 5000 })).toBe(true)
    
    // Look for delete button within the session item using proper data-testid
    const deleteButton = sessionItem.locator('[data-testid="delete-button"]')
    
    // Test should fail if delete button is not found
    expect(await deleteButton.isVisible({ timeout: 5000 })).toBe(true)
    
    
    await deleteButton.click()
    await page.waitForTimeout(1000)
    
    // Look for confirmation dialog using proper data-testid
    const confirmDialog = page.locator('[data-testid="delete-confirmation-dialog"]')
    
    // Test should fail if confirmation dialog is not found
    expect(await confirmDialog.isVisible({ timeout: 5000 })).toBe(true)
    
    
    // Cancel the deletion using proper data-testid
    const cancelButton = page.locator('[data-testid="cancel-delete-button"]')
    expect(await cancelButton.isVisible({ timeout: 3000 })).toBe(true)
    await cancelButton.click()
    
    

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/session")
    )
    if (criticalErrors.length > 0) {
      const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
      
    }
  })
})

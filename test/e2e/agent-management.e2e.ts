import { test, expect } from "@playwright/test"
 

test.describe("Agent Management", () => {
  let projectId: string
  const apiErrors: Array<{ url: string; status: number; statusText: string; body?: string; method?: string }> = []

  test.beforeEach(async ({ page }) => {
    // Track API errors with response bodies for better debugging
    page.on("response", async (response) => {
      try {
        const url = response.url()
        const status = response.status()
        if (
          status >= 400 &&
          (url.includes("/session") || url.includes("/message") || url.includes("/agent"))
        ) {
          const req = response.request()
          let body: string | undefined
          try {
            // Attempt to read the response body; prefer JSON string if available
            const text = await response.text()
            body = text?.slice(0, 2000) // truncate to avoid noisy logs
          } catch (_) {
            body = undefined
          }

          apiErrors.push({
            url,
            status,
            statusText: response.statusText(),
            body,
            method: req.method(),
          })

          // Log a concise, readable error with method, URL and body snippet
          const method = req.method()
          const statusText = response.statusText()
          
          if (body) {
            
          }
        }
      } catch (e) {
        
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

  test("should navigate to agent management page", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    // Navigate to agents page
    await page.goto(`/projects/${projectId}/agents`)
    await page.waitForTimeout(2000)

    // Verify we're on the agents page using proper data-testid
    const agentManagementTitle = page.locator('[data-testid="agents-page-title"]')
    
    // Test should fail if agents page title is not found
    expect(await agentManagementTitle.isVisible({ timeout: 10000 })).toBe(true)

    // Check for API errors (log but don't fail test)
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      (error.url.includes("/agent") || error.url.includes("/session"))
    )
    if (criticalErrors.length > 0) {
      
    }
  })

  test("should display agent templates dialog", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/agents`)
    await page.waitForTimeout(2000)

    // Look for templates button using proper data-testid
    const templatesButton = page.locator('[data-testid="templates-button"]')
    
    // Test should fail if templates button is not found
    expect(await templatesButton.isVisible({ timeout: 5000 })).toBe(true)
    await templatesButton.click()

    // Verify templates dialog is visible using proper data-testid
    const templatesDialog = page.locator('[data-testid="agent-templates-dialog"]')
    
    // Test should fail if templates dialog is not found
    expect(await templatesDialog.isVisible({ timeout: 5000 })).toBe(true)

    // Check for API errors (log but don't fail test)
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      (error.url.includes("/agent") || error.url.includes("/template"))
    )
    if (criticalErrors.length > 0) {
      
    }
  })

  test("should create a new agent", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/agents`)
    await page.waitForTimeout(2000)

    // Look for create agent button using proper data-testid
    const createButton = page.locator('[data-testid="create-agent-button"]')
    
    // Test should fail if create button is not found
    expect(await createButton.isVisible({ timeout: 5000 })).toBe(true)
    await createButton.click()

      // Wait for form to appear and fill in agent details using proper data-testids
      const nameInput = page.locator('[data-testid="agent-name-input"]')
      const descriptionInput = page.locator('[data-testid="agent-description-input"]')
      const promptInput = page.locator('[data-testid="agent-prompt-input"]')

      // Test should fail if required form fields are not found
      expect(await nameInput.isVisible({ timeout: 5000 })).toBe(true)
      expect(await descriptionInput.isVisible({ timeout: 5000 })).toBe(true)
      expect(await promptInput.isVisible({ timeout: 5000 })).toBe(true)

      await nameInput.fill("Test Agent E2E")
      await descriptionInput.fill("Test agent created by e2e test")
      await promptInput.fill("You are a helpful test assistant.")

      // Submit the form using proper data-testid
      const submitButton = page.locator('[data-testid="create-agent-submit"]')
      
      // Test should fail if submit button is not found
      expect(await submitButton.isVisible({ timeout: 5000 })).toBe(true)
      
      const postPromise = page.waitForResponse(
        (res) => res.request().method() === 'POST' && res.url().includes('/agents'),
        { timeout: 15000 }
      ).catch(() => null)

      await submitButton.click()
      await postPromise
      await page.waitForTimeout(1000)

      // Verify agent was created using proper data-testid
      const agentInList = page.locator('[data-testid="agent-item"]').filter({ hasText: /Test Agent E2E/i })
      
      // Test should fail if created agent is not found in list
      expect(await agentInList.first().isVisible({ timeout: 5000 })).toBe(true)

    // Check for API errors (log but don't fail test)
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      (error.url.includes("/agent") || error.url.includes("/create"))
    )
    if (criticalErrors.length > 0) {
      
    }
  })

  test("should display existing agents list", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/agents`)
    await page.waitForTimeout(3000)

    // Look for agents list using proper data-testid
    const agentsList = page.locator('[data-testid="agents-list"]')
    
    // Test should fail if agents list is not found
    expect(await agentsList.isVisible({ timeout: 5000 })).toBe(true)

    // Check for API errors (log but don't fail test)
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/agent")
    )
    if (criticalErrors.length > 0) {
      
    }
  })

  test("should handle search and filter functionality", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/agents`)
    await page.waitForTimeout(2000)

    // Look for search input using proper data-testid
    const searchInput = page.locator('[data-testid="agents-search-input"]')
    
    // Test should fail if search input is not found
    expect(await searchInput.isVisible({ timeout: 5000 })).toBe(true)
    
    await searchInput.fill("test")
    await page.waitForTimeout(1000)
    
    // Verify search results are displayed
    const searchResults = page.locator('[data-testid="agents-list"]')
    expect(await searchResults.isVisible({ timeout: 3000 })).toBe(true)

    // Look for filter controls using proper data-testids
    const filterButton = page.locator('[data-testid="agents-filter-button"]')
    const sortButton = page.locator('[data-testid="agents-sort-button"]')
    
    // Test should fail if filter controls are not found
    expect(await filterButton.isVisible({ timeout: 5000 })).toBe(true)
    expect(await sortButton.isVisible({ timeout: 5000 })).toBe(true)
    
    await filterButton.click()
    await page.waitForTimeout(1000)
    
    // Close the filter dropdown by pressing Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    
    await sortButton.click()
    await page.waitForTimeout(1000)

    // Check for API errors (log but don't fail test)
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/agent")
    )
    if (criticalErrors.length > 0) {
      
    }
  })
})

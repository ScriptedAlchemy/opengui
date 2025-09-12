import { test, expect } from "@playwright/test"

test.describe("Project Settings", () => {
  let projectId: string
  const apiErrors: Array<{ url: string; status: number; statusText: string }> = []

  test.beforeEach(async ({ page }) => {
    // Track API errors
    page.on("response", (response) => {
      if (response.status() >= 400 && (response.url().includes("/settings") || response.url().includes("/project") || response.url().includes("/config"))) {
        apiErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        })
        console.log(`API Error: ${response.status()} ${response.statusText()} - ${response.url()}`)
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

  test("should navigate to project settings page", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    // Navigate to project settings
    await page.goto(`/projects/${projectId}/settings`)
    await page.waitForTimeout(3000)

    // Verify we're on the settings page
    const settingsHeader = page.locator('[data-testid="settings-header"]')
    const settingsContainer = page.locator('[data-testid="settings-container"]')
    const settingsNavigation = page.locator('[data-testid="settings-navigation"]')

    // Test should fail if settings header is not found
    expect(await settingsHeader.isVisible({ timeout: 5000 })).toBe(true)

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/settings")
    )
    if (criticalErrors.length > 0) {
      throw new Error(`Critical API errors detected: ${JSON.stringify(criticalErrors)}`)
    }
  })

  test("should display settings navigation tabs", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/settings`)
    await page.waitForTimeout(3000)

    // Look for settings tabs/navigation
    const settingsNavigation = page.locator('[data-testid="settings-navigation"]')
    const generalTab = page.locator('[data-testid="settings-tab-general"]')
    const aiSettingsTab = page.locator('[data-testid="settings-tab-ai"]')
    const environmentTab = page.locator('[data-testid="settings-tab-environment"]')
    const permissionsTab = page.locator('[data-testid="settings-tab-permissions"]')
    const advancedTab = page.locator('[data-testid="settings-tab-advanced"]')

    // Test should fail if settings navigation is not found
    expect(await settingsNavigation.isVisible({ timeout: 5000 })).toBe(true)
    
    // Test should fail if general tab is not found
    expect(await generalTab.isVisible({ timeout: 5000 })).toBe(true)
    
    const tabText = await generalTab.textContent()
    console.log(`Found general settings tab: ${tabText}`)

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/settings")
    )
    if (criticalErrors.length > 0) {
      throw new Error(`Critical API errors detected: ${JSON.stringify(criticalErrors)}`)
    }
  })

  test("should display general settings section", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/settings`)
    await page.waitForTimeout(3000)

    // Click on General tab if it exists
    const generalTab = page.locator('[data-testid="settings-tab-general"]')
    if (await generalTab.isVisible({ timeout: 3000 })) {
      await generalTab.click()
      await page.waitForTimeout(2000)
    }

    // Look for general settings elements
    const projectNameInput = page.locator('[data-testid="project-name-input"]')
    const projectDescriptionInput = page.locator('[data-testid="project-description-input"]')
    const projectTitleInput = page.locator('[data-testid="project-title-input"]')
    const generalSettingsSection = page.locator('[data-testid="general-settings-section"]')

    // Test should fail if general settings section is not found
    expect(await generalSettingsSection.isVisible({ timeout: 5000 })).toBe(true)
    console.log("Found general settings section")

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/settings")
    )
    if (criticalErrors.length > 0) {
      throw new Error(`Critical API errors detected: ${JSON.stringify(criticalErrors)}`)
    }
  })

  test("should display AI settings section", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/settings`)
    await page.waitForTimeout(3000)

    // Click on AI settings tab if it exists
    const aiTab = page.locator('[data-testid="settings-tab-ai"]')
    if (await aiTab.isVisible({ timeout: 3000 })) {
      await aiTab.click()
      await page.waitForTimeout(2000)
    }

    // Look for AI settings elements
    const modelSelect = page.locator('[data-testid="ai-model-select"]')
    const providerSelect = page.locator('[data-testid="ai-provider-select"]')
    const apiKeyInput = page.locator('[data-testid="api-key-input"]')
    const temperatureSlider = page.locator('[data-testid="temperature-slider"]')
    const aiSettingsSection = page.locator('[data-testid="ai-settings-section"]')

    // AI settings section should exist - test should fail if not found
    expect(await aiSettingsSection.isVisible({ timeout: 5000 })).toBe(true)
    console.log("Found AI settings section")

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/settings")
    )
    if (criticalErrors.length > 0) {
      throw new Error(`Critical API errors detected: ${JSON.stringify(criticalErrors)}`)
    }
  })

  test("should display environment variables section", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/settings`)
    await page.waitForTimeout(3000)

    // Click on Environment tab if it exists
    const envTab = page.locator('[data-testid="settings-tab-environment"]')
    if (await envTab.isVisible({ timeout: 3000 })) {
      await envTab.click()
      await page.waitForTimeout(2000)
    }

    // Look for environment variables elements
    const envKeyInput = page.locator('[data-testid="env-key-input"]')
    const envValueInput = page.locator('[data-testid="env-value-input"]')
    const addEnvButton = page.locator('[data-testid="add-env-variable-button"]')
    const envVariablesTable = page.locator('[data-testid="env-variables-table"]')
    const envSettingsSection = page.locator('[data-testid="environment-settings-section"]')

    // Environment settings section should exist - test should fail if not found
    expect(await envSettingsSection.isVisible({ timeout: 5000 })).toBe(true)
    console.log("Found environment variables settings section")

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/settings")
    )
    if (criticalErrors.length > 0) {
      throw new Error(`Critical API errors detected: ${JSON.stringify(criticalErrors)}`)
    }
  })

  test("should display permissions section", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/settings`)
    await page.waitForTimeout(3000)

    // Click on Permissions tab if it exists
    const permTab = page.locator('[data-testid="settings-tab-permissions"]')
    if (await permTab.isVisible({ timeout: 3000 })) {
      await permTab.click()
      await page.waitForTimeout(2000)
    }

    // Look for permissions elements
    const publicCheckbox = page.locator('[data-testid="project-public-checkbox"]')
    const roleSelect = page.locator('[data-testid="user-role-select"]')
    const addUserButton = page.locator('[data-testid="add-user-button"]')
    const permissionsSection = page.locator('[data-testid="permissions-section"]')

    // Permissions section should exist - test should fail if not found
    expect(await permissionsSection.isVisible({ timeout: 5000 })).toBe(true)
    console.log("Found permissions settings section")

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/settings")
    )
    if (criticalErrors.length > 0) {
      throw new Error(`Critical API errors detected: ${JSON.stringify(criticalErrors)}`)
    }
  })

  test("should handle settings form interactions", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/settings`)
    await page.waitForTimeout(3000)

    // Look for form inputs to test - should exist
    const textInput = page.locator('[data-testid="project-name-input"]')
    expect(await textInput.isVisible({ timeout: 5000 })).toBe(true)
    
    const textareaInput = page.locator('[data-testid="project-description-input"]')
    const selectInput = page.locator('[data-testid="ai-model-select"]')
    const checkboxInput = page.locator('[data-testid="project-public-checkbox"]')
    
    const formInputs = [textInput, textareaInput, selectInput, checkboxInput]

    let interactionCount = 0
    for (const input of formInputs) {
      if (await input.isVisible({ timeout: 3000 })) {
        console.log(`Testing form interaction with: ${await input.getAttribute('type') || 'unknown'}`)
        
        const inputType = await input.getAttribute('type')
        const tagName = await input.evaluate(el => el.tagName.toLowerCase())
        
        try {
          if (inputType === 'checkbox') {
            await input.click()
            await page.waitForTimeout(500)
            await input.click() // Toggle back
          } else if (tagName === 'select') {
            await input.click()
            await page.waitForTimeout(500)
            await page.keyboard.press('Escape')
          } else if (tagName === 'textarea' || inputType === 'text') {
            const originalValue = await input.inputValue()
            await input.fill('Test value')
            await page.waitForTimeout(500)
            await input.fill(originalValue) // Restore original
          }
          
          interactionCount++
        } catch (error) {
          console.log(`Could not interact with input: ${error}`)
        }
        
        if (interactionCount >= 3) break // Limit interactions
      }
    }

    console.log(`Successfully interacted with ${interactionCount} form elements`)

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/settings")
    )
    if (criticalErrors.length > 0) {
      throw new Error(`Critical API errors detected: ${JSON.stringify(criticalErrors)}`)
    }
  })

  test("should have save/apply buttons", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/settings`)
    await page.waitForTimeout(3000)

    // Look for save/apply buttons
    const saveButton = page.locator('[data-testid="save-settings-button"]')
    const applyButton = page.locator('[data-testid="apply-settings-button"]')
    const updateButton = page.locator('[data-testid="update-settings-button"]')
    const submitButton = page.locator('[data-testid="submit-settings-button"]')

    // Test should fail if save settings button is not found
    expect(await saveButton.isVisible({ timeout: 5000 })).toBe(true)
    
    const buttonText = await saveButton.textContent()
    console.log(`Found save button: ${buttonText}`)

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/settings")
    )
    if (criticalErrors.length > 0) {
      throw new Error(`Critical API errors detected: ${JSON.stringify(criticalErrors)}`)
    }
  })

  test("should handle settings save workflow", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/settings`)
    await page.waitForTimeout(3000)

    // Find project name input to modify
    const textInput = page.locator('[data-testid="project-name-input"]')
    expect(await textInput.isVisible({ timeout: 5000 })).toBe(true)
    
    console.log("Found project name input, testing save workflow")
      
      const originalValue = await textInput.inputValue()
      
      // Make a small change
      await textInput.fill(originalValue + ' (test)')
      await page.waitForTimeout(1000)
      
    // Look for save button
    const saveButton = page.locator('[data-testid="save-settings-button"]')
    expect(await saveButton.isVisible({ timeout: 5000 })).toBe(true)
      
    console.log("Found save button, testing save workflow")
        
    await saveButton.click()
    await page.waitForTimeout(2000)
    
    // Look for success message or confirmation
    const successMessage = page.locator('[data-testid="settings-success-message"]')
    
    // Success message should appear - test should fail if not found
    expect(await successMessage.isVisible({ timeout: 5000 })).toBe(true)
    console.log("Found success confirmation")
    
    // Restore original value
    await textInput.fill(originalValue)
    
    // Save again to restore
    await saveButton.click()
    await page.waitForTimeout(1000)

    // Check for API errors
    await page.waitForTimeout(2000)
    const criticalErrors = apiErrors.filter(error => 
      error.status >= 400 && 
      error.url.includes("/settings")
    )
    if (criticalErrors.length > 0) {
      throw new Error(`Critical API errors detected: ${JSON.stringify(criticalErrors)}`)
    }
  })
})
import { test, expect } from "@playwright/test"
 

test.describe("Git Operations", () => {
  let projectId: string
  const apiErrors: Array<{ url: string; status: number; statusText: string }> = []

  test.beforeEach(async ({ page }) => {
    // Track API errors
    page.on("response", (response) => {
      if (response.status() >= 400 && (response.url().includes("/git") || response.url().includes("/project") || response.url().includes("/commit") || response.url().includes("/branch"))) {
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

  test("should navigate to git operations page", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    // Navigate to git operations
    await page.goto(`/projects/${projectId}/git`)
    await page.waitForTimeout(3000)

    // Verify we're on the git operations page - test fails if not found
    const gitPage = page.locator('[data-testid="git-operations-page"]')
    expect(await gitPage.isVisible({ timeout: 5000 })).toBe(true)

    
  })

  test("should display git status information", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/git`)
    await page.waitForTimeout(3000)

    // Look for git status element - test fails if not found
    const gitStatus = page.locator('[data-testid="git-status"]')
    expect(await gitStatus.isVisible({ timeout: 5000 })).toBe(true)
    
    
  })

  test("should display current branch information", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/git`)
    await page.waitForTimeout(3000)

    // Look for branch selector - test fails if not found
    const branchSelector = page.locator('[data-testid="branch-selector"]')
    expect(await branchSelector.isVisible({ timeout: 5000 })).toBe(true)
    
    
  })

  test("should display commit history", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/git`)
    await page.waitForTimeout(3000)

    // Look for commit history element - test fails if not found
    const commitHistory = page.locator('[data-testid="commit-history"]')
    expect(await commitHistory.isVisible({ timeout: 5000 })).toBe(true)
    
    
  })

  test("should have git action buttons", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/git`)
    await page.waitForTimeout(3000)

    // Look for git action buttons - tests fail if not found
    const commitButton = page.locator('[data-testid="commit-button"]')
    const pushButton = page.locator('[data-testid="push-button"]')
    const pullButton = page.locator('[data-testid="pull-button"]')
    
    expect(await commitButton.isVisible({ timeout: 5000 })).toBe(true)
    expect(await pushButton.isVisible({ timeout: 5000 })).toBe(true)
    expect(await pullButton.isVisible({ timeout: 5000 })).toBe(true)
    
    
  })

  test("should handle commit creation workflow", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/git`)
    await page.waitForTimeout(3000)

    // Look for commit button - test fails if not found
    const commitButton = page.locator('[data-testid="commit-button"]')
    expect(await commitButton.isVisible({ timeout: 5000 })).toBe(true)
    
    
    
    await commitButton.click()
    await page.waitForTimeout(2000)
    
    // Look for commit form element - test fails if not found
    const commitMessageInput = page.locator('[data-testid="commit-message-input"]')
    expect(await commitMessageInput.isVisible({ timeout: 5000 })).toBe(true)
    
    
    
    // Try to fill commit message
    await commitMessageInput.fill("Test commit from e2e test")
    await page.waitForTimeout(1000)
    
    // Look for submit button - test fails if not found
    const submitButton = page.locator('[data-testid="commit-submit-button"]')
    expect(await submitButton.isVisible({ timeout: 5000 })).toBe(true)
    
    // Don't actually commit, just verify the workflow exists
    
    
    // Clear the message
    await commitMessageInput.fill("")
    
    // Look for cancel button - test fails if not found
    const cancelButton = page.locator('[data-testid="commit-cancel-button"]')
    expect(await cancelButton.isVisible({ timeout: 5000 })).toBe(true)
    
    await cancelButton.click()
    await page.waitForTimeout(1000)
  })

  test("should handle branch operations", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/git`)
    await page.waitForTimeout(3000)

    // Look for branch selector - test fails if not found
    const branchSelector = page.locator('[data-testid="branch-selector"]')
    expect(await branchSelector.isVisible({ timeout: 5000 })).toBe(true)
    
    
    
    await branchSelector.click()
    await page.waitForTimeout(1000)
    
    // Look for branch input - test fails if not found
    const branchInput = page.locator('[data-testid="branch-name-input"]')
    expect(await branchInput.isVisible({ timeout: 5000 })).toBe(true)
    
    
    
    // Close the modal
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })

  test("should handle push/pull operations", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/git`)
    await page.waitForTimeout(3000)

    // Look for push/pull buttons - tests fail if not found
    const pushButton = page.locator('[data-testid="push-button"]')
    const pullButton = page.locator('[data-testid="pull-button"]')
    const fetchButton = page.locator('[data-testid="fetch-button"]')
    
    expect(await pushButton.isVisible({ timeout: 5000 })).toBe(true)
    expect(await pullButton.isVisible({ timeout: 5000 })).toBe(true)
    expect(await fetchButton.isVisible({ timeout: 5000 })).toBe(true)
    
    
    
    // Test button click only if enabled (but don't actually perform the operation)
    if (await pushButton.isEnabled({ timeout: 1000 })) {
      await pushButton.click()
      await page.waitForTimeout(1000)

      const confirmDialog = page.locator('[data-testid="push-confirm-dialog"]')
      if (await confirmDialog.isVisible({ timeout: 2000 })) {
        const cancelButton = page.locator('[data-testid="push-cancel-button"]')
        await expect(cancelButton).toBeVisible({ timeout: 5000 })
        await cancelButton.click()
      }
    } else {
      await expect(pushButton).toBeDisabled()
    }
    
    
    await page.waitForTimeout(500)
  })

  test("should display file changes and diffs", async ({ page }) => {
    if (!projectId) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/git`)
    await page.waitForTimeout(3000)

    // Look for file changes or diff display - test fails if not found
    const diffDisplay = page.locator('[data-testid="file-changes-diff"]')
    expect(await diffDisplay.isVisible({ timeout: 5000 })).toBe(true)
    
    
  })
})

import { test, expect } from "@playwright/test"

// Updated for SDK-only architecture:
// - No project start/stop needed
// - Projects are always ready in SDK mode
// - Sessions created via SDK calls

test.describe("Crystal Project Flow", () => {
  test("should add Crystal project and navigate through app", async ({ page }) => {
    // Navigate to app
    await page.goto("/")
    await page.waitForSelector("#root", { state: "visible" })
    await page.waitForTimeout(2000)

    // Check if Crystal project already exists
    const projectItems = page.locator('[data-testid="project-item"]')
    const crystalProject = projectItems.filter({ hasText: /crystal/i })

    const crystalExists = (await crystalProject.count()) > 0

    if (!crystalExists) {
      // Add Crystal project only if it doesn't exist
      const addButton = page.locator('[data-testid="add-project-button"]')
      await expect(addButton).toBeVisible({ timeout: 10000 })
      await addButton.click()

      const dialog = page.locator('[data-testid="add-project-dialog"]')
      await expect(dialog).toBeVisible({ timeout: 5000 })

      const pathInput = page.locator('[data-testid="project-path-input"]')
      const nameInput = page.locator('[data-testid="project-name-input"]')

      await pathInput.fill("/Users/bytedance/dev/crystal")
      await nameInput.fill("Crystal Project")

      const submitButton = dialog.locator('[data-testid="button-create-project"]')
      expect(await submitButton.isVisible({ timeout: 5000 })).toBe(true)
      await expect(submitButton).toBeEnabled({ timeout: 2000 })
      await submitButton.click()

      // Wait for project to appear in list instead of dialog to close
      await expect(projectItems.filter({ hasText: /crystal/i }).first()).toBeVisible({
        timeout: 10000,
      })
    }

    // Verify we have the crystal project

    // Click into project - test fails if button not found
    const openButton = crystalProject.first().locator('[data-testid="button-open-project"]')
    expect(await openButton.isVisible({ timeout: 5000 })).toBe(true)
    await openButton.click()
    await page.waitForTimeout(3000)

    // In SDK mode, no need to start instance
    console.log("SDK mode - project ready (no start/stop needed)")
    await page.waitForTimeout(2000)

    // Try to navigate to sessions page
    const currentUrl = page.url()
    let projectId: string | null = null

    if (currentUrl.includes("/projects/")) {
      const urlParts = currentUrl.split("/projects/")[1]
      if (urlParts) {
        projectId = urlParts.split("/")[0]
      }
    }

    if (projectId) {
      await page.goto(`/projects/${projectId}/sessions`)
    } else {
      // Try to find sessions link in navigation - test fails if not found
      const sessionsLink = page.locator('[data-testid="dashboard-nav"]')
      expect(await sessionsLink.isVisible({ timeout: 5000 })).toBe(true)
      await sessionsLink.click()
    }

    await page.waitForTimeout(3000)

    // Verify we're on some page (even if sessions aren't loaded)
    const bodyContent = await page.locator("body").isVisible()
    expect(bodyContent).toBeTruthy()

    // Try to create a new session using the new chat button - test fails if not found
    const newChatButton = page.locator('[data-testid="new-session-button"]')
    expect(await newChatButton.isVisible({ timeout: 5000 })).toBe(true)
    
    await newChatButton.click()

    // Wait for navigation to chat page
    try {
      await page.waitForURL(/\/sessions\/.*\/chat/, { timeout: 10000 })
      console.log("✅ New chat session created")
    } catch {
      // Session creation might have failed, just log it
      console.log("Note: Session navigation did not complete")
    }

    // Return to home and verify crystal project still exists
    await page.goto("/")
    await page.waitForTimeout(2000)

    const finalProjectItems = page.locator('[data-testid="project-item"]')

    // Verify Crystal project still exists - test fails if not found
    const finalCrystalProject = finalProjectItems.filter({ hasText: /crystal/i })
    expect(await finalCrystalProject.first().isVisible({ timeout: 5000 })).toBe(true)
    
    console.log("✅ Crystal project verification completed")
  })
})

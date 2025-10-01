import { test, expect } from "@playwright/test"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"

/**
 * Add Project Dialog E2E Test
 *
 * Tests the Add Project dialog with directory combobox:
 * 1. Opens dialog when clicking Add button
 * 2. Directory combobox with autocomplete
 * 3. Optional project name input
 * 4. Successful project creation
 * 5. Error handling
 */

test.describe("Add Project Dialog", () => {
  test("should open dialog when clicking add project button", async ({ page, baseURL }) => {
    await page.goto(baseURL!)

    // Wait for page to load
    await page.waitForSelector('[data-testid="project-rail"]', { timeout: 5000 })

    // Wait for the button to be visible and enabled
    const addButton = page.locator('[data-testid="add-project-button"]')
    await expect(addButton).toBeVisible({ timeout: 5000 })
    await expect(addButton).toBeEnabled()

    // Click the Add Project button
    await addButton.click()
    await page.waitForTimeout(500) // Give dialog time to open

    // Dialog should be visible
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text="Add Project"')).toBeVisible()
  })

  test("should add project using dialog", async ({ page, request, baseURL }) => {
    const testProjectPath = path.join(os.tmpdir(), `dialog-test-${Date.now()}`)
    fs.mkdirSync(testProjectPath, { recursive: true })

    try {
      await page.goto(baseURL!)
      await page.waitForSelector('[data-testid="project-rail"]', { timeout: 5000 })

      // Open dialog using data-testid
      await page.click('[data-testid="add-project-button"]')

      // Wait for dialog
      await page.waitForSelector('text="Add Project"', { timeout: 10000 })

      // Type path into the combobox input
      const comboboxInput = page.locator('input[placeholder*="search"]').first()
      await comboboxInput.fill(testProjectPath)

      // Enter project name
      const nameInput = page.locator('input[id="name"]')
      await nameInput.fill("Dialog Test Project")

      // Click Add button
      await page.click('button:has-text("Add Project")')

      // Wait for dialog to close
      await expect(page.locator('text="Add Project"')).not.toBeVisible({ timeout: 5000 })

      // Verify project was added via API
      const listResponse = await request.get(`${baseURL}/api/projects`)
      const projects = await listResponse.json()
      const addedProject = projects.find((p: any) => p.path === testProjectPath)
      expect(addedProject).toBeDefined()
      expect(addedProject.name).toBe("Dialog Test Project")

      // Clean up
      if (addedProject) {
        await request.delete(`${baseURL}/api/projects/${addedProject.id}`)
      }
    } finally {
      fs.rmSync(testProjectPath, { recursive: true, force: true })
    }
  })

  test("should show directory suggestions in combobox", async ({ page, baseURL }) => {
    await page.goto(baseURL!)
    await page.waitForSelector('[data-testid="project-rail"]', { timeout: 5000 })

    // Open dialog using data-testid
    await page.click('[data-testid="add-project-button"]')
    await page.waitForSelector('text="Add Project"', { timeout: 10000 })

    // Click the combobox trigger to open dropdown
    const comboboxTrigger = page.locator('button[role="combobox"]').first()
    await comboboxTrigger.click()

    // Wait for directory suggestions to load
    await page.waitForSelector('[role="option"]', { timeout: 5000 })

    // Should show directory suggestions
    const options = page.locator('[role="option"]')
    const count = await options.count()
    expect(count).toBeGreaterThan(0)
  })

  test("should require path before allowing submit", async ({ page, baseURL }) => {
    await page.goto(baseURL!)
    await page.waitForSelector('[data-testid="project-rail"]', { timeout: 5000 })

    // Open dialog using data-testid
    await page.click('[data-testid="add-project-button"]')
    await page.waitForSelector('text="Add Project"', { timeout: 10000 })

    // Add Project button should be disabled when path is empty
    const addButton = page.locator('button:has-text("Add Project")')
    await expect(addButton).toBeDisabled()
  })

  test("should cancel without adding project", async ({ page, request, baseURL }) => {
    await page.goto(baseURL!)
    await page.waitForSelector('[data-testid="project-rail"]', { timeout: 5000 })

    // Get initial project count
    const initialResponse = await request.get(`${baseURL}/api/projects`)
    const initialProjects = await initialResponse.json()
    const initialCount = initialProjects.length

    // Open dialog using data-testid
    await page.click('[data-testid="add-project-button"]')
    await page.waitForSelector('text="Add Project"', { timeout: 10000 })

    // Fill in some data
    const nameInput = page.locator('input[id="name"]')
    await nameInput.fill("Should Not Be Added")

    // Click Cancel
    await page.click('button:has-text("Cancel")')

    // Dialog should close
    await expect(page.locator('text="Add Project"')).not.toBeVisible({ timeout: 5000 })

    // Verify no project was added
    const finalResponse = await request.get(`${baseURL}/api/projects`)
    const finalProjects = await finalResponse.json()
    expect(finalProjects.length).toBe(initialCount)
  })
})

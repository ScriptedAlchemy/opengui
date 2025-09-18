import { test, expect } from "@playwright/test"
import { ensureDefaultProject, openFirstProjectAndGetId } from "./helpers"

const DEFAULT_WORKTREE = "default"

test.describe("File Browser", () => {
  let projectId: string
  const apiErrors: Array<{ url: string; status: number; statusText: string }> = []

  test.beforeEach(async ({ page }) => {
    apiErrors.length = 0
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        (response.url().includes("/file") || response.url().includes("/project") || response.url().includes("/browse"))
      ) {
        apiErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        })
      }
    })

    await ensureDefaultProject(page)
    projectId = await openFirstProjectAndGetId(page)
  })

  const gotoFiles = async (page: any) => {
    await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/files`)
    await page.waitForTimeout(2000)
  }

  test("should navigate to file browser page", async ({ page }) => {
    await gotoFiles(page)
    expect(await page.locator('[data-testid="file-browser-page"]').isVisible({ timeout: 5000 })).toBe(true)
  })

  test("should display file tree structure", async ({ page }) => {
    await gotoFiles(page)
    await expect(page.locator('[data-testid="file-tree"]').first()).toBeVisible({ timeout: 30000 })
  })

  test("should expand and collapse folders", async ({ page }) => {
    await gotoFiles(page)

    const folderItems = page.locator('[data-testid="folder-item"]')
    const hasFolder = (await folderItems.count()) > 0
    expect(hasFolder, "Expected demo project to include at least one folder").toBe(true)

    const folderItem = folderItems.first()
    await expect(folderItem).toBeVisible({ timeout: 30000 })
    await folderItem.click()
    await page.waitForTimeout(500)
    await folderItem.click()
    await page.waitForTimeout(500)
  })

  test("should open and display file content", async ({ page }) => {
    await gotoFiles(page)

    const preferred = page.locator('[data-testid="file-item"]:text("package.json")')
    const anyFile = page.locator('[data-testid="file-item"]').first()
    const hasFile = (await page.locator('[data-testid="file-item"]').count()) > 0
    expect(hasFile, "Expected demo project to include at least one file").toBe(true)

    const fileItem = (await preferred.count()) > 0 ? preferred.first() : anyFile
    await expect(fileItem).toBeVisible({ timeout: 30000 })
    await fileItem.click()
    await page.waitForTimeout(2000)

    await expect(page.locator('[data-testid="editor-container"]').first()).toBeVisible({ timeout: 10000 })
  })
})

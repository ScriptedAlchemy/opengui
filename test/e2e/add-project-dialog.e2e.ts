import { test, expect } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"

test.describe("Add Project dialog (combobox)", () => {
  test("selects project path via combobox and shows selected path", async ({ page }) => {
    // Open home page
    await page.goto("/")
    await page.waitForSelector("#root", { state: "visible" })

    // Open the Add Project dialog
    await page.getByRole("button", { name: /add project/i }).click()
    const dialog = page.locator('[data-testid="add-project-dialog"]')
    await expect(dialog).toBeVisible()

    // Verify the combobox-based UI exists
    const comboboxButton = dialog.locator('button[role="combobox"]').first()
    await expect(comboboxButton).toBeVisible()
    await expect(dialog.getByText(/directory explorer/i)).toHaveCount(0)

    // Prepare a predictable directory under HOME for selection
    const home = process.env.HOME || process.env.USERPROFILE || ""
    const selectableDir = path.join(home, "opencode-e2e-select")
    try { fs.mkdirSync(selectableDir, { recursive: true }) } catch {}

    // Step 1: navigate to repo root using path-like search "dev/opencode-1"
    await comboboxButton.click()
    let searchInput = page.getByPlaceholder("Type to search (e.g. 'dev', 'projects')...")
    await searchInput.fill("dev/opencode-1")
    await page.getByText("Searching directories...", { exact: true }).isVisible().catch(() => {})
    await page.waitForSelector("text=Searching directories...", { state: "detached", timeout: 5000 }).catch(() => {})
    await page.locator('[cmdk-item]').filter({ hasText: 'opencode-1' }).first().click()

    // Step 2: select the predictable HOME child directory we created
    await comboboxButton.click()
    searchInput = page.getByPlaceholder("Type to search (e.g. 'dev', 'projects')...")
    await searchInput.fill("opencode-e2e-select")
    await page.getByText("Searching directories...", { exact: true }).isVisible().catch(() => {})
    await page.waitForSelector("text=Searching directories...", { state: "detached", timeout: 5000 }).catch(() => {})
    await page.locator('[cmdk-item]').filter({ hasText: 'opencode-e2e-select' }).first().click()

    // Verify the selected path is rendered below the combobox
    const readout = dialog.getByText(/^Selected:/)
    await expect(readout).toBeVisible()
    await expect(readout).toContainText("opencode-e2e-select")

    // Optional: confirm the Project Name auto-populates from package.json
    const nameInput = dialog.getByTestId("project-name-input")
    await expect(nameInput).toHaveValue(/opencode-e2e-select/i)
  })
})

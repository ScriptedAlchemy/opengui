import { test, expect } from "@playwright/test"

test.describe("Worktree Create Dialog", () => {
  test("clicking New Worktree opens shadcn dialog (no browser prompt)", async ({ page, request, baseURL }) => {
    // Ensure there is at least one project to enable the button
    const resp = await request.get(`${baseURL}/api/projects`)
    const projects = await resp.json()
    expect(Array.isArray(projects)).toBeTruthy()
    expect(projects.length).toBeGreaterThan(0)

    await page.goto("/")
    await expect(page.getByTestId("open-new-worktree")).toBeVisible()
    await page.getByTestId("open-new-worktree").click()
    await expect(page.getByTestId("create-worktree-dialog")).toBeVisible()
  })
})


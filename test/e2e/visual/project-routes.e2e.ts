import { test, expect } from "@playwright/test"

const DEFAULT_WORKTREE = "default"

test("project route snapshots", async ({ page }) => {
  // Freeze time for deterministic UI (e.g., relative timestamps)
  const fixedNow = new Date("2025-09-18T12:00:00Z").valueOf()
  await page.addInitScript((frozenNow) => {
    const OriginalDate = Date
    class FrozenDate extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(frozenNow)
        } else {
          super(...args)
        }
      }
      static now() {
        return frozenNow
      }
    }
    // @ts-ignore
    window.Date = FrozenDate
  }, fixedNow)
  await page.goto("/")
  await page.waitForSelector("#root", { state: "visible" })

  const firstProject = page.locator('[data-testid="project-item"]').first()
  await firstProject.locator('button:has-text("Open")').click()
  await page.waitForTimeout(2000)
  const match = page.url().match(/\/projects\/([^/]+)\/([^/]+)/)
  expect(match).not.toBeNull()
  const projectId = match![1]

  const routes = [
    `/projects/${projectId}/${DEFAULT_WORKTREE}`,
    `/projects/${projectId}/${DEFAULT_WORKTREE}/agents`,
    `/projects/${projectId}/${DEFAULT_WORKTREE}/files`,
    `/projects/${projectId}/${DEFAULT_WORKTREE}/sessions`,
    `/projects/${projectId}/${DEFAULT_WORKTREE}/git`,
    `/projects/${projectId}/${DEFAULT_WORKTREE}/settings`,
  ]

  for (const route of routes) {
    await page.goto(route)
    await page.waitForTimeout(1000)
    await expect(page).toHaveScreenshot(`route-${route.split("/").slice(-1)[0]}.png`, {
      animations: "disabled",
      timeout: 15000,
      maxDiffPixelRatio: 0.02,
    })
  }
})

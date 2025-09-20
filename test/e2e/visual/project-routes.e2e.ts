import { test, expect } from "@playwright/test"
import { ensureDefaultProject } from "../helpers"

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
  // Ensure we use the deterministic demo project rather than any seeded default
  const { id: projectId } = await ensureDefaultProject(page)
  await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
  await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 15_000 })

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

    const name = route.split("/").slice(-1)[0]
    if (name === "git") {
      const panel = page.locator('[data-testid="git-operations-page"]')
      await expect(panel).toBeVisible()
      await expect(panel).toHaveScreenshot(`route-${name}.png`, {
        animations: "disabled",
        timeout: 15000,
        maxDiffPixelRatio: 0.02,
      })
    } else {
      await expect(page).toHaveScreenshot(`route-${name}.png`, {
        animations: "disabled",
        timeout: 15000,
        maxDiffPixelRatio: 0.02,
      })
    }
  }
})

import { test, expect } from "@playwright/test"

const DEFAULT_WORKTREE = "default"

test("Chat workflow", async ({ page }) => {
  // Gate real model usage for CI speed and determinism
  const useRealModels = process.env.TEST_REAL_MODELS === '1'
  if (!useRealModels) {
    await page.route('**/session/*/message', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      const now = Math.floor(Date.now() / 1000)
      const body = {
        info: {
          id: `mock-assistant-${now}`,
          role: 'assistant',
          sessionID: 'stub',
          time: { created: now, completed: now },
          system: [],
          modelID: 'mock-model',
          providerID: 'mock-provider',
          mode: 'test',
          path: { cwd: '', root: '' },
          summary: false,
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        },
        parts: [
          {
            id: `mock-part-${now}`,
            sessionID: 'stub',
            messageID: `mock-assistant-${now}`,
            type: 'text',
            text: 'This is a mocked assistant reply.',
          },
        ],
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
  }

  await page.goto("/")
  await page.waitForSelector("#root", { state: "visible" })

  const firstProject = page.locator('[data-testid="project-item"]').first()
  await firstProject.locator('button:has-text("Open")').click()
  await page.waitForTimeout(2000)
  const match = page.url().match(/\/projects\/([^/]+)\/([^/]+)/)
  expect(match).not.toBeNull()
  const projectId = match![1]

  await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}/sessions`)
  await page.waitForSelector('[data-testid="new-session-button"]', { timeout: 15000 })
  await page.locator('[data-testid="new-session-button"]').click()
  await page.waitForURL("**/sessions/**/chat", { timeout: 30000 })
  await expect(page.locator('[data-testid="chat-input-textarea"]').first()).toBeVisible({ timeout: 15000 })
})

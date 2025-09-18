import { expect, Page } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// Opens the app, clicks the first project's Open button, ensures dashboard,
// and returns the resolved projectId from the URL.
const DEFAULT_WORKTREE = "default"
export const DEMO_PROJECT_ROOT = path.join(process.cwd(), "test-results", "e2e-demo-project")

export function ensureDemoProjectOnDisk(root: string) {
  const srcDir = path.join(root, "src")
  const componentsDir = path.join(srcDir, "components")

  fs.mkdirSync(componentsDir, { recursive: true })

  const packageJsonPath = path.join(root, "package.json")
  const readmePath = path.join(root, "README.md")
  const indexPath = path.join(srcDir, "index.ts")
  const componentPath = path.join(componentsDir, "App.tsx")

  const packageJson = {
    name: "e2e-demo-project",
    version: "1.0.0",
    main: "src/index.ts",
    scripts: {
      build: "echo 'build'",
      test: "echo 'test'",
    },
  }

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8")
  fs.writeFileSync(readmePath, "# E2E Demo Project\n\nThis project is generated automatically for end-to-end testing.\n", "utf8")
  fs.writeFileSync(
    indexPath,
    "import { App } from './components/App'\n\nexport const run = () => App();\n",
    "utf8"
  )
  fs.writeFileSync(
    componentPath,
    "export const App = () => 'Hello from E2E demo project';\n",
    "utf8"
  )
}

export async function ensureDefaultProject(page: Page): Promise<{ id: string; path: string }> {
  ensureDemoProjectOnDisk(DEMO_PROJECT_ROOT)

  const listResponse = await page.request.get("/api/projects")
  if (!listResponse.ok()) {
    throw new Error(`Failed to list projects: ${listResponse.status()} ${listResponse.statusText()}`)
  }

  const projects = (await listResponse.json()) as Array<{ id: string; path: string }>
  const normalizedRoot = path.resolve(DEMO_PROJECT_ROOT)
  const existing = Array.isArray(projects)
    ? projects.find((project) => project?.path && path.resolve(project.path) === normalizedRoot)
    : undefined

  if (existing) {
    return existing
  }

  const createResponse = await page.request.post("/api/projects", {
    data: {
      path: DEMO_PROJECT_ROOT,
      name: "E2E Demo Project",
    },
  })

  if (!createResponse.ok()) {
    const retryResponse = await page.request.get("/api/projects")
    if (retryResponse.ok()) {
      const retryProjects = (await retryResponse.json()) as Array<{ id: string; path: string }>
      const fallback = Array.isArray(retryProjects)
        ? retryProjects.find((project) => project?.path && path.resolve(project.path) === normalizedRoot)
        : undefined
      if (fallback) {
        return fallback
      }
    }
    const errorText = await createResponse.text()
    throw new Error(`Failed to create demo project: ${createResponse.status()} ${errorText}`)
  }

  const created = (await createResponse.json()) as { id: string; path?: string }
  return {
    id: created.id,
    path: created.path ?? DEMO_PROJECT_ROOT,
  }
}

export async function openFirstProjectAndGetId(page: Page): Promise<string> {
  await page.goto("/")
  await page.waitForSelector("#root", { state: "visible" })

  const firstProject = page.locator('[data-testid="project-item"]').first()
  await expect(firstProject).toBeVisible({ timeout: 15000 })

  const openButton = firstProject.locator('[data-testid="button-open-project"]')
  await expect(openButton).toBeVisible({ timeout: 15000 })
  await openButton.click()

  // Ensure we land on a project URL and dashboard is available (best effort)
  let projectId = ""
  try {
    await page.waitForURL(/\/projects\/[^/]+\/[^/]+/, { timeout: 20000 })
    const match = page.url().match(/\/projects\/([^/]+)\/([^/]+)/)
    projectId = match?.[1] || ""
    const worktree = match?.[2] || DEFAULT_WORKTREE
    if (projectId) {
      await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
    }
    await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 15000 })
  } catch {
    // Best-effort fallback: try to load dashboard directly if we captured id
    projectId = page.url().match(/\/projects\/([^/]+)/)?.[1] || projectId
    if (projectId) {
      await page.goto(`/projects/${projectId}/${DEFAULT_WORKTREE}`)
      await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 15000 }).catch(() => {})
    }
  }

  if (!projectId) {
    // Try to derive projectId from any project card link if URL parsing failed
    const url = page.url()
    const match = url.match(/\/projects\/([^/]+)\/([^/]+)/)
    if (match) projectId = match[1]
  }

  expect(projectId, "Project ID should be resolved after opening").not.toEqual("")
  return projectId
}

// Navigates to the chat page for a given project and waits for the chat input to be visible.
export async function goToChat(page: Page, projectId: string): Promise<void> {
  const basePath = `/projects/${projectId}/${DEFAULT_WORKTREE}`
  await page.goto(basePath)
  await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 15000 }).catch(() => {})

  // Prefer reusing an existing chat session so local backend storage is already initialized.
  await page.goto(`${basePath}/sessions`)
  await page.waitForTimeout(1000)

  const storageDir = path.join(
    process.env.HOME || "",
    ".local",
    "share",
    "opencode",
    "storage",
    "session",
    projectId
  )
  let seedSessionId: string | null = null
  try {
    const entries = fs.readdirSync(storageDir)
    const firstJson = entries.find((entry) => entry.endsWith(".json"))
    if (firstJson) seedSessionId = firstJson.replace(/\.json$/, "")
  } catch {
    seedSessionId = null
  }

  if (seedSessionId) {
    await page.goto(`${basePath}/sessions/${seedSessionId}/chat`)
    await page.waitForSelector('[data-testid="chat-input-textarea"]', { timeout: 15000 }).catch(() => {})
    if (/\/sessions\/[^/]+\/chat/.test(page.url())) {
      return
    }
    // If navigation failed fall back to UI-driven selection below
    await page.goto(`${basePath}/sessions`)
    await page.waitForTimeout(1000)
  }

  const sessionList = page.locator('[data-testid="session-item"]')
  let clickedExisting = false
  if (await sessionList.first().isVisible({ timeout: 5000 })) {
    const count = await sessionList.count()
    for (let index = 0; index < count; index += 1) {
      const text = (await sessionList.nth(index).innerText({ timeout: 2000 })).trim()
      if (!text) continue
      if (/^new chat/i.test(text) || /^new session/i.test(text)) {
        continue
      }
      await sessionList.nth(index).click()
      await page.waitForURL('**/sessions/**/chat', { timeout: 30000 })
      clickedExisting = true
      break
    }
  }

  if (!clickedExisting) {
    // Fall back to creating a session only if none exist
    const createBtn = page.locator('[data-testid="new-session-button"]')
    await expect(createBtn).toBeVisible({ timeout: 10000 })
    await createBtn.click()
    await page.waitForURL('**/sessions/**/chat', { timeout: 30000 })
  }

  // Wait for chat interface to be ready
  await page.waitForSelector('[data-testid="chat-input-textarea"]', { timeout: 15000 })
}

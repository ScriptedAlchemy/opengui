import { beforeAll, afterAll, describe, it, expect } from "@rstest/core"
import killPort from "kill-port"
import { spawn, execFile, type ChildProcess } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

const PORT = 3099
const HOST = "127.0.0.1"
const BASE_URL = `http://${HOST}:${PORT}`

let child: ChildProcess | undefined
let startedLocally = false
const tempPaths: string[] = []
const execFileAsync = promisify(execFile)

const tmpRootPromise = (async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opengui-int-"))
  tempPaths.push(dir)
  return dir
})()

async function isServerUp() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, { method: "GET" })
    return response.ok
  } catch {
    return false
  }
}

async function ensureServerStarted() {
  if (await isServerUp()) return

  const tmpRoot = await tmpRootPromise
  const configDir = path.join(tmpRoot, "config")
  await fs.mkdir(configDir, { recursive: true })

  child = spawn("node", ["server-dist/index.js"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST,
      AGENT_ORANGE_CONFIG_DIR: configDir,
      AGENT_ORANGE_TEST_MODE: "1",
    },
    stdio: "inherit",
    detached: false,
  })
  startedLocally = true

  const maxAttempts = 40
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await isServerUp()) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error("Server did not become healthy in time")
}

async function createGitProject(name: string) {
  const repoRoot = await fs.mkdtemp(path.join(await tmpRootPromise, `${name}-`))
  tempPaths.push(repoRoot)

  const runGit = async (...args: string[]) => {
    await execFileAsync("git", args, { cwd: repoRoot })
  }

  await runGit("init")
  await runGit("config", "user.email", "test@example.com")
  await runGit("config", "user.name", "Integration Test")

  await fs.writeFile(path.join(repoRoot, "README.md"), "# integration\n")
  await runGit("add", "README.md")
  await runGit("commit", "-m", "Initial commit")

  return repoRoot
}

describe("Integration: server health", () => {
  beforeAll(async () => {
    await ensureServerStarted()
  })

  afterAll(async () => {
    if (child) {
      try {
        child.kill("SIGKILL")
      } catch {}
      child = undefined
    }
    if (startedLocally) {
      await Promise.race([
        killPort(PORT, "tcp").catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ])
      startedLocally = false
    }
    await Promise.race([
      Promise.all(tempPaths.map((p) => fs.rm(p, { recursive: true, force: true }))).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ])
  })

  it("responds to /api/health", async () => {
    const response = await fetch(`${BASE_URL}/api/health`)
    expect(response.status).to.equal(200)
    const json = await response.json()
    expect(json.status).to.equal("ok")
  })

  it("reports readiness and tool metadata", async () => {
    const response = await fetch(`${BASE_URL}/api/health/ready`)
    expect(response.status).to.equal(200)
    const json = await response.json()
    expect(json.status).to.equal("ready")
    expect(json.cli).to.have.property("totalTools")
  })

  it("creates projects and manages worktrees", async () => {
    const repoPath = await createGitProject("opengui-repo")

    const addProjectResponse = await fetch(`${BASE_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: repoPath, name: "Integration Project" }),
    })
    expect(addProjectResponse.status).to.equal(200)
    const project = await addProjectResponse.json() as { id: string }
    expect(project.id).to.be.a("string")

    const projectId = project.id

    const worktreePath = path.join(repoPath, "worktrees", "feature-int")
    const createPayload = {
      path: worktreePath,
      title: "Feature Integration",
      branch: "feature/integration",
      createBranch: true,
      baseRef: "HEAD",
    }
    const createWorktreeResponse = await fetch(`${BASE_URL}/api/projects/${projectId}/worktrees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    })
    expect(createWorktreeResponse.status).to.equal(201)
    const rawResponse = await createWorktreeResponse.text()
    const createdWorktree = JSON.parse(rawResponse) as {
      id: string
      title: string
      branch?: string
    }
    const listResponse = await fetch(`${BASE_URL}/api/projects/${projectId}/worktrees`)
    await listResponse.json()
    expect(createdWorktree.title).to.equal(
      "Feature Integration",
      "worktree response should echo the friendly title we requested"
    )
    expect(createdWorktree.branch).to.equal("feature/integration")

    const renameResponse = await fetch(
      `${BASE_URL}/api/projects/${projectId}/worktrees/${createdWorktree.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Feature Renamed" }),
      }
    )
    expect(renameResponse.status).to.equal(200)
    const renamed = await renameResponse.json() as { title: string }
    expect(renamed.title).to.equal("Feature Renamed")

    const deleteWorktreeResponse = await fetch(
      `${BASE_URL}/api/projects/${projectId}/worktrees/${createdWorktree.id}?force=true`,
      { method: "DELETE" }
    )
    expect(deleteWorktreeResponse.status).to.equal(200)
    const deleteJson = await deleteWorktreeResponse.json()
    expect(deleteJson.success).to.equal(true)

    const deleteProjectResponse = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
      method: "DELETE",
    })
    expect(deleteProjectResponse.status).to.equal(200)
    const deleteProjectJson = await deleteProjectResponse.json()
    expect(deleteProjectJson.success).to.equal(true)
  })
})

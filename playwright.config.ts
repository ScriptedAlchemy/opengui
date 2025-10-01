import { defineConfig, devices } from "@playwright/test"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

// Pick a stable port across workers using a small file lock
const pick = () => {
  const f = path.join(process.cwd(), "test", ".e2e-port")
  if (fs.existsSync(f)) {
    const t = fs.readFileSync(f, "utf8").trim()
    const x = parseInt(t)
    if (x > 0 && x < 65536) return x
  }
  const v = parseInt(process.env.PORT || "0")
  if (v > 0 && v < 65536) {
    fs.mkdirSync(path.dirname(f), { recursive: true })
    fs.writeFileSync(f, String(v))
    return v
  }
  const n = 40000 + Math.floor(Math.random() * 10000)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, String(n))
  return n
}

const port = pick()

// Proactively free the selected port in case a manual dev server is still running.
try {
  execSync(`npx kill-port ${port}`, { stdio: "ignore" })
} catch {
  // ignore errors (port may already be free)
}
const host = "127.0.0.1"
const base = `http://${host}:${port}`


export default defineConfig({
  // Include all e2e-style specs across subfolders (e2e + visual)
  testDir: "./test",
  testMatch: "**/*.e2e.ts",
  // Store snapshot baselines in a clearly named folder at repo root
  snapshotDir: "ui-screens",

  // Set default timeout to 90 seconds for stability under load
  timeout: 120000,

  // Fail fast on CI
  // Enable more parallelism for faster test execution
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  maxFailures: 1,

  // Quieter reporter locally
  reporter: process.env.CI ? "github" : "line",

  // Shared settings for all projects
  use: {
    baseURL: base,
    trace: "on",
    screenshot: "on",
    // Increased timeouts for OpenCode instance startup
    navigationTimeout: 60000,
    actionTimeout: 30000,
  },

  // Configure projects for different browsers
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
})

import { defineConfig, devices } from "@playwright/test"
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
const host = "127.0.0.1"
const base = `http://${host}:${port}`

const enableHd = process.env.E2E_HD === "1"

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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 2,
  maxFailures: 5,

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
    ...(enableHd
      ? [
          {
            name: "chromium-hd",
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1600, height: 1000 },
              deviceScaleFactor: 2,
            },
          },
        ]
      : []),
  ],

  // Use production build for E2E tests to avoid any HMR/dev server behavior
  webServer: {
    command: "pnpm run dev",
    url: base,
    reuseExistingServer: true,
    timeout: 120000,
    stdout: "pipe",
    stderr: "pipe",
    env: { PORT: String(port), HOST: host, NODE_ENV: "production", LOG_LEVEL: "warn" },
  },
})

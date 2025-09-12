#!/usr/bin/env node

/**
 * OpenCode Web UI Test Runner
 *
 * Wrapper around rstest that provides server pool support and test categorization.
 *
 * Usage examples:
 *   npm test                       # Run all discovered tests
 *   npm run test:components        # Run tests under test/components
 *   npm run test:integration       # Run integration tests
 *   npm test -- --watch --coverage # Watch mode with coverage
 */

import { TestServerPool } from "./integration/test-helpers"
import { readdirSync, statSync } from 'fs'
import { join, extname } from 'path'
import { spawn } from 'child_process'

const tdir = __dirname
const wdir = join(tdir, '..')
const pool = { cur: null as TestServerPool | null }

function findTestFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir)
  
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    
    if (stat.isDirectory()) {
      // Skip node_modules, dist, build directories
      if (!['node_modules', 'dist', 'build', '.git'].includes(item)) {
        findTestFiles(fullPath, files)
      }
    } else if (stat.isFile()) {
      // Check if it's a test file
      if (item.includes('.test.') && (extname(item) === '.ts' || extname(item) === '.tsx')) {
        files.push(fullPath.replace(tdir + '/', ''))
      }
    }
  }
  
  return files
}

async function main(): Promise<void> {
  // discover test files per directory
  const all = findTestFiles(tdir).sort()
  const map = new Map<string, string[]>()
  for (const p of all) {
    const seg = p.split("/")
    const key = seg.length > 1 ? seg[0] : "root"
    const list = map.get(key) || []
    list.push(p)
    map.set(key, list)
  }

  // parse args (category + options)
  const argv = process.argv.slice(2)
  const opts = argv.filter((a) => a.startsWith("--"))
  const rawCat = argv.find((a) => !a.startsWith("--"))
  const norm = rawCat ? rawCat.replace(/\/+$/, "") : undefined
  const cat = norm && map.has(norm) ? norm : undefined

  if (opts.includes("--help") || opts.includes("-h")) {
    const cats = Array.from(map.keys())
      .filter((k) => k !== "root")
      .sort()
    console.log(
      `\nOpenCode Test Runner (rstest)\n\nUsage:\n  npm test [category] [options]\n\nCategories:\n  ${cats.join(", ")}\n\nOptions:\n  --watch         Run tests in watch mode\n  --coverage      Run with coverage reporting\n  --pool          Use server pool for integration tests (faster)\n  --verbose       Verbose test output\n  --debug         Enable debug logging\n  --help, -h      Show this help\n\nExamples:\n  npm test                          # Run all tests\n  npm run test:integration          # Run integration tests\n  npm run test:components           # Run component tests\n  npm test -- --watch --coverage    # Watch mode with coverage\n`,
    )
    return
  }

  const files = cat ? map.get(cat) || [] : all
  if (files.length === 0) {
    if (cat) console.error(`No tests found for category: ${cat}`)
    process.exit(1)
  }

  const paths = files.map((f) => `${tdir}/${f}`)
  const usePool = opts.includes("--pool")
  const isIntegration = cat === "integration" || files.some((f) => f.includes("integration/"))

  // Only show minimal info when running tests
  if (opts.includes("--verbose")) {
    console.log(`🧪 Running ${files.length} test files...`)
    console.log(`📁 Test directory: ${tdir}`)
    console.log(`🎯 Category: ${cat || "all"}`)
    console.log(`🏊 Server pool: ${usePool && isIntegration ? "enabled" : "disabled"}`)
    console.log(`🔒 Database: MOCKED (no real projects.json access)`)
    console.log("")
  } else {
    console.log("🔒 Using mock database - no real data will be modified")
  }

  const initPool = async () => {
    if (pool.cur) return
    const p = new TestServerPool()
    await p.initialize(3)
    pool.cur = p
  }
  const cleanPool = async () => {
    const p = pool.cur
    if (!p) return
    await p.cleanup()
    pool.cur = null
  }

  if (usePool && isIntegration) {
    console.log("🚀 Initializing server pool...")
    await initPool()
  }

  const env = {
    ...process.env,
    NODE_ENV: "test",
    OPENCODE_TEST_POOL: usePool ? "true" : "false",
    OPENCODE_TEST_LOG_LEVEL: opts.includes("--debug") ? "DEBUG" : "INFO",
  }

  // Build rstest command
  const cmd = ["npx", "rstest"]
  
  // Add test paths if specific category
  if (cat) {
    cmd.push(`test/${cat}`)
  }
  
  // Add rstest options
  const rstestOpts = opts.filter((o) => !["--pool", "--debug", "--verbose"].includes(o))
  cmd.push(...rstestOpts)

  // Run tests using Node.js spawn
  let code = 0
  
  function runCommand(command: string[]): Promise<number> {
    return new Promise((resolve) => {
      if (opts.includes("--verbose")) {
        console.log(`Running: ${command.join(" ")}`)
      }
      
      const proc = spawn(command[0], command.slice(1), {
        cwd: wdir,
        stdio: 'inherit',
        env
      })
      
      proc.on('close', (exitCode) => {
        resolve(exitCode || 0)
      })
      
      proc.on('error', (error) => {
        console.error('Failed to start process:', error)
        resolve(1)
      })
    })
  }
  
  code = await runCommand(cmd)

  if (code === 0) {
    console.log("\n" + "=".repeat(60))
    console.log("✅ ALL TESTS PASSED!")
    console.log("=".repeat(60))
  } else {
    console.error("=".repeat(60))
    console.error("❌ TEST FAILURE DETECTED!")
    console.error(`Exit code: ${code}`)
    if (!opts.includes("--no-bail")) {
      console.error("Stopped on first failure (use --no-bail to see all failures)")
    }
    console.error("=".repeat(60))
    process.exit(code)
  }

  if (usePool && isIntegration) {
    console.log("🧹 Cleaning up server pool...")
    await cleanPool()
  }

  process.exit(code)
}

process.on("SIGINT", async () => {
  console.log("\n🛑 Interrupted, cleaning up...")
  if (pool.cur) await pool.cur.cleanup().catch(() => {})
  process.exit(130)
})

process.on("exit", async () => {
  if (pool.cur) await pool.cur.cleanup().catch(() => {})
})

process.on("SIGTERM", async () => {
  console.log("\n🛑 Terminated, cleaning up...")
  if (pool.cur) await pool.cur.cleanup().catch(() => {})
  process.exit(143)
})

// Run the main function
main()

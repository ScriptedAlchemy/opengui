import { test, expect } from "@playwright/test"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"

/**
 * System Endpoints E2E Test
 *
 * Tests system utility endpoints:
 * 1. GET /api/system/home - Returns HOME directory
 * 2. GET /api/system/package-json - Reads package.json
 * 3. GET /api/system/list-directory - Directory listing
 */

test.describe("System Endpoints", () => {
  test("should return HOME directory", async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/system/home`)
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.path).toBeDefined()
    expect(typeof data.path).toBe("string")
    expect(path.isAbsolute(data.path)).toBeTruthy()
  })

  test("should read package.json from project root", async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/system/package-json`, {
      params: {
        path: process.cwd(),
      },
    })
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.packageJson).toBeDefined()
    expect(data.packageJson.name).toBeDefined()
    expect(data.packageJson.version).toBeDefined()
  })

  test("should list directory contents", async ({ request, baseURL }) => {
    // List the home directory
    const homeDir = os.homedir()
    const response = await request.get(`${baseURL}/api/system/list-directory`, {
      params: {
        path: homeDir,
      },
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.entries).toBeDefined()
    expect(Array.isArray(data.entries)).toBeTruthy()

    // Verify structure of directory entries
    if (data.entries.length > 0) {
      const firstEntry = data.entries[0]
      expect(firstEntry.name).toBeDefined()
      expect(firstEntry.isDirectory).toBeDefined()
      expect(typeof firstEntry.isDirectory).toBe("boolean")
    }
  })

  test("should list current working directory", async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/system/list-directory`, {
      params: {
        path: process.cwd(),
      },
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.entries).toBeDefined()
    expect(data.entries.length).toBeGreaterThan(0)

    // Should include common project files
    const fileNames = data.entries.map((e: any) => e.name)
    const hasPackageJson = fileNames.includes("package.json")
    const hasSrcDir = fileNames.includes("src")
    expect(hasPackageJson || hasSrcDir).toBeTruthy()
  })

  test("should reject non-existent directory listing", async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/system/list-directory`, {
      params: {
        path: "/nonexistent/directory/path",
      },
    })

    expect(response.status()).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  test("should list directory with subdirectories", async ({ request, baseURL }) => {
    // Create a temp directory with known structure
    const tempDir = path.join(os.tmpdir(), `opencode-dir-test-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    try {
      // Create subdirectories and files
      fs.mkdirSync(path.join(tempDir, "subdir1"))
      fs.mkdirSync(path.join(tempDir, "subdir2"))
      fs.writeFileSync(path.join(tempDir, "file1.txt"), "test")
      fs.writeFileSync(path.join(tempDir, "file2.md"), "# Test")

      const response = await request.get(`${baseURL}/api/system/list-directory`, {
        params: { path: tempDir },
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      // The list-directory endpoint only returns directories, not files
      expect(data.entries.length).toBeGreaterThanOrEqual(2)

      // All entries should be directories
      const allDirs = data.entries.every((e: any) => e.isDirectory)
      expect(allDirs).toBeTruthy()

      const dirNames = data.entries.map((d: any) => d.name)
      expect(dirNames).toContain("subdir1")
      expect(dirNames).toContain("subdir2")
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
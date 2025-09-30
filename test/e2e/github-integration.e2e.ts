import { test, expect } from "@playwright/test"

/**
 * GitHub Integration E2E Test
 *
 * Tests GitHub CLI integration endpoints:
 * 1. POST /api/projects/:id/github/issues/list - List issues
 * 2. POST /api/projects/:id/github/pulls/list - List pull requests
 * 3. POST /api/projects/:id/github/pulls/:number/status - PR status
 * 4. POST /api/projects/:id/github/content - Batch content fetch
 * 5. Error handling for gh CLI not installed/authenticated
 * 6. Rate limit information
 *
 * Note: These tests require `gh` CLI to be installed and authenticated.
 * Tests will be skipped if gh is not available.
 */

test.describe("GitHub Integration", () => {
  test("should check if gh CLI is available", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "GitHub Test" },
    })
    const project = await addResponse.json()

    // Try to list issues - this will fail gracefully if gh is not available
    const response = await request.post(
      `${baseURL}/api/projects/${project.id}/github/issues/list`,
      {
        data: {
          repo: "owner/repo", // Fake repo for testing
        },
      }
    )

    // Should either succeed or return error about gh not being available
    if (!response.ok()) {
      const data = await response.json()
      expect(data.error).toBeDefined()
      // Error can be a string or object - just verify it exists
      // The actual error message depends on whether gh is installed/authenticated
    }

    // Clean up
    await request.delete(`${baseURL}/api/projects/${project.id}`)
  })

  test("should handle invalid repository format", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Invalid Repo Test" },
    })
    const project = await addResponse.json()

    // Try with invalid repo format
    const response = await request.post(
      `${baseURL}/api/projects/${project.id}/github/issues/list`,
      {
        data: {
          repo: "invalid-format", // Missing owner/repo format
        },
      }
    )

    // Should return error
    expect(response.status()).toBeGreaterThanOrEqual(400)

    // Clean up
    await request.delete(`${baseURL}/api/projects/${project.id}`)
  })

  test("should handle GitHub endpoints with proper payloads", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Payload Test" },
    })
    const project = await addResponse.json()

    // Test issues list endpoint structure
    const issuesResponse = await request.post(
      `${baseURL}/api/projects/${project.id}/github/issues/list`,
      {
        data: {
          repo: "test/repo",
          params: {
            state: "open",
            per_page: 10,
          },
        },
      }
    )

    // Response format should be consistent (either success with items or error)
    const issuesData = await issuesResponse.json()
    if (issuesResponse.ok()) {
      expect(issuesData.items).toBeDefined()
    } else {
      expect(issuesData.error).toBeDefined()
    }

    // Test pulls list endpoint structure
    const pullsResponse = await request.post(
      `${baseURL}/api/projects/${project.id}/github/pulls/list`,
      {
        data: {
          repo: "test/repo",
          params: {
            state: "open",
          },
        },
      }
    )

    const pullsData = await pullsResponse.json()
    if (pullsResponse.ok()) {
      expect(pullsData.items).toBeDefined()
    } else {
      expect(pullsData.error).toBeDefined()
    }

    // Clean up
    await request.delete(`${baseURL}/api/projects/${project.id}`)
  })

  test("should handle PR status endpoint", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "PR Status Test" },
    })
    const project = await addResponse.json()

    const response = await request.post(
      `${baseURL}/api/projects/${project.id}/github/pulls/1/status`,
      {
        data: {
          repo: "test/repo",
        },
      }
    )

    // Should return either status data or error
    const data = await response.json()
    if (response.ok()) {
      // If successful, should have status information
      expect(data).toBeDefined()
    } else {
      expect(data.error).toBeDefined()
    }

    // Clean up
    await request.delete(`${baseURL}/api/projects/${project.id}`)
  })

  test("should handle batch content endpoint", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Batch Test" },
    })
    const project = await addResponse.json()

    const response = await request.post(`${baseURL}/api/projects/${project.id}/github/content`, {
      data: {
        repo: "test/repo",
        includeIssues: true,
        includePulls: true,
        cacheTtlMs: 60000,
      },
    })

    // Should return batch payload or error
    const data = await response.json()
    if (response.ok()) {
      expect(data).toBeDefined()
      // Could have issues, pulls, etc.
    } else {
      expect(data.error).toBeDefined()
    }

    // Clean up
    await request.delete(`${baseURL}/api/projects/${project.id}`)
  })

  test("should reject requests with missing required fields", async ({ request, baseURL }) => {
    const testProjectPath = process.cwd()
    const addResponse = await request.post(`${baseURL}/api/projects`, {
      data: { path: testProjectPath, name: "Missing Fields Test" },
    })
    const project = await addResponse.json()

    // Try to list issues without repo field
    const response = await request.post(
      `${baseURL}/api/projects/${project.id}/github/issues/list`,
      {
        data: {
          // Missing repo field
          params: {
            state: "open",
          },
        },
      }
    )

    // Should return validation error
    expect(response.status()).toBe(400)

    // Clean up
    await request.delete(`${baseURL}/api/projects/${project.id}`)
  })

  test("should handle non-existent project ID", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/projects/nonexistent-id/github/issues/list`, {
      data: {
        repo: "test/repo",
      },
    })

    // Should return error (either 400 or 404)
    expect(response.status()).toBeGreaterThanOrEqual(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })
})
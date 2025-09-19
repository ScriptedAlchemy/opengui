import { describe, test, beforeEach, afterEach, expect, rs } from "@rstest/core"
import { tmpdir } from "node:os"
import path from "node:path"
import * as fs from "node:fs/promises"

const repoRef = { owner: "mock", repo: "repo" }

const issueFixture = {
  id: 1010,
  number: 101,
  title: "Investigate flaky tests",
  state: "open" as const,
  html_url: "https://github.com/mock/repo/issues/101",
  body: "Issue body",
  created_at: "2025-02-01T16:30:00Z",
  updated_at: "2025-02-01T16:30:00Z",
  labels: [],
  assignees: [],
  user: {
    id: 200,
    login: "alice",
    avatar_url: "https://avatars.example.com/u/alice",
    html_url: "https://github.com/alice",
  },
}

const pullFixture = {
  id: 4242,
  number: 42,
  title: "Fix failing pipeline",
  state: "open" as const,
  draft: false,
  html_url: "https://github.com/mock/repo/pull/42",
  body: "Pull request body",
  created_at: "2025-02-02T08:15:00Z",
  updated_at: "2025-02-02T08:15:00Z",
  merged_at: null,
  user: {
    id: 201,
    login: "bob",
    avatar_url: "https://avatars.example.com/u/bob",
    html_url: "https://github.com/bob",
  },
  head: { sha: "sha-42", ref: "feature/fix-ci", label: "mock:feature/fix-ci" },
  base: { sha: "base-sha", ref: "main", label: "mock:main" },
}

const issueComments = [
  {
    id: 6001,
    body: "Issue comment",
    html_url: "https://github.com/mock/repo/issues/101#issuecomment-6001",
    created_at: "2025-02-03T10:20:00Z",
    updated_at: "2025-02-03T10:20:00Z",
    user: issueFixture.user,
  },
]

const pullComments = [
  {
    id: 6101,
    body: "PR comment",
    html_url: "https://github.com/mock/repo/pull/42#issuecomment-6101",
    created_at: "2025-02-03T12:45:00Z",
    updated_at: "2025-02-03T12:45:00Z",
    user: pullFixture.user,
  },
]

const pullReviewComments = [
  {
    id: 6201,
    body: "Review comment",
    html_url: "https://github.com/mock/repo/pull/42#discussion-6201",
    diff_hunk: "@@ -1 +1 @@",
    path: "src/index.ts",
    commit_id: pullFixture.head.sha,
    original_commit_id: pullFixture.head.sha,
    created_at: "2025-02-03T13:00:00Z",
    updated_at: "2025-02-03T13:00:00Z",
    user: pullFixture.user,
  },
]

type MockClientMode = "success" | "cliMissing" | "resourceNotFound"

let mockClientMode: MockClientMode = "success"
let resourceNotFoundTracker: { issueCalls: number } | null = null

interface ClientCallMetrics {
  issueCalls: number
  issueCommentCalls: number
  pullCalls: number
  pullCommentCalls: number
  reviewCommentCalls: number
}

type GhErrorWithStderr = Error & { stderr?: string }

function createEmptyMetrics(): ClientCallMetrics {
  return {
    issueCalls: 0,
    issueCommentCalls: 0,
    pullCalls: 0,
    pullCommentCalls: 0,
    reviewCommentCalls: 0,
  }
}

let successClientMetrics: ClientCallMetrics = createEmptyMetrics()

function setMockClientMode(mode: MockClientMode) {
  mockClientMode = mode
}

function setResourceNotFoundTracker(tracker: { issueCalls: number } | null) {
  resourceNotFoundTracker = tracker
}

type GhErrorClasses = {
  cli: typeof Error
  notInstalled: typeof Error
  notAuthenticated: typeof Error
}

function createGhErrorClasses(): GhErrorClasses {
  class LocalGhCliError extends Error {}
  class LocalGhNotInstalledError extends LocalGhCliError {}
  class LocalGhNotAuthenticatedError extends LocalGhCliError {}

  return {
    cli: LocalGhCliError,
    notInstalled: LocalGhNotInstalledError,
    notAuthenticated: LocalGhNotAuthenticatedError,
  }
}

function resetGhErrorClasses(): GhErrorClasses {
  const classes = createGhErrorClasses()
  ;(globalThis as Record<PropertyKey, unknown>)["__opencodeGithubCacheGhErrors__"] = classes
  return classes
}

function getGhErrorClasses(): GhErrorClasses {
  const current = (globalThis as Record<PropertyKey, unknown>)["__opencodeGithubCacheGhErrors__"] as
    | GhErrorClasses
    | undefined
  if (current) {
    return current
  }
  return resetGhErrorClasses()
}

function createMockGitHubClient(ghErrors: GhErrorClasses) {
  const baseRateLimit = {
    core: {
      limit: 5000,
      remaining: 4900,
      used: 100,
      resetAt: new Date("2025-02-03T15:00:00Z").toISOString(),
    },
  }

  if (mockClientMode === "cliMissing") {
    return {
      getIssue: async () => {
        throw new ghErrors.notInstalled()
      },
      fetchIssueComments: async () => {
        throw new ghErrors.notInstalled()
      },
      getPullRequest: async () => {
        throw new ghErrors.notInstalled()
      },
      fetchPullRequestComments: async () => {
        throw new ghErrors.notInstalled()
      },
      fetchPullRequestReviewComments: async () => {
        throw new ghErrors.notInstalled()
      },
      getPullRequestStatus: async () => {
        throw new ghErrors.notInstalled()
      },
      getRateLimit: () => baseRateLimit,
    }
  }

  if (mockClientMode === "resourceNotFound") {
    const buildNotFoundError = () => {
      const error = new ghErrors.cli("HTTP 404: Not Found") as GhErrorWithStderr
      error.stderr = "HTTP 404: Not Found"
      return error
    }

    return {
      getIssue: async () => {
        if (resourceNotFoundTracker) {
          resourceNotFoundTracker.issueCalls += 1
        }
        throw buildNotFoundError()
      },
      fetchIssueComments: async () => {
        throw buildNotFoundError()
      },
      getPullRequest: async () => {
        throw buildNotFoundError()
      },
      fetchPullRequestComments: async () => {
        throw buildNotFoundError()
      },
      fetchPullRequestReviewComments: async () => {
        throw buildNotFoundError()
      },
      getPullRequestStatus: async () => {
        throw buildNotFoundError()
      },
      getRateLimit: () => baseRateLimit,
    }
  }

  return {
    getIssue: async () => {
      successClientMetrics.issueCalls += 1
      return issueFixture
    },
    fetchIssueComments: async () => {
      successClientMetrics.issueCommentCalls += 1
      return issueComments
    },
    getPullRequest: async () => {
      successClientMetrics.pullCalls += 1
      return pullFixture
    },
    fetchPullRequestComments: async () => {
      successClientMetrics.pullCommentCalls += 1
      return pullComments
    },
    fetchPullRequestReviewComments: async () => {
      successClientMetrics.reviewCommentCalls += 1
      return pullReviewComments
    },
    getPullRequestStatus: async () => ({
      sha: pullFixture.head.sha,
      overallState: "success" as const,
    }),
    getRateLimit: () => baseRateLimit,
  }
}

describe("GitHub cache", () => {
  let cacheDir: string
  let originalCacheEnv: string | undefined
  let mocks: {
    issueCalls: number
    issueCommentCalls: number
    pullCalls: number
    pullCommentCalls: number
    reviewCommentCalls: number
  }

  beforeEach(async () => {
    cacheDir = path.join(tmpdir(), `opencode-github-cache-${Math.random().toString(36).slice(2)}`)
    await fs.rm(cacheDir, { recursive: true, force: true })
    await fs.mkdir(cacheDir, { recursive: true })
    originalCacheEnv = process.env.OPENCODE_GITHUB_CACHE_DIR
    process.env.OPENCODE_GITHUB_CACHE_DIR = cacheDir

    successClientMetrics = createEmptyMetrics()
    mocks = successClientMetrics

    setMockClientMode("success")
    setResourceNotFoundTracker(null)
    resetGhErrorClasses()

    rs.mock("../../src/server/github/client", () => {
      const ghErrors = getGhErrorClasses()

      return {
        createServerGitHubClient: () => createMockGitHubClient(ghErrors),
        GhCliError: ghErrors.cli,
        GhNotInstalledError: ghErrors.notInstalled,
        GhNotAuthenticatedError: ghErrors.notAuthenticated,
      }
    })
  })

  afterEach(async () => {
    rs.resetModules()
    await fs.rm(cacheDir, { recursive: true, force: true }).catch(() => {})
    if (originalCacheEnv !== undefined) {
      process.env.OPENCODE_GITHUB_CACHE_DIR = originalCacheEnv
    } else {
      delete process.env.OPENCODE_GITHUB_CACHE_DIR
    }
  })

  test("returns cached data when updated_at matches", async () => {
    const { fetchGitHubContentBatch, __resetGitHubCacheForTesting } = await rs.importActual<
      typeof import("../../src/server/github/cache")
    >("../../src/server/github/cache")

    __resetGitHubCacheForTesting()

    const first = await fetchGitHubContentBatch({
      repo: repoRef,
      items: [{ type: "issue", number: 101, updatedAt: issueFixture.updated_at }],
    })

    expect(first.items).toHaveLength(1)
    expect(first.items[0].cached).toBe(false)
    expect(mocks.issueCalls).toBe(1)
    expect(mocks.issueCommentCalls).toBe(1)
    expect(first.meta.cacheMisses).toBe(1)
    expect(first.meta.cacheHits).toBe(0)
    expect(first.meta.errorHits).toBe(0)
    expect(first.issues).toHaveLength(1)
    expect(first.issues[0].number).toBe(101)
    expect(Object.keys(first.statuses)).toHaveLength(0)

    const second = await fetchGitHubContentBatch({
      repo: repoRef,
      items: [{ type: "issue", number: 101, updatedAt: issueFixture.updated_at }],
    })

    expect(second.items).toHaveLength(1)
    expect(second.items[0].cached).toBe(true)
    expect(second.items[0].stale).toBe(false)
    expect(mocks.issueCalls).toBe(1)
    expect(mocks.issueCommentCalls).toBe(1)
    expect(second.meta.cacheHits).toBe(1)
    expect(second.meta.cacheMisses).toBe(0)
    expect(second.meta.errorHits).toBe(0)

    const third = await fetchGitHubContentBatch({
      repo: repoRef,
      items: [{ type: "issue", number: 101, updatedAt: "2025-02-04T10:00:00Z" }],
    })

    expect(third.items[0].cached).toBe(false)
    expect(mocks.issueCalls).toBe(2)
    expect(mocks.issueCommentCalls).toBe(2)
    expect(third.meta.cacheMisses).toBe(1)
    expect(third.meta.refreshed).toBeGreaterThanOrEqual(1)
    expect(third.meta.errorHits).toBe(0)

    const cacheFiles = await fs.readdir(cacheDir, { recursive: true })
    expect(cacheFiles.some((file) => file.endsWith("issue-101.json"))).toBe(true)
  })

  test("caches pull request comments and review comments", async () => {
    const { fetchGitHubContentBatch, __resetGitHubCacheForTesting } = await rs.importActual<
      typeof import("../../src/server/github/cache")
    >("../../src/server/github/cache")

    __resetGitHubCacheForTesting()

    const result = await fetchGitHubContentBatch({
      repo: repoRef,
      items: [{ type: "pull", number: 42, updatedAt: pullFixture.updated_at }],
    })

    expect(result.items).toHaveLength(1)
    const item = result.items[0]
    expect(item.comments).toHaveLength(1)
    expect(item.reviewComments).toHaveLength(1)
    expect(item.status?.overallState).toBe("success")
    expect(result.statuses[42]?.overallState).toBe("success")
    expect(mocks.pullCalls).toBe(1)
    expect(mocks.pullCommentCalls).toBe(1)
    expect(mocks.reviewCommentCalls).toBe(1)
    expect(result.meta.cacheMisses).toBe(1)
    expect(result.meta.errorHits).toBe(0)

    const subsequent = await fetchGitHubContentBatch({
      repo: repoRef,
      items: [{ type: "pull", number: 42, updatedAt: pullFixture.updated_at }],
    })

    expect(subsequent.items[0].cached).toBe(true)
    expect(mocks.pullCalls).toBe(1)
    expect(mocks.pullCommentCalls).toBe(1)
    expect(mocks.reviewCommentCalls).toBe(1)
    expect(subsequent.items[0].status?.overallState).toBe("success")
    expect(subsequent.meta.cacheHits).toBe(1)
    expect(subsequent.meta.errorHits).toBe(0)
  })

  test("returns descriptive error when gh cli is unavailable", async () => {
    setMockClientMode("cliMissing")

    const { fetchGitHubContentBatch, __resetGitHubCacheForTesting } = await rs.importActual<
      typeof import("../../src/server/github/cache")
    >("../../src/server/github/cache")

    __resetGitHubCacheForTesting()

    const result = await fetchGitHubContentBatch({
      repo: repoRef,
      items: [{ type: "issue", number: 101 }],
    })

    expect(result.items).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain("GitHub CLI (gh) is not installed")
  })

  test("caches not found errors for a short period", async () => {
    const tracker = { issueCalls: 0 }
    setResourceNotFoundTracker(tracker)
    setMockClientMode("resourceNotFound")

    const { fetchGitHubContentBatch, __resetGitHubCacheForTesting } = await rs.importActual<
      typeof import("../../src/server/github/cache")
    >("../../src/server/github/cache")

    __resetGitHubCacheForTesting()

    const first = await fetchGitHubContentBatch({
      repo: repoRef,
      items: [{ type: "issue", number: 999 }],
    })

    expect(first.errors).toHaveLength(1)
    expect(first.errors[0]).toMatchObject({
      type: "issue",
      number: 999,
      status: 404,
      cached: false,
    })
    expect(first.meta.cacheMisses).toBe(1)
    expect(first.meta.errorHits).toBe(0)
    expect(tracker.issueCalls).toBe(1)

    const second = await fetchGitHubContentBatch({
      repo: repoRef,
      items: [{ type: "issue", number: 999 }],
    })

    expect(second.errors).toHaveLength(1)
    expect(second.errors[0]).toMatchObject({
      type: "issue",
      number: 999,
      cached: true,
      status: 404,
    })
    expect(second.meta.cacheMisses).toBe(0)
    expect(second.meta.errorHits).toBe(1)
    expect(tracker.issueCalls).toBe(1)
  })
})

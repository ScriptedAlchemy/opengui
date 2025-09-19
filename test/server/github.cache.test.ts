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

let MockGhCliError: typeof Error
let MockGhNotInstalledError: typeof Error
let MockGhNotAuthenticatedError: typeof Error

  beforeEach(async () => {
    cacheDir = path.join(tmpdir(), `opencode-github-cache-${Math.random().toString(36).slice(2)}`)
    await fs.rm(cacheDir, { recursive: true, force: true })
    await fs.mkdir(cacheDir, { recursive: true })
    originalCacheEnv = process.env.OPENCODE_GITHUB_CACHE_DIR
    process.env.OPENCODE_GITHUB_CACHE_DIR = cacheDir

    mocks = {
      issueCalls: 0,
      issueCommentCalls: 0,
      pullCalls: 0,
      pullCommentCalls: 0,
      reviewCommentCalls: 0,
    }

    class LocalGhCliError extends Error {}
    class LocalGhNotInstalledError extends LocalGhCliError {}
    class LocalGhNotAuthenticatedError extends LocalGhCliError {}

    MockGhCliError = LocalGhCliError
    MockGhNotInstalledError = LocalGhNotInstalledError
    MockGhNotAuthenticatedError = LocalGhNotAuthenticatedError

    rs.mock("../../src/server/github/client", () => ({
      createServerGitHubClient: () => ({
        getIssue: async () => {
          mocks.issueCalls += 1
          return issueFixture
        },
        fetchIssueComments: async () => {
          mocks.issueCommentCalls += 1
          return issueComments
        },
        getPullRequest: async () => {
          mocks.pullCalls += 1
          return pullFixture
        },
        fetchPullRequestComments: async () => {
          mocks.pullCommentCalls += 1
          return pullComments
        },
        fetchPullRequestReviewComments: async () => {
          mocks.reviewCommentCalls += 1
          return pullReviewComments
        },
      }),
      GhCliError: LocalGhCliError,
      GhNotInstalledError: LocalGhNotInstalledError,
      GhNotAuthenticatedError: LocalGhNotAuthenticatedError,
    }))
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

    const second = await fetchGitHubContentBatch({
      repo: repoRef,
      items: [{ type: "issue", number: 101, updatedAt: issueFixture.updated_at }],
    })

    expect(second.items).toHaveLength(1)
    expect(second.items[0].cached).toBe(true)
    expect(second.items[0].stale).toBe(false)
    expect(mocks.issueCalls).toBe(1)
    expect(mocks.issueCommentCalls).toBe(1)

    const third = await fetchGitHubContentBatch({
      repo: repoRef,
      items: [{ type: "issue", number: 101, updatedAt: "2025-02-04T10:00:00Z" }],
    })

    expect(third.items[0].cached).toBe(false)
    expect(mocks.issueCalls).toBe(2)
    expect(mocks.issueCommentCalls).toBe(2)

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
    expect(mocks.pullCalls).toBe(1)
    expect(mocks.pullCommentCalls).toBe(1)
    expect(mocks.reviewCommentCalls).toBe(1)

    const subsequent = await fetchGitHubContentBatch({
      repo: repoRef,
      items: [{ type: "pull", number: 42, updatedAt: pullFixture.updated_at }],
    })

    expect(subsequent.items[0].cached).toBe(true)
    expect(mocks.pullCalls).toBe(1)
    expect(mocks.pullCommentCalls).toBe(1)
    expect(mocks.reviewCommentCalls).toBe(1)
  })

  test("returns descriptive error when gh cli is unavailable", async () => {
    rs.resetModules()

    rs.mock("../../src/server/github/client", () => ({
      createServerGitHubClient: () => ({
        getIssue: async () => {
          throw new MockGhNotInstalledError("gh missing")
        },
        fetchIssueComments: async () => {
          throw new MockGhNotInstalledError("gh missing")
        },
        getPullRequest: async () => {
          throw new MockGhNotInstalledError("gh missing")
        },
        fetchPullRequestComments: async () => {
          throw new MockGhNotInstalledError("gh missing")
        },
        fetchPullRequestReviewComments: async () => {
          throw new MockGhNotInstalledError("gh missing")
        },
      }),
      GhCliError: MockGhCliError,
      GhNotInstalledError: MockGhNotInstalledError,
      GhNotAuthenticatedError: MockGhNotAuthenticatedError,
    }))

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
})

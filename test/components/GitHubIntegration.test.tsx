import React from "react"
import { describe, test, beforeEach, afterEach, expect, rstest } from "@rstest/core"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Worktree } from "@/lib/api/project-manager"
import type { GitStatusResponse } from "@/lib/git"
import { UNSAFE_NavigationContext } from "react-router-dom"
import { renderWithRouter } from "../utils/test-router"
type GitHubIntegrationComponent = (typeof import("../../src/pages/GitHubIntegration"))["default"]

let GitHubIntegration: GitHubIntegrationComponent

const mockNavigate = rstest.fn((path?: string) => path)
const mockCreateWorktree = rstest.fn(
  async (projectId: string, params: { branch: string; path: string; title: string }) => {
    const sanitizedId = params.branch.replace(/[\\/\s]+/g, "-")
    const worktree: Worktree = {
      id: `wt-${sanitizedId}`,
      title: params.title,
      path: params.path,
      relativePath: params.path,
      branch: params.branch,
      head: `${params.branch}-head`,
      isPrimary: false,
      isDetached: false,
      isLocked: false,
    }
    return worktree
  }
)
const mockCreateSession = rstest.fn(
  async (projectId: string, worktreePath: string, title?: string) => {
    return {
      id: "session-123",
      title,
      projectID: projectId,
      directory: worktreePath,
      version: "1",
      time: { created: Date.now() / 1000, updated: Date.now() / 1000 },
    }
  }
)

const mockProject = {
  id: "test-project",
  name: "Test Project",
  path: "/project",
  type: "git" as const,
  addedAt: new Date("2025-01-01T12:00:00Z").toISOString(),
  lastOpened: new Date("2025-01-02T12:00:00Z").toISOString(),
}

const gitStatusResponse: GitStatusResponse = {
  branch: "main",
  ahead: 0,
  behind: 0,
  changedFiles: 0,
  stagedCount: 0,
  unstagedCount: 0,
  untrackedCount: 0,
  staged: [],
  modified: [],
  untracked: [],
  remoteUrl: "git@github.com:mock/repo.git",
}

const mockFetchGitStatus = rstest.fn(async () => gitStatusResponse)

const issueOpenedAt = new Date("2025-02-01T16:30:00Z").toISOString()
const pullUpdatedAt = new Date("2025-02-02T08:15:00Z").toISOString()

const githubIssues = [
  {
    id: 1010,
    number: 101,
    title: "Investigate flaky tests",
    state: "open" as const,
    html_url: "https://github.com/mock/repo/issues/101",
    body: "**Summary**\\n\\n- Intermittent failures observed during nightly runs\\n- `rsbuild` job flapping intermittently\\n\\nSee the [debug logs](https://example.com/logs) for raw output.",
    created_at: issueOpenedAt,
    updated_at: issueOpenedAt,
    labels: [
      { id: 1, name: "bug", color: "d73a4a", description: "Bug" },
      { id: 2, name: "priority: high", color: "b60205" },
    ],
    assignees: [],
    user: {
      id: 200,
      login: "alice",
      avatar_url: "https://avatars.example.com/u/alice",
      html_url: "https://github.com/alice",
    },
  },
]

const failingPrSha = "sha-42"
const passingPrSha = "sha-43"

const pullRequests = [
  {
    id: 4242,
    number: 42,
    title: "Fix failing pipeline",
    state: "open" as const,
    draft: false,
    html_url: "https://github.com/mock/repo/pull/42",
    body: "Resolves failing CI jobs.\\n\\n![Status chart](https://example.com/status-chart.png)",
    created_at: pullUpdatedAt,
    updated_at: pullUpdatedAt,
    merged_at: null,
    user: {
      id: 201,
      login: "bob",
      avatar_url: "https://avatars.example.com/u/bob",
      html_url: "https://github.com/bob",
    },
    head: { sha: failingPrSha, ref: "feature/fix-ci", label: "mock:feature/fix-ci" },
    base: { sha: "base-sha", ref: "main", label: "mock:main" },
    labels: [{ id: 3, name: "ci", color: "0e8a16" }],
  },
  {
    id: 4343,
    number: 43,
    title: "Improve logging",
    state: "open" as const,
    draft: false,
    html_url: "https://github.com/mock/repo/pull/43",
    body: "Adds structured logging with JSON output",
    created_at: pullUpdatedAt,
    updated_at: pullUpdatedAt,
    merged_at: null,
    user: {
      id: 202,
      login: "carol",
      avatar_url: "https://avatars.example.com/u/carol",
      html_url: "https://github.com/carol",
    },
    head: { sha: passingPrSha, ref: "feature/logging", label: "mock:feature/logging" },
    base: { sha: "base-sha", ref: "main", label: "mock:main" },
    labels: [{ id: 4, name: "enhancement", color: "a2eeef" }],
  },
]

const pullDetails = Object.fromEntries(pullRequests.map((pr) => [String(pr.number), pr]))

const issueCommentedAt = new Date("2025-02-03T10:20:00Z").toISOString()
const pullCommentedAt = new Date("2025-02-03T12:45:00Z").toISOString()
const reviewCommentedAt = new Date("2025-02-03T13:00:00Z").toISOString()

const issueCommentsByNumber: Record<number, any[]> = {
  101: [
    {
      id: 6001,
      body: "Reproduced the failure on CI. [View logs](https://ci.example.com/logs/6001).",
      html_url: "https://github.com/mock/repo/issues/101#issuecomment-6001",
      created_at: issueCommentedAt,
      updated_at: issueCommentedAt,
      user: {
        id: 301,
        login: "dave",
        avatar_url: "https://avatars.example.com/u/dave",
        html_url: "https://github.com/dave",
      },
    },
  ],
}

const pullCommentsByNumber: Record<number, any[]> = {
  42: [
    {
      id: 6101,
      body: "Ensured pipelines rerun successfully after this patch. See commit `abc123`.",
      html_url: "https://github.com/mock/repo/pull/42#issuecomment-6101",
      created_at: pullCommentedAt,
      updated_at: pullCommentedAt,
      user: {
        id: 302,
        login: "eve",
        avatar_url: "https://avatars.example.com/u/eve",
        html_url: "https://github.com/eve",
      },
    },
  ],
}

const pullReviewCommentsByNumber: Record<number, any[]> = {
  42: [
    {
      id: 6201,
      body: "Consider guarding against null payloads here.",
      html_url: "https://github.com/mock/repo/pull/42#discussion-6201",
      diff_hunk: "@@ -24,7 +24,9 @@ export function handlePayload(payload) {\n-  process(payload.data)\n+  if (!payload?.data) {\n+    return null\n+  }\n+  process(payload.data)",
      path: "src/services/pipeline.ts",
      commit_id: failingPrSha,
      original_commit_id: failingPrSha,
      created_at: reviewCommentedAt,
      updated_at: reviewCommentedAt,
      user: {
        id: 303,
        login: "frank",
        avatar_url: "https://avatars.example.com/u/frank",
        html_url: "https://github.com/frank",
      },
      original_line: 26,
    },
  ],
}

const pullStatusByNumber: Record<number, { sha: string; overallState: "success" | "failure" | "pending" | "error" }> = {
  42: { sha: failingPrSha, overallState: "failure" },
  43: { sha: passingPrSha, overallState: "success" },
}

const jsonResponse = (data: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers ?? {})
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  })
}

let originalFetch: typeof globalThis.fetch | undefined

const worktreesStoreMock = {
  createWorktree: mockCreateWorktree,
}

rstest.mock("../../src/stores/worktrees", () => ({
  useWorktreesStore: (selector?: (store: typeof worktreesStoreMock) => unknown) =>
    selector ? selector(worktreesStoreMock) : worktreesStoreMock,
}))

rstest.mock("@/stores/worktrees", () => ({
  useWorktreesStore: (selector?: (store: typeof worktreesStoreMock) => unknown) =>
    selector ? selector(worktreesStoreMock) : worktreesStoreMock,
}))

const sessionsStoreMock = {
  createSession: mockCreateSession,
}

rstest.mock("../../src/stores/sessions", () => ({
  useSessionsStore: (selector?: (store: typeof sessionsStoreMock) => unknown) =>
    selector ? selector(sessionsStoreMock) : sessionsStoreMock,
}))

rstest.mock("@/stores/sessions", () => ({
  useSessionsStore: (selector?: (store: typeof sessionsStoreMock) => unknown) =>
    selector ? selector(sessionsStoreMock) : sessionsStoreMock,
}))

rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => mockProject,
}))

rstest.mock("@/stores/projects", () => ({
  useCurrentProject: () => mockProject,
}))

rstest.mock("../../src/lib/git", () => {
  const actual = require("../../src/lib/git")
  return {
    ...actual,
    fetchGitStatus: (...args: Parameters<typeof mockFetchGitStatus>) =>
      mockFetchGitStatus(...args),
  }
})

rstest.mock("@/lib/git", () => {
  const actual = require("../../src/lib/git")
  return {
    ...actual,
    fetchGitStatus: (...args: Parameters<typeof mockFetchGitStatus>) =>
      mockFetchGitStatus(...args),
  }
})

const activeQueryClients: QueryClient[] = []

const NavigationSpy: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigationContext = React.useContext(UNSAFE_NavigationContext)

  React.useEffect(() => {
    if (!navigationContext) {
      return
    }

    const navigator = navigationContext.navigator
    const serializeTo = (to: unknown) => {
      if (typeof to === "string") {
        return to
      }
      if (typeof to === "number") {
        return to.toString()
      }
      if (to && typeof to === "object") {
        const { pathname = "", search = "", hash = "" } = to as {
          pathname?: string
          search?: string
          hash?: string
        }
        return `${pathname}${search}${hash}`
      }
      return String(to)
    }
    const originalPush = navigator.push.bind(navigator)
    const originalReplace = navigator.replace.bind(navigator)

    navigator.push = ((to: any, options?: any) => {
      mockNavigate(serializeTo(to), options)
    }) as typeof navigator.push

    navigator.replace = ((to: any, options?: any) => {
      mockNavigate(serializeTo(to), options)
    }) as typeof navigator.replace

    return () => {
      navigator.push = originalPush
      navigator.replace = originalReplace
    }
  }, [navigationContext])

  return <>{children}</>
}

function renderGitHubIntegration() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  activeQueryClients.push(queryClient)

  return renderWithRouter(
    <NavigationSpy>
      <QueryClientProvider client={queryClient}>
        <GitHubIntegration />
      </QueryClientProvider>
    </NavigationSpy>,
    {
      initialPath: "/projects/test-project/default/github",
      projectId: "test-project",
      worktreeId: "default",
    }
  )
}

describe("GitHubIntegration", () => {
  beforeEach(async () => {
    originalFetch = global.fetch
    const boundDelegate = originalFetch ? originalFetch.bind(globalThis) : undefined

    const scopedFetch: typeof global.fetch = async (input, init) => {
      const methodFromInput =
        typeof Request !== "undefined" && input instanceof Request ? input.method : undefined
      const method = (init?.method ?? methodFromInput ?? "GET").toUpperCase()

      const urlString = (() => {
        if (typeof input === "string") return input
        if (input instanceof URL) return input.href
        if (typeof Request !== "undefined" && input instanceof Request) return input.url
        return String(input)
      })()

      const resolvePathname = () => {
        if (urlString.startsWith("/")) {
          return urlString
        }
        try {
          return new URL(urlString).pathname
        } catch {
          return null
        }
      }

      const pathname = resolvePathname()
      const githubContentPath = `/api/projects/${mockProject.id}/github/content`

      if (pathname === githubContentPath) {
        const rawBody =
          typeof init?.body === "string"
            ? init.body
            : init?.body && typeof (init.body as { toString?: () => string }).toString === "function"
              ? (init.body as { toString: () => string }).toString()
              : ""

        const parsed = rawBody ? JSON.parse(rawBody) : {}
        const requestedItems: Array<{ type: string; number: number; updatedAt?: string }> = parsed.items ?? []
        const includeIssues = parsed.includeIssues
        const includePulls = parsed.includePulls
        const includeStatuses = parsed.includeStatuses !== false

        const fetchedAt = new Date("2025-02-03T14:00:00Z").toISOString()
        const items: any[] = []
        const errors: any[] = []
        const seenKeys = new Set<string>()

        const inferredItems = (() => {
          if (requestedItems.length > 0) {
            return requestedItems
          }
          const issueEntries = includeIssues
            ? githubIssues.map((issue) => ({ type: "issue" as const, number: issue.number, updatedAt: issue.updated_at }))
            : []
          const pullEntries = includePulls
            ? pullRequests.map((pull) => ({ type: "pull" as const, number: pull.number, updatedAt: pull.updated_at }))
            : []
          return [...issueEntries, ...pullEntries]
        })()

        for (const item of inferredItems) {
          const key = `${item.type}:${item.number}`
          if (seenKeys.has(key)) {
            continue
          }
          seenKeys.add(key)

          if (item.type === "issue") {
            const issue = githubIssues.find((candidate) => candidate.number === item.number)
            if (!issue) {
              errors.push({ type: item.type, number: item.number, message: "Issue not found" })
              continue
            }
            items.push({
              type: "issue",
              number: issue.number,
              updatedAt: issue.updated_at,
              fetchedAt,
              cached: false,
              stale: false,
              item: issue,
              comments: issueCommentsByNumber[issue.number] ?? [],
            })
            continue
          }

          const pull = pullDetails[String(item.number)]
          if (!pull) {
            errors.push({ type: item.type, number: item.number, message: "Pull request not found" })
            continue
          }

          items.push({
            type: "pull",
            number: pull.number,
            updatedAt: pull.updated_at,
            fetchedAt,
            cached: false,
            stale: false,
            item: pull,
            comments: pullCommentsByNumber[pull.number] ?? [],
            reviewComments: pullReviewCommentsByNumber[pull.number] ?? [],
            status: includeStatuses ? pullStatusByNumber[pull.number] ?? null : undefined,
          })
        }

        const statuses = includeStatuses
          ? Object.fromEntries(
              Object.entries(pullStatusByNumber).map(([number, status]) => [Number(number), status])
            )
          : {}

        const meta = {
          cacheHits: 0,
          cacheMisses: seenKeys.size,
          refreshed: seenKeys.size,
          staleHits: 0,
          warmed: 0,
          errorHits: 0,
        }

        const rateLimit = {
          fetchedAt,
          core: {
            limit: 5000,
            remaining: 4920,
            used: 80,
            resetAt: new Date("2025-02-03T15:00:00Z").toISOString(),
          },
        }

        return jsonResponse({
          items,
          errors,
          issues: githubIssues,
          pulls: pullRequests,
          statuses,
          meta,
          rateLimit,
        })
      }

      if (!boundDelegate) {
        throw new Error(`Unhandled fetch request: ${method} ${urlString}`)
      }

      return boundDelegate(input, init)
    }

    global.fetch = scopedFetch

    mockNavigate.mockClear()
    mockCreateWorktree.mockClear()
    mockCreateSession.mockClear()
    mockFetchGitStatus.mockClear()
    mockFetchGitStatus.mockImplementation(async () => gitStatusResponse)
    const componentModule = await import("../../src/pages/GitHubIntegration")
    GitHubIntegration = componentModule.default ?? componentModule.GitHubIntegration
  })

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
      originalFetch = undefined
    }
    while (activeQueryClients.length) {
      const client = activeQueryClients.pop()
      client?.clear()
    }
  })

  test("renders GitHub data and handles issue and pull request actions", async () => {
    const user = userEvent.setup()
    renderGitHubIntegration()

    await waitFor(() => {
      expect(screen.getByText("Connected to mock/repo")).toBeDefined()
    })

    const rateLimitIndicator = await screen.findByText(/GitHub API remaining:/i)
    expect(rateLimitIndicator).toHaveTextContent(/4,920\s*\/\s*5,000/i)
    expect(rateLimitIndicator).toHaveTextContent(/reset/i)

    const issuesToggle = screen.getByRole("button", { name: /Issues/i })
    const pullsToggle = screen.getByRole("button", { name: /Pull requests/i })
    expect(issuesToggle).toBeDefined()
    expect(pullsToggle).toBeDefined()

    const issueButton = await screen.findByRole("button", { name: /#101 · Investigate flaky tests/i })
    expect(issueButton).toBeDefined()
    const issueRow = issueButton.parentElement?.parentElement as HTMLElement
    expect(issueRow).toBeDefined()
    expect(within(issueRow).getByRole("button", { name: /Research/i })).toBeDefined()
    expect(within(issueRow).getByRole("button", { name: /Fix with AI/i })).toBeDefined()
    await within(issueRow).findByText(/Intermittent failures observed during nightly runs/i)
    const showMoreButton = within(issueRow).getByRole("button", { name: /Show more/i })
    await user.click(showMoreButton)
    await within(issueRow).findByText(/Reproduced the failure on CI/i)
    const issueLogLink = within(issueRow).getByRole("link", { name: /View logs/i })
    expect(issueLogLink).toHaveAttribute("href", "https://ci.example.com/logs/6001")
    await within(issueRow).findByText(/Commented/i)

    await user.click(pullsToggle)

    const failingTitle = await screen.findByText("#42 · Fix failing pipeline")
    const failingCard = failingTitle.closest('[data-slot="card"]') as HTMLElement
    expect(failingCard).not.toBeNull()
    await within(failingCard).findByText("Checks failed")
    const failingFixButton = within(failingCard).getByRole("button", { name: /Fix with AI/i })
    expect(failingFixButton).toBeDefined()
    await within(failingCard).findByText(/Resolves failing CI jobs/i)
    expect(within(failingCard).getByRole("img", { name: /status chart/i })).toBeDefined()
    await within(failingCard).findByText(/Ensured pipelines rerun successfully after this patch\./i)
    await within(failingCard).findByText(/See commit/i)
    expect(within(failingCard).getByText(/abc123/i)).toBeDefined()
    await within(failingCard).findByText(/Consider guarding against null payloads here\./i)
    await within(failingCard).findByText(/src\/services\/pipeline\.ts/i)

    const passingTitle = await screen.findByText("#43 · Improve logging")
    const passingCard = passingTitle.closest('[data-slot="card"]') as HTMLElement
    expect(passingCard).not.toBeNull()
    await within(passingCard).findByText("Checks passed")
    const waitingButton = within(passingCard).getByRole("button", { name: /Waiting on checks/i })
    expect(waitingButton).toBeDefined()
    expect(waitingButton).toBeDisabled()

    await user.click(failingFixButton)

    await waitFor(() => {
      expect(mockCreateWorktree).toHaveBeenCalledWith(
        "test-project",
        expect.objectContaining({
          branch: "fix/pr-42",
          title: "Fix PR #42",
          path: "worktrees/fix-pr-42",
          createBranch: true,
        })
      )
    })

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith(
        "test-project",
        "worktrees/fix-pr-42",
        expect.stringContaining("Fix PR #42")
      )
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
      const lastCall = mockNavigate.mock.calls[mockNavigate.mock.calls.length - 1]
      expect(lastCall[0]).toContain("/projects/test-project/wt-fix-pr-42/sessions/session-123/chat")
    })

    await user.click(issuesToggle)

    const refreshedIssueButton = await screen.findByRole("button", { name: /#101 · Investigate flaky tests/i })
    const refreshedIssueRow = refreshedIssueButton.parentElement?.parentElement as HTMLElement
    const researchButton = within(refreshedIssueRow).getByRole("button", { name: /Research/i })
    await user.click(researchButton)

    await waitFor(() => {
      expect(mockCreateWorktree).toHaveBeenCalledTimes(2)
    })

    const lastCreateCall = mockCreateWorktree.mock.calls[mockCreateWorktree.mock.calls.length - 1]
    const [, lastCreateParams] = lastCreateCall
    expect(lastCreateParams.branch).toBe("research/issue-101")
    expect(lastCreateParams.path).toBe("worktrees/research-issue-101")
  })
})

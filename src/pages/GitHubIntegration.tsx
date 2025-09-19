import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GitPullRequest,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react"
import {
  fetchGitStatus,
  type GitStatusResponse,
} from "@/lib/git"
import {
  githubApi,
  parseGitHubRemote,
  type GitHubIssue,
  type GitHubPullRequest,
  type GitHubRepoRef,
  type PullRequestStatusSummary,
} from "@/lib/api/github"
import type { GitHubIssueComment, GitHubLabel, GitHubReviewComment } from "@/shared/github-types"
import {
  fetchGitHubContent,
  type GitHubContentBatchResponse,
  type GitHubContentErrorItem,
  type GitHubContentItem,
  type GitHubContentRequestItem,
} from "@/lib/api/github-content"
import { useCurrentProject } from "@/stores/projects"
import { useWorktreesStore } from "@/stores/worktrees"
import { useSessionsStore } from "@/stores/sessions"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

interface PullRequestStatusMap {
  [pullNumber: number]: PullRequestStatusSummary | null
}

const DEFAULT_BRANCH_FALLBACK = "main"
const SESSION_TITLE_MAX = 100

const MARKDOWN_PLUGINS = [remarkGfm]

const MARKDOWN_COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer noopener" className="hover:underline" />
  ),
}

function truncate(text: string, max = SESSION_TITLE_MAX) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function getLabelStyle(label: GitHubLabel) {
  if (!label?.color) {
    return undefined
  }
  const hex = label.color.startsWith("#") ? label.color : `#${label.color}`
  // Simple luminance heuristic for text color contrast
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const textColor = luminance > 0.6 ? "#0f172a" : "#f8fafc"
  return {
    backgroundColor: hex,
    color: textColor,
    borderColor: hex,
  }
}

function buildActionKey(kind: "issue" | "pr", identifier: number, action: string) {
  return `${kind}-${identifier}-${action}`
}

function normalizeBranchName(branch: string) {
  return branch.trim().replace(/\s+/g, "-").toLowerCase()
}

function toWorktreePath(branchName: string) {
  const sanitized = branchName.replace(/[\\/]+/g, "-")
  return `worktrees/${sanitized}`
}

function formatTimestamp(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

interface CommentDisplay
  extends Pick<GitHubIssueComment, "id" | "body" | "html_url" | "created_at" | "updated_at" | "user"> {
  subtitle?: string
  diff?: string
}

function GitHubCommentList({ comments }: { comments: CommentDisplay[] }) {
  if (!comments.length) {
    return null
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const created = formatTimestamp(comment.created_at)
        const updated = formatTimestamp(comment.updated_at)
        const edited = created !== updated

        return (
          <div key={comment.id} className="border-border/60 dark:border-border/40 flex flex-col gap-3 border-l pl-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={comment.user.avatar_url} alt={comment.user.login} />
                <AvatarFallback>{comment.user.login.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {comment.user.login}
                  <a
                    href={comment.html_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="text-muted-foreground text-xs">
                  Commented {created}
                  {edited ? ` · Edited ${updated}` : ""}
                </div>
                {comment.subtitle ? (
                  <div className="text-muted-foreground text-xs">{comment.subtitle}</div>
                ) : null}
              </div>
            </div>
            <div className="text-sm text-foreground">
              <MarkdownRenderer content={comment.body} />
            </div>
            {comment.diff ? (
              <pre className="bg-muted/60 dark:bg-muted/20 text-xs overflow-auto rounded-md px-3 py-2">
                {comment.diff.trim()}
              </pre>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function renderStatusIndicator(status?: PullRequestStatusSummary | null) {
  if (!status) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Clock3 className="h-4 w-4" />
        Checks pending
      </div>
    )
  }

  switch (status.overallState) {
    case "success":
      return (
        <div className="text-emerald-600 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Checks passed
        </div>
      )
    case "failure":
    case "error":
      return (
        <div className="text-destructive flex items-center gap-2 text-sm">
          <XCircle className="h-4 w-4" />
          Checks failed
        </div>
      )
    default:
      return (
        <div className="text-amber-500 flex items-center gap-2 text-sm">
          <Clock3 className="h-4 w-4" />
          Checks pending
        </div>
      )
  }
}

export default function GitHubIntegration() {
  const { projectId, worktreeId } = useParams<{ projectId: string; worktreeId: string }>()
  const navigate = useNavigate()
  const currentProject = useCurrentProject()
  const createWorktree = useWorktreesStore((state) => state.createWorktree)
  const createSession = useSessionsStore((state) => state.createSession)

  const [activeTab, setActiveTab] = useState<"issues" | "pulls">("issues")
  const [actionStates, setActionStates] = useState<Record<string, boolean>>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [githubToken, setGithubToken] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const storedToken = window.localStorage.getItem("opencode.githubToken") || undefined
    githubApi.setToken(storedToken)
    setGithubToken(storedToken)
  }, [])

  const resolvedWorktreeId = worktreeId || "default"

  const gitStatusQuery = useQuery<GitStatusResponse>({
    queryKey: ["git-status", projectId, resolvedWorktreeId],
    queryFn: () =>
      fetchGitStatus(projectId!, resolvedWorktreeId === "default" ? undefined : resolvedWorktreeId),
    enabled: Boolean(projectId),
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const remoteUrl = gitStatusQuery.data?.remoteUrl
  const repoRef = useMemo<GitHubRepoRef | null>(
    () => (remoteUrl ? parseGitHubRemote(remoteUrl) : null),
    [remoteUrl]
  )

  const issuesQuery = useQuery<GitHubIssue[]>({
    queryKey: ["github", repoRef?.owner, repoRef?.repo, "issues"],
    queryFn: async () => {
      return githubApi.fetchIssues(repoRef!, { state: "open", perPage: 50 })
    },
    select: (items) => items.filter((issue) => !issue.pull_request),
    enabled: Boolean(repoRef),
    refetchOnWindowFocus: false,
  })

  const pullRequestsQuery = useQuery<GitHubPullRequest[]>({
    queryKey: ["github", repoRef?.owner, repoRef?.repo, "pulls"],
    queryFn: async () => {
      return githubApi.fetchPullRequests(repoRef!, { state: "open", perPage: 30 })
    },
    enabled: Boolean(repoRef),
    refetchOnWindowFocus: false,
  })

  const pullRequests = useMemo<GitHubPullRequest[]>(
    () => pullRequestsQuery.data ?? [],
    [pullRequestsQuery.data]
  )
  const pullRequestNumbers = useMemo(() => pullRequests.map((pr) => pr.number), [pullRequests])

  const pullRequestStatusQuery = useQuery<PullRequestStatusMap>({
    queryKey: ["github", repoRef?.owner, repoRef?.repo, "pull-status", pullRequestNumbers],
    queryFn: async () => {
      if (!repoRef || pullRequestNumbers.length === 0) {
        return {}
      }
      const entries = await Promise.all(
        pullRequestNumbers.map(async (number) => {
          try {
            const status = await githubApi.getPullRequestStatus(repoRef, number)
            return [number, status] as const
          } catch (error) {
            console.error("Failed to fetch PR status", { number, error })
            return [number, null] as const
          }
        })
      )
      return Object.fromEntries(entries)
    },
    enabled: Boolean(repoRef && pullRequestNumbers.length > 0),
    refetchOnWindowFocus: false,
  })

  const issues = useMemo(() => issuesQuery.data ?? [], [issuesQuery.data])
  const statusMap = useMemo(() => pullRequestStatusQuery.data ?? {}, [pullRequestStatusQuery.data])
  const baseBranch = gitStatusQuery.data?.branch || DEFAULT_BRANCH_FALLBACK

  const contentRequest = useMemo(() => {
    if (!repoRef) {
      return null
    }

    const items: GitHubContentRequestItem[] = []

    for (const issue of issues) {
      items.push({ type: "issue", number: issue.number, updatedAt: issue.updated_at })
    }

    for (const pull of pullRequests) {
      items.push({ type: "pull", number: pull.number, updatedAt: pull.updated_at })
    }

    if (items.length === 0) {
      return null
    }

    return {
      repo: repoRef,
      items,
    }
  }, [repoRef, issues, pullRequests])

  const contentQueryKey = useMemo(() => {
    if (!projectId || !repoRef || !contentRequest) {
      return null
    }

    const issueKey = issues
      .map((issue) => `${issue.number}:${issue.updated_at}`)
      .sort()
      .join("|")

    const pullKey = pullRequests
      .map((pull) => `${pull.number}:${pull.updated_at}`)
      .sort()
      .join("|")

    return [
      "github",
      "content",
      projectId,
      repoRef.owner,
      repoRef.repo,
      issueKey,
      pullKey,
      githubToken ?? "",
    ] as const
  }, [projectId, repoRef, contentRequest, issues, pullRequests, githubToken])

  const contentQuery = useQuery<GitHubContentBatchResponse>({
    queryKey: contentQueryKey ?? ["github", "content", "disabled"],
    queryFn: ({ signal }) => {
      if (!projectId || !contentRequest) {
        throw new Error("Missing project or content request")
      }

      return fetchGitHubContent({
        projectId,
        request: contentRequest,
        token: githubToken,
        signal,
      })
    },
    enabled: Boolean(projectId && contentRequest),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const contentItems = useMemo(() => contentQuery.data?.items ?? [], [contentQuery.data?.items])
  const contentErrors = useMemo(() => contentQuery.data?.errors ?? [], [contentQuery.data?.errors])

  const issueContentMap = useMemo(() => {
    const map: Record<number, GitHubContentItem> = {}
    for (const item of contentItems) {
      if (item.type === "issue") {
        map[item.number] = item
      }
    }
    return map
  }, [contentItems])

  const pullContentMap = useMemo(() => {
    const map: Record<number, GitHubContentItem> = {}
    for (const item of contentItems) {
      if (item.type === "pull") {
        map[item.number] = item
      }
    }
    return map
  }, [contentItems])

  const contentErrorMap = useMemo(() => {
    const map = new Map<string, GitHubContentErrorItem>()
    for (const error of contentErrors) {
      map.set(`${error.type}:${error.number}`, error)
    }
    return map
  }, [contentErrors])

  const isLoadingInitial =
    gitStatusQuery.isLoading ||
    (!!repoRef && (issuesQuery.isLoading || pullRequestsQuery.isLoading)) ||
    (!!contentRequest && contentQuery.isPending)

  const isRefreshing =
    gitStatusQuery.isRefetching ||
    issuesQuery.isRefetching ||
    pullRequestsQuery.isRefetching ||
    pullRequestStatusQuery.isRefetching ||
    contentQuery.isRefetching

  const isContentFetching = contentQuery.isPending || contentQuery.isRefetching
  const topLevelContentError = contentQuery.isError
    ? contentQuery.error instanceof Error
      ? contentQuery.error.message
      : "Unable to load GitHub discussion details"
    : null

  const handleRefresh = useCallback(() => {
    void gitStatusQuery.refetch()
    if (repoRef) {
      void issuesQuery.refetch()
      void pullRequestsQuery.refetch()
      if (pullRequestNumbers.length > 0) {
        void pullRequestStatusQuery.refetch()
      }
    }
  }, [gitStatusQuery, issuesQuery, pullRequestsQuery, pullRequestStatusQuery, repoRef, pullRequestNumbers])

  const runAction = useCallback(
    async (
      key: string,
      params: {
        branch: string
        title: string
        sessionTitle: string
      }
    ) => {
      if (!projectId) {
        setActionError("An active project is required for this action")
        return
      }

      setActionError(null)
      setActionStates((prev) => ({ ...prev, [key]: true }))

      try {
        const branchName = normalizeBranchName(params.branch)
        if (!branchName) {
          throw new Error("Unable to derive a branch name for the worktree")
        }
        const worktreePath = toWorktreePath(branchName)
        const worktree = await createWorktree(projectId, {
          path: worktreePath,
          title: params.title,
          branch: branchName,
          baseRef: baseBranch,
          createBranch: true,
        })
        const session = await createSession(projectId, worktree.path, truncate(params.sessionTitle))
        navigate(`/projects/${projectId}/${worktree.id}/sessions/${session.id}/chat`)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to perform action"
        setActionError(message)
        console.error("GitHub integration action failed", error)
      } finally {
        setActionStates((prev) => ({ ...prev, [key]: false }))
      }
    },
    [projectId, createWorktree, createSession, navigate, baseBranch]
  )

  const handleIssueAction = useCallback(
    async (issue: GitHubIssue, action: "research" | "fix") => {
      const key = buildActionKey("issue", issue.number, action)
      const branch = action === "research" ? `research/issue-${issue.number}` : `fix/issue-${issue.number}`
      const titlePrefix = action === "research" ? "Research" : "Fix"
      await runAction(key, {
        branch,
        title: `${titlePrefix} Issue #${issue.number}`,
        sessionTitle: `${titlePrefix} Issue #${issue.number}: ${issue.title}`,
      })
    },
    [runAction]
  )

  const handlePullRequestFix = useCallback(
    async (pullRequest: GitHubPullRequest) => {
      const key = buildActionKey("pr", pullRequest.number, "fix")
      await runAction(key, {
        branch: `fix/pr-${pullRequest.number}`,
        title: `Fix PR #${pullRequest.number}`,
        sessionTitle: `Fix PR #${pullRequest.number}: ${pullRequest.title}`,
      })
    },
    [runAction]
  )

  const anyActionInFlight = Object.values(actionStates).some(Boolean)
  const repoLabel = repoRef ? `${repoRef.owner}/${repoRef.repo}` : null

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">GitHub Integration</h1>
            <p className="text-muted-foreground text-sm">
              {repoLabel
                ? `Connected to ${repoLabel}`
                : gitStatusQuery.isError
                  ? "Unable to determine GitHub repository"
                  : "Waiting for repository information"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing || isLoadingInitial}>
              {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>
        {actionError && (
          <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <AlertCircle className="h-4 w-4" />
            {actionError}
          </div>
        )}
        {topLevelContentError && (
          <div className="border-amber-400/40 bg-amber-500/10 text-amber-700 flex items-center gap-2 rounded-md border px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertCircle className="h-4 w-4" />
            {topLevelContentError}
          </div>
        )}
      </div>

      {gitStatusQuery.isError && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="text-destructive h-4 w-4" /> Unable to load git status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              {gitStatusQuery.error instanceof Error
                ? gitStatusQuery.error.message
                : "An unknown error occurred while fetching git status."}
            </p>
          </CardContent>
        </Card>
      )}

      {!repoRef && !gitStatusQuery.isLoading && !gitStatusQuery.isError && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" /> No GitHub remote detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Ensure the current project has a GitHub remote configured (e.g. origin pointing to GitHub) and try refreshing.
            </p>
          </CardContent>
        </Card>
      )}

      {repoRef && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "issues" | "pulls")}> 
          <TabsList>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="pulls">Pull Requests</TabsTrigger>
          </TabsList>
          <TabsContent value="issues" className="mt-4 space-y-4">
            {issuesQuery.isLoading && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading issues…
              </div>
            )}
            {issuesQuery.isError && (
              <div className="text-destructive flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" />
                {issuesQuery.error instanceof Error
                  ? issuesQuery.error.message
                  : "Failed to load issues"}
              </div>
            )}
            {!issuesQuery.isLoading && !issuesQuery.isError && issues.length === 0 && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <GitPullRequest className="h-4 w-4" />
                No open issues found.
              </div>
            )}
            {issues.map((issue) => {
              const actionFixKey = buildActionKey("issue", issue.number, "fix")
              const actionResearchKey = buildActionKey("issue", issue.number, "research")
              const fixLoading = actionStates[actionFixKey]
              const researchLoading = actionStates[actionResearchKey]
              const issueContent = issueContentMap[issue.number]
              const issueError = contentErrorMap.get(`issue:${issue.number}`)
              const issueDescription = issueContent?.item.body ?? issue.body ?? ""
              const issueComments: CommentDisplay[] = issueContent
                ? issueContent.comments.map((comment) => ({ ...comment }))
                : []
              const issueLoading = isContentFetching && !issueContent
              return (
                <Card key={issue.id}>
                  <CardHeader className="flex flex-col gap-2">
                    <CardTitle className="text-base font-semibold">
                      #{issue.number} · {issue.title}
                    </CardTitle>
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={issue.user?.avatar_url} alt={issue.user?.login} />
                          <AvatarFallback>{issue.user?.login?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-foreground">{issue.user?.login}</div>
                          <div className="text-xs">Opened {new Date(issue.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {issue.labels.map((label) => (
                          <Badge key={label.id} variant="outline" style={getLabelStyle(label)}>
                            {label.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">Description</div>
                      {issueDescription.trim() ? (
                        <MarkdownRenderer content={issueDescription} />
                      ) : issueLoading ? (
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading description…
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm italic">No description provided.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">Comments</div>
                      {issueError ? (
                        <div className="text-destructive flex items-center gap-2 text-sm">
                          <AlertCircle className="h-4 w-4" /> {issueError.message}
                        </div>
                      ) : issueLoading && !issueComments.length ? (
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
                        </div>
                      ) : issueComments.length > 0 ? (
                        <GitHubCommentList comments={issueComments} />
                      ) : (
                        <p className="text-muted-foreground text-sm italic">No comments yet.</p>
                      )}
                    </div>
                    {issueContent?.warning ? (
                      <div className="border-amber-400/40 bg-amber-500/10 text-amber-700 flex items-center gap-2 rounded-md border px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                        <AlertCircle className="h-4 w-4" /> {issueContent.warning}
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <a
                          href={issue.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-foreground inline-flex items-center gap-1"
                        >
                          View on GitHub <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleIssueAction(issue, "research")}
                          disabled={researchLoading || anyActionInFlight}
                        >
                          {researchLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                          Research
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleIssueAction(issue, "fix")}
                          disabled={fixLoading || anyActionInFlight}
                        >
                          {fixLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                          Fix with AI
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
          <TabsContent value="pulls" className="mt-4 space-y-4">
            {pullRequestsQuery.isLoading && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading pull requests…
              </div>
            )}
            {pullRequestsQuery.isError && (
              <div className="text-destructive flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" />
                {pullRequestsQuery.error instanceof Error
                  ? pullRequestsQuery.error.message
                  : "Failed to load pull requests"}
              </div>
            )}
            {!pullRequestsQuery.isLoading && !pullRequestsQuery.isError && pullRequests.length === 0 && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <GitPullRequest className="h-4 w-4" />
                No open pull requests found.
              </div>
            )}
            {pullRequests.map((pullRequest) => {
              const status = statusMap[pullRequest.number]
              const fixKey = buildActionKey("pr", pullRequest.number, "fix")
              const fixLoading = actionStates[fixKey]
              const labels = (pullRequest as GitHubPullRequest & { labels?: GitHubLabel[] }).labels || []
              const showFixButton = status?.overallState === "failure" || status?.overallState === "error"
              const pullContent = pullContentMap[pullRequest.number]
              const pullError = contentErrorMap.get(`pull:${pullRequest.number}`)
              const pullDescription = pullContent?.item.body ?? pullRequest.body ?? ""
              const pullComments: CommentDisplay[] = pullContent
                ? pullContent.comments.map((comment) => ({ ...comment }))
                : []
              const reviewComments: CommentDisplay[] = pullContent?.reviewComments
                ? pullContent.reviewComments.map((comment: GitHubReviewComment) => ({
                    id: comment.id,
                    body: comment.body,
                    html_url: comment.html_url,
                    created_at: comment.created_at,
                    updated_at: comment.updated_at,
                    user: comment.user,
                    subtitle: comment.path
                      ? `${comment.path}${comment.original_line ? ` · Line ${comment.original_line}` : ""}`
                      : undefined,
                    diff: comment.diff_hunk,
                  }))
                : []
              const pullLoading = isContentFetching && !pullContent

              return (
                <Card key={pullRequest.id}>
                  <CardHeader className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold">
                        #{pullRequest.number} · {pullRequest.title}
                      </CardTitle>
                      {renderStatusIndicator(status)}
                    </div>
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={pullRequest.user?.avatar_url} alt={pullRequest.user?.login} />
                          <AvatarFallback>{pullRequest.user?.login?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-foreground">{pullRequest.user?.login}</div>
                          <div className="text-xs">
                            {pullRequest.base.ref} ← {pullRequest.head.ref}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {labels.map((label) => (
                          <Badge key={label.id} variant="outline" style={getLabelStyle(label)}>
                            {label.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">Description</div>
                      {pullDescription.trim() ? (
                        <MarkdownRenderer content={pullDescription} />
                      ) : pullLoading ? (
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading description…
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm italic">No description provided.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">Comments</div>
                      {pullError ? (
                        <div className="text-destructive flex items-center gap-2 text-sm">
                          <AlertCircle className="h-4 w-4" /> {pullError.message}
                        </div>
                      ) : pullLoading && !pullComments.length ? (
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
                        </div>
                      ) : pullComments.length > 0 ? (
                        <GitHubCommentList comments={pullComments} />
                      ) : (
                        <p className="text-muted-foreground text-sm italic">No comments yet.</p>
                      )}
                    </div>
                    {reviewComments.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase text-muted-foreground">Review Comments</div>
                        <GitHubCommentList comments={reviewComments} />
                      </div>
                    ) : null}
                    {pullContent?.warning ? (
                      <div className="border-amber-400/40 bg-amber-500/10 text-amber-700 flex items-center gap-2 rounded-md border px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                        <AlertCircle className="h-4 w-4" /> {pullContent.warning}
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <a
                          href={pullRequest.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-foreground inline-flex items-center gap-1"
                        >
                          View on GitHub <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {showFixButton ? (
                          <Button
                            size="sm"
                            onClick={() => void handlePullRequestFix(pullRequest)}
                            disabled={fixLoading || anyActionInFlight}
                          >
                            {fixLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                            Fix with AI
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            Waiting on checks
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
        </Tabs>
      )}

      {!projectId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="text-destructive h-4 w-4" /> No project selected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Select a project from the sidebar to view GitHub issues and pull requests.
            </p>
          </CardContent>
        </Card>
      )}

      {currentProject?.path && (
        <p className="text-muted-foreground text-xs">
          Active worktree: {resolvedWorktreeId} · Base branch: {baseBranch}
        </p>
      )}
    </div>
  )
}

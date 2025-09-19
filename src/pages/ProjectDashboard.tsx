import { useEffect, useState, useMemo, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Activity,
  Bot,
  FileText,
  FolderOpen,
  GitBranch,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Zap,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCurrentProject,
  useProjectsActions,
  useProjects,
  useProjectsStore,
} from "../stores/projects"
import {
  useWorktreesStore,
  useWorktreesForProject,
  useWorktreesLoading,
} from "@/stores/worktrees"
import { useSessionsForProject, useRecentSessions, useSessionsStore } from "../stores/sessions"
import { useOpencodeSDK } from "../contexts/OpencodeSDKContext"
import type { Project } from "../lib/api/project-manager"
import { fetchGitSummary } from "@/lib/git"
import type { GitSummary } from "@/lib/git"
import { formatRelativeTime } from "@/lib/utils"

interface AgentSummary {
  activeCount: number
  mostUsed?: string
  totalAgents: number
}

interface ActivityEvent {
  id: string
  type: "session_created" | "file_changed" | "git_commit" | "agent_used"
  message: string
  timestamp: string
}

export default function ProjectDashboard() {
  const { projectId, worktreeId } = useParams<{ projectId: string; worktreeId: string }>()
  const navigate = useNavigate()
  const currentProject = useCurrentProject()
  const projects = useProjects()
  const { selectProject } = useProjectsActions()
  const { loadSessions, createSession } = useSessionsStore()
  const { getClient } = useOpencodeSDK()
  const loadWorktrees = useWorktreesStore((state) => state.loadWorktrees)
  const createWorktreeApi = useWorktreesStore((state) => state.createWorktree)
  const removeWorktreeApi = useWorktreesStore((state) => state.removeWorktree)
  const worktrees = useWorktreesForProject(projectId || "")
  const worktreesLoading = useWorktreesLoading(projectId || "")

  const resolvedWorktreeId = worktreeId || "default"

  // State declarations
  const [gitStatus, setGitStatus] = useState<GitSummary | null>(null)
  const [agentSummary, setAgentSummary] = useState<AgentSummary | null>(null)
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [showWorktreeDialog, setShowWorktreeDialog] = useState(false)
  const [newWorktreePath, setNewWorktreePath] = useState("")
  const [newWorktreeTitle, setNewWorktreeTitle] = useState("")
  const [createWorktreeLoading, setCreateWorktreeLoading] = useState(false)
  const [createWorktreeError, setCreateWorktreeError] = useState<string | null>(null)
  const [worktreeActionId, setWorktreeActionId] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) {
      void loadWorktrees(projectId)
    }
  }, [projectId, loadWorktrees])

  const activeWorktree = useMemo(() => {
    if (!projectId) return undefined
    if (resolvedWorktreeId === "default") {
      if (!currentProject?.path) return undefined
      return {
        id: "default",
        path: currentProject.path,
        title: `${currentProject.name ?? "Project"} (default)`,
      }
    }
    return worktrees.find((worktree) => worktree.id === resolvedWorktreeId)
  }, [projectId, resolvedWorktreeId, currentProject?.path, currentProject?.name, worktrees])

  const activeWorktreePath = activeWorktree?.path || currentProject?.path

  const sessions = useSessionsForProject(projectId || "", activeWorktreePath)
  const recentSessions = useRecentSessions(projectId || "", 5, activeWorktreePath)

  const additionalRecentCommits = useMemo(() => {
    type CommitSummary = NonNullable<GitSummary["recentCommits"]>[number]

    if (!gitStatus?.recentCommits?.length) {
      return [] as CommitSummary[]
    }

    if (!gitStatus.lastCommit) {
      return gitStatus.recentCommits.slice(0, 3) as CommitSummary[]
    }

    const filtered = gitStatus.recentCommits.filter((commit) => commit.hash !== gitStatus.lastCommit?.hash)
    return filtered.slice(0, 3) as CommitSummary[]
  }, [gitStatus])

  useEffect(() => {
    let cancelled = false

    if (!projectId || !activeWorktreePath) {
      setGitStatus(null)
      return
    }

    const loadGitSummary = async () => {
      try {
        const summary = await fetchGitSummary(projectId, resolvedWorktreeId)
        if (!cancelled) {
          console.log("git summary", summary)
          setGitStatus(summary)
        }
      } catch (error) {
        console.error("Failed to update git summary:", error)
        if (!cancelled) {
          setGitStatus(null)
        }
      }
    }

    void loadGitSummary()

    return () => {
      cancelled = true
    }
  }, [projectId, activeWorktreePath, resolvedWorktreeId])

  useEffect(() => {
    if (!projectId) return
    if (!worktreesLoading && resolvedWorktreeId !== "default" && !activeWorktree) {
      navigate(`/projects/${projectId}/default`, { replace: true })
    }
  }, [projectId, resolvedWorktreeId, activeWorktree, worktreesLoading, navigate])

  useEffect(() => {
    if (showWorktreeDialog) {
      setCreateWorktreeError(null)
    } else {
      setNewWorktreePath("")
      setNewWorktreeTitle("")
    }
  }, [showWorktreeDialog])

  const sortedWorktrees = useMemo(() => {
    if (!worktrees) return []
    const list = [...worktrees]
    list.sort((a, b) => {
      if (a.id === "default") return -1
      if (b.id === "default") return 1
      return a.title.localeCompare(b.title)
    })
    return list
  }, [worktrees])

  const handleSelectWorktree = useCallback(
    (targetId: string) => {
      if (!projectId) return
      navigate(`/projects/${projectId}/${targetId}`)
    },
    [navigate, projectId]
  )

  const handleCreateWorktree = useCallback(async () => {
    if (!projectId) return
    const trimmedPath = newWorktreePath.trim()
    const trimmedTitle = newWorktreeTitle.trim()
    if (!trimmedPath) {
      setCreateWorktreeError("Worktree name is required")
      return
    }
    if (!trimmedTitle) {
      setCreateWorktreeError("Worktree title is required")
      return
    }
    
    // Validate worktree name: no slashes, spaces, or special symbols
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedPath)) {
      setCreateWorktreeError("Worktree name can only contain letters, numbers, hyphens, and underscores")
      return
    }

    setCreateWorktreeLoading(true)
    setCreateWorktreeError(null)
    try {
      const created = await createWorktreeApi(projectId, {
        path: `worktrees/${trimmedPath}`,
        title: trimmedTitle,
      })
      await loadWorktrees(projectId)
      setShowWorktreeDialog(false)
      navigate(`/projects/${projectId}/${created.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create worktree"
      setCreateWorktreeError(message)
    } finally {
      setCreateWorktreeLoading(false)
    }
  }, [projectId, newWorktreePath, newWorktreeTitle, createWorktreeApi, loadWorktrees, navigate])

  const handleRemoveWorktree = useCallback(
    async (targetId: string) => {
      if (!projectId || targetId === "default") return
      setWorktreeActionId(targetId)
      try {
        await removeWorktreeApi(projectId, targetId)
        await loadWorktrees(projectId)
        if (resolvedWorktreeId === targetId) {
          navigate(`/projects/${projectId}/default`)
        }
      } catch (error) {
        console.error("Failed to remove worktree:", error)
      } finally {
        setWorktreeActionId(null)
      }
    },
    [projectId, removeWorktreeApi, loadWorktrees, resolvedWorktreeId, navigate]
  )

  const loadProjectDetails = useCallback(async (projectIdParam: string, projectPath: string) => {
    try {
      // Get SDK client for this project
      const client = await getClient(projectIdParam, projectPath)

        // Sessions are already loaded via store; avoid redundant list calls here to reduce network load

        // Load config using SDK
        try {
          const configResponse = await client.config.get({ query: { directory: projectPath } })
          if (configResponse.data) {
            console.log("Loaded config via SDK:", configResponse.data)
          }
        } catch (error) {
          console.error("Failed to load config via SDK:", error)
        }

        // Load providers using SDK
        try {
          const providersResponse = await client.config.providers({
            query: { directory: projectPath },
          })
          if (providersResponse.data) {
            console.log("Loaded providers via SDK:", providersResponse.data)
            // Update agent summary based on providers
            const providerCount = providersResponse.data.providers?.length || 0
            setAgentSummary({
              activeCount: providerCount > 0 ? 1 : 0,
              mostUsed: providersResponse.data.providers?.[0]?.name || "None",
              totalAgents: providerCount,
            })
          }
        } catch (error) {
          console.error("Failed to load providers via SDK:", error)
          // Fallback agent summary
          setAgentSummary({
            activeCount: 1,
            mostUsed: "Claude",
            totalAgents: 3,
          })
        }

        // Load project info using SDK
        try {
          const projectResponse = await client.project.current({
            query: { directory: projectPath },
          })
          if (projectResponse.data) {
            console.log("Loaded project info via SDK:", projectResponse.data)
          }
        } catch (error) {
          console.error("Failed to load project info via SDK:", error)
        }

        // Load activity feed from backend (not available in SDK yet)
        try {
          const worktreeQuery = projectPath ? `?worktree=${encodeURIComponent(projectPath)}` : ""
          const response = await fetch(`/api/projects/${projectIdParam}/activity${worktreeQuery}`)
          if (response.ok) {
            const activityData = await response.json()
            setActivityFeed(activityData)
          } else {
            // Enhanced error logging for HTTP failures
            const responseText = await response.text().catch(() => 'Unable to read response body')
            const responseHeaders = Object.fromEntries(response.headers.entries())
            console.error('Failed to load activity feed:', {
              method: 'GET',
              url: `/api/projects/${projectIdParam}/activity`,
              status: response.status,
              statusText: response.statusText,
              headers: responseHeaders,
              body: responseText
            })
          }
        } catch (error) {
          console.error("Failed to load activity feed:", error)
          setActivityFeed([])
        }
    } catch (error) {
      console.error("Failed to load project details:", error)
    }
  }, [getClient])

  const loadProjectData = useCallback(
    async (targetProjectId: string) => {
      setLoading(true)
      try {
        let state = useProjectsStore.getState()
        let project: Project | null = state.currentProject ?? null

        if (!project || project.id !== targetProjectId) {
          await selectProject(targetProjectId)
          state = useProjectsStore.getState()
          project = state.currentProject ?? null
          if (!project) {
            const found = state.projects.find((p) => p.id === targetProjectId)
            project = found ?? null
          }
        }

        if (project?.path) {
          await loadWorktrees(targetProjectId)
          const worktreeList = useWorktreesStore.getState().worktreesByProject.get(targetProjectId) || []
          const desiredId = resolvedWorktreeId
          const matchingWorktree =
            desiredId === "default"
              ? { path: project.path }
              : worktreeList.find((worktree) => worktree.id === desiredId)
          const effectivePath = matchingWorktree?.path || project.path

          await loadSessions(targetProjectId, effectivePath)

          if (project.instance?.status === "running") {
            await loadProjectDetails(targetProjectId, effectivePath)
          } else {
            setGitStatus(null)
          }
        } else {
          console.error("Project not found or missing path:", targetProjectId)
          const fallback = state.projects[0]
          if (fallback) {
            navigate(`/projects/${fallback.id}/default`)
          } else {
            navigate(`/`)
          }
        }
      } catch (error) {
        console.error("Failed to load project data:", error)
      } finally {
        setLoading(false)
      }
    },
    [selectProject, loadSessions, loadProjectDetails, navigate, loadWorktrees, resolvedWorktreeId]
  )

  const [projectDetailsLoaded, setProjectDetailsLoaded] = useState(false)

  useEffect(() => {
    setProjectDetailsLoaded(false)
  }, [projectId, resolvedWorktreeId])

  // Load project data on mount
  useEffect(() => {
    if (!projectId || projectDetailsLoaded) return
    setProjectDetailsLoaded(true)
    void loadProjectData(projectId)
  }, [projectId, projectDetailsLoaded, loadProjectData])

  useEffect(() => {
    if (!projectId) return
    if (resolvedWorktreeId !== "default" && !activeWorktreePath) {
      navigate(`/projects/${projectId}/default`, { replace: true })
    }
  }, [projectId, resolvedWorktreeId, activeWorktreePath, navigate])

  // Handlers for starting/stopping projects are not used in this view currently.

  const handleNewSession = useCallback(async () => {
    if (!projectId || !activeWorktreePath) return
    try {
      const session = await createSession(projectId, activeWorktreePath, "New Chat")
      navigate(`/projects/${projectId}/${resolvedWorktreeId}/sessions/${session.id}/chat`)
    } catch (error) {
      console.error("Failed to create session:", error)
    }
  }, [projectId, activeWorktreePath, resolvedWorktreeId, createSession, navigate])

  // In SDK mode, projects are always effectively "running"
  const isRunning = true
  // Project instances are managed externally; no transient starting state used here

  const sessionList = useMemo(() => {
    return (
      <div className="space-y-3">
        {recentSessions.length > 0 ? (
          recentSessions.map((session) => (
            <div
              key={session.id}
              className="hover:bg-accent/50 flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors"
              onClick={() =>
                navigate(`/projects/${projectId}/${resolvedWorktreeId}/sessions/${session.id}/chat`)
              }
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{session.title}</p>
                <p className="text-muted-foreground text-sm">
                  {formatRelativeTime(session.time.updated)}
                </p>
              </div>
              <MessageSquare className="text-muted-foreground h-4 w-4" />
            </div>
          ))
        ) : (
          <div className="py-6 text-center">
            <MessageSquare className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
            <p className="text-muted-foreground mb-3 text-sm">No recent sessions</p>
            {isRunning && (
              <Button size="sm" onClick={handleNewSession}>
                <Plus className="mr-2 h-4 w-4" />
                New Session
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }, [recentSessions, projectId, resolvedWorktreeId, navigate, handleNewSession, isRunning])

  if (loading) {
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading project dashboard...</p>
        </div>
      </div>
    )
  }

  if (!currentProject) {
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Project Not Found</h1>
          <p className="text-muted-foreground mb-4">The requested project could not be loaded.</p>
          <Button onClick={() => navigate("/")}>Back to Projects</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background flex h-full w-full flex-col" data-testid="project-dashboard">
      {/* Fixed Header */}
      <div data-testid="project-status-section" className="bg-background flex-shrink-0 border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{currentProject.name}</h1>
                  {/* Project Switcher Dropdown */}
                  <Select
                    value={projectId}
                    onValueChange={(id) => navigate(`/projects/${id}/default`)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4" />
                            {project.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{currentProject.path}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className="gap-1 border-green-600 bg-green-600 text-white"
                data-testid="badge-project-status"
              >
                <Zap className="h-3 w-3" />
                Ready
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          {/* Quick Stats */}
          <div data-testid="stats-section" className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card data-testid="total-sessions-stat">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                <MessageSquare className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sessions.length}</div>
                <p className="text-muted-foreground text-xs">
                  {recentSessions.length > 0 &&
                    `Last: ${formatRelativeTime(recentSessions[0].time.updated)}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Changed Files</CardTitle>
                <FileText className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gitStatus ? gitStatus.changedFiles : "N/A"}</div>
                <p className="text-muted-foreground text-xs">
                  Branch: {gitStatus ? gitStatus.branch : "Unknown"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Worktrees */}
          <Card data-testid="worktrees-section">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Git Worktrees
                </CardTitle>
                <CardDescription>Isolated directories for parallel work</CardDescription>
              </div>
              <Button onClick={() => setShowWorktreeDialog(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" /> New Worktree
              </Button>
            </CardHeader>
            <CardContent>
              {worktreesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading worktrees...
                </div>
              ) : sortedWorktrees.length === 0 ? (
                <div className="border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
                  No worktrees found. Create one to start a focused branch.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedWorktrees.map((worktree) => {
                    const isActive = worktree.id === resolvedWorktreeId
                    return (
                      <div
                        key={worktree.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium truncate max-w-[220px]">{worktree.title}</span>
                            {worktree.id === "default" && (
                              <Badge variant="outline">Default</Badge>
                            )}
                            {isActive && (
                              <Badge variant="secondary">Active</Badge>
                            )}
                          </div>
                          {worktree.branch && (
                            <p className="text-muted-foreground text-sm">Branch: {worktree.branch}</p>
                          )}
                          <p className="text-muted-foreground text-xs break-all">
                            {worktree.relativePath || "(project root)"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant={isActive ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => handleSelectWorktree(worktree.id)}
                          >
                            Open
                          </Button>
                          {worktree.id !== "default" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveWorktree(worktree.id)}
                              disabled={worktreeActionId === worktree.id}
                            >
                              {worktreeActionId === worktree.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                              )}
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card data-testid="quick-actions-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks and shortcuts for this project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 place-items-stretch">
                <Button
                  data-testid="button-new-chat"
                  variant="outline"
                  className="h-20 w-full flex-col items-center justify-center gap-2"
                  disabled={false}
                  onClick={handleNewSession}
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs" data-testid="quick-action-new-chat">
                    New Chat
                  </span>
                </Button>

                <Button
                  data-testid="quick-action-file-browser"
                  variant="outline"
                  className="h-20 w-full flex-col items-center justify-center gap-2"
                  onClick={() => navigate(`/projects/${projectId}/${resolvedWorktreeId}/files`)}
                  disabled={false}
                >
                  <FolderOpen className="h-5 w-5" />
                  <span className="text-xs">File Browser</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 w-full flex-col items-center justify-center gap-2"
                  onClick={() => navigate(`/projects/${projectId}/${resolvedWorktreeId}/git`)}
                  disabled={false}
                >
                  <GitBranch className="h-5 w-5" />
                  <span className="text-xs">Git Status</span>
                </Button>

                <div
                  data-testid="manage-agents-button"
                  role="button"
                  onClick={() => navigate(`/projects/${projectId}/${resolvedWorktreeId}/agents`)}
                  className="h-20 w-full"
                >
                  <Button
                    data-testid="quick-action-manage-agents"
                    variant="outline"
                    className="h-20 w-full flex-col items-center justify-center gap-2"
                    disabled={false}
                  >
                    <Bot className="h-5 w-5" />
                    <span className="text-xs">Manage Agents</span>
                  </Button>
                </div>

                <Button
                  variant="outline"
                  className="h-20 w-full flex-col items-center justify-center gap-2"
                  onClick={() => navigate(`/projects/${projectId}/${resolvedWorktreeId}/settings`)}
                >
                  <Settings className="h-5 w-5" />
                  <span className="text-xs">Settings</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent Sessions */}
            <Card data-testid="recent-sessions-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Recent Sessions
                </CardTitle>
                <CardDescription>Your latest chat sessions</CardDescription>
              </CardHeader>
              <CardContent>{sessionList}</CardContent>
            </Card>

            {/* Git Status */}
            <Card data-testid="git-status-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Git Status
                </CardTitle>
                <CardDescription>Repository status and recent activity</CardDescription>
              </CardHeader>
              <CardContent>
                {gitStatus ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Current Branch</span>
                      <Badge variant="outline">{gitStatus.branch}</Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Changed Files</span>
                      <span className="text-sm">{gitStatus.changedFiles}</span>
                    </div>

                    {gitStatus.lastCommit && (
                      <div className="border-t pt-2">
                        <p className="mb-1 text-sm font-medium">Last Commit</p>
                        <p className="text-muted-foreground truncate text-sm" title={gitStatus.lastCommit.message}>
                          {gitStatus.lastCommit.message}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          by {gitStatus.lastCommit.author} •{" "}
                          {formatRelativeTime(gitStatus.lastCommit.date)}
                        </p>
                      </div>
                    )}

                    {additionalRecentCommits.length > 0 && (
                      <div className="border-t pt-2">
                        <p className="mb-2 text-sm font-medium">Recent Commits</p>
                        <ul className="space-y-2">
                          {additionalRecentCommits.map((commit) => (
                            <li key={commit.hash} className="text-sm">
                              <p className="truncate text-muted-foreground" title={commit.message}>
                                {commit.message}
                              </p>
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                by {commit.author} • {formatRelativeTime(commit.date)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <GitBranch className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
                    <p className="text-muted-foreground">Git status unavailable</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {"Ensure the project is running and the directory is a git repository."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agent Summary */}
            <Card data-testid="agents-metric">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Agent Summary
                </CardTitle>
                <CardDescription>AI agents and their usage</CardDescription>
              </CardHeader>
              <CardContent>
                {agentSummary ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Active Agents</span>
                      <span className="text-sm">{agentSummary.activeCount}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Available</span>
                      <span className="text-sm">{agentSummary.totalAgents}</span>
                    </div>

                    {agentSummary.mostUsed && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Most Used</span>
                        <Badge variant="secondary">{agentSummary.mostUsed}</Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <Bot className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
                    <p className="text-muted-foreground">Agent data unavailable</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Start the project to view agent information
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity Feed */}
            <Card data-testid="recent-activity-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest events and changes</CardDescription>
              </CardHeader>
              <CardContent>
                {activityFeed.length > 0 ? (
                  <div className="space-y-3">
                    {activityFeed.map((event) => (
                      <div key={event.id} className="flex items-start gap-3">
                        <div className="mt-1 flex-shrink-0">
                          {event.type === "session_created" && (
                            <MessageSquare className="h-4 w-4 text-blue-500" />
                          )}
                          {event.type === "file_changed" && (
                            <FileText className="h-4 w-4 text-green-500" />
                          )}
                          {event.type === "git_commit" && (
                            <GitBranch className="h-4 w-4 text-purple-500" />
                          )}
                          {event.type === "agent_used" && (
                            <Bot className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{event.message}</p>
                          <p className="text-muted-foreground text-xs">
                            {formatRelativeTime(event.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <Activity className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
                    <p className="text-muted-foreground">No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
      <Dialog open={showWorktreeDialog} onOpenChange={setShowWorktreeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Worktree</DialogTitle>
            <DialogDescription>
              Provide a name and title for the new worktree. The worktree will be created in the
              worktrees directory relative to the project root.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="worktree-title">Title</Label>
              <Input
                id="worktree-title"
                placeholder="Feature: onboarding flow"
                value={newWorktreeTitle}
                onChange={(event) => setNewWorktreeTitle(event.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="worktree-path">Name</Label>
              <Input
                id="worktree-path"
                placeholder="onboarding"
                value={newWorktreePath}
                onChange={(event) => setNewWorktreePath(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Will be created as: worktrees/{newWorktreePath || "name"}
              </p>
            </div>
            {createWorktreeError && (
              <p className="text-sm text-destructive">{createWorktreeError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowWorktreeDialog(false)}
              disabled={createWorktreeLoading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateWorktree} disabled={createWorktreeLoading}>
              {createWorktreeLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create Worktree
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

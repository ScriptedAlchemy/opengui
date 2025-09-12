import { useEffect, useState, useMemo, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Activity,
  BarChart3,
  Bot,
  Database,
  FileText,
  FolderOpen,
  GitBranch,
  HardDrive,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
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
import { useSessionsForProject, useRecentSessions, useSessionsStore } from "../stores/sessions"
import { useOpencodeSDK } from "../contexts/OpencodeSDKContext"

interface GitStatus {
  branch: string
  changedFiles: number
  lastCommit?: {
    hash: string
    message: string
    author: string
    date: string
  }
}

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

interface ResourceUsage {
  memory: {
    used: number
    total: number
  }
  port?: number
}

export default function ProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const currentProject = useCurrentProject()
  const projects = useProjects()
  const { selectProject } = useProjectsActions()
  const sessions = useSessionsForProject(projectId || "")
  const recentSessions = useRecentSessions(projectId || "", 5)
  const { loadSessions, createSession } = useSessionsStore()
  const { getClient } = useOpencodeSDK()

  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [agentSummary, setAgentSummary] = useState<AgentSummary | null>(null)
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([])
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage | null>(null)
  const [loading, setLoading] = useState(false)

  const loadProjectDetails = async (projectId: string, projectPath: string) => {
    try {
      // Get SDK client for this project
      const client = await getClient(projectId, projectPath)

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

        // Load git status - mock data for now (SDK doesn't have git endpoints yet)
        setGitStatus({
          branch: "main",
          changedFiles: 0,
          lastCommit: {
            hash: "abc123",
            message: "Latest commit",
            author: "Developer",
            date: new Date().toISOString(),
          },
        })

        // Load resource usage from backend (not available in SDK yet)
        try {
          const response = await fetch(`/api/projects/${projectId}/resources`)
          if (response.ok) {
            const resourceData = await response.json()
            setResourceUsage(resourceData)
          } else {
            // Enhanced error logging for HTTP failures
            const responseText = await response.text().catch(() => 'Unable to read response body')
            const responseHeaders = Object.fromEntries(response.headers.entries())
            console.error('Failed to load resource usage:', {
              method: 'GET',
              url: `/api/projects/${projectId}/resources`,
              status: response.status,
              statusText: response.statusText,
              headers: responseHeaders,
              body: responseText
            })
          }
        } catch (error) {
          console.error("Failed to load resource usage:", error)
          // Fallback to basic data
          setResourceUsage({
            memory: { used: 0, total: 0 },
            port: undefined,
          })
        }

        // Load activity feed from backend (not available in SDK yet)
        try {
          const response = await fetch(`/api/projects/${projectId}/activity`)
          if (response.ok) {
            const activityData = await response.json()
            setActivityFeed(activityData)
          } else {
            // Enhanced error logging for HTTP failures
            const responseText = await response.text().catch(() => 'Unable to read response body')
            const responseHeaders = Object.fromEntries(response.headers.entries())
            console.error('Failed to load activity feed:', {
              method: 'GET',
              url: `/api/projects/${projectId}/activity`,
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
  }

  // Load project data on mount
  useEffect(() => {
    if (!projectId) return

    const loadProjectData = async () => {
      setLoading(true)
      try {
        // Select the project and wait for it to be loaded
        await selectProject(projectId)

        // Small delay to ensure store is updated
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Get the updated project from the store
        const state = useProjectsStore.getState()
        const project = state.currentProject || state.projects.find((p) => p.id === projectId)

        if (project?.path) {
          // Load sessions
          await loadSessions(projectId, project.path)

          // Load additional data if project is running
          if (project.instance?.status === "running") {
            await loadProjectDetails(projectId, project.path)
          }
        } else {
          console.error("Project not found or missing path:", projectId)
          // Fallback navigation: if we have any projects, navigate to the first one
          if (state.projects.length > 0) {
            navigate(`/projects/${state.projects[0].id}`)
          } else {
            navigate(`/`)
          }
        }
      } catch (error) {
        console.error("Failed to load project data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProjectData()
  }, [projectId, selectProject, loadSessions, getClient])

  // Handlers for starting/stopping projects are not used in this view currently.

  const handleNewSession = useCallback(async () => {
    if (!projectId || !currentProject?.path) return
    try {
      const session = await createSession(projectId, currentProject.path, "New Chat")
      navigate(`/projects/${projectId}/sessions/${session.id}/chat`)
    } catch (error) {
      console.error("Failed to create session:", error)
    }
  }, [projectId, currentProject?.path, createSession, navigate])

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

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
              onClick={() => navigate(`/projects/${projectId}/sessions/${session.id}/chat`)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{session.title}</p>
                <p className="text-muted-foreground text-sm">
                  {formatRelativeTime(new Date(session.time.updated * 1000).toISOString())}
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
  }, [recentSessions, projectId, navigate, handleNewSession, isRunning])

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
                  <Select value={projectId} onValueChange={(id) => navigate(`/projects/${id}`)}>
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
          <div data-testid="stats-section" className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card data-testid="total-sessions-stat">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                <MessageSquare className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sessions.length}</div>
                <p className="text-muted-foreground text-xs">
                  {recentSessions.length > 0 &&
                    `Last: ${formatRelativeTime(new Date(recentSessions[0].time.updated * 1000).toISOString())}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Changed Files</CardTitle>
                <FileText className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gitStatus?.changedFiles || 0}</div>
                <p className="text-muted-foreground text-xs">
                  Branch: {gitStatus?.branch || "main"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <HardDrive className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {resourceUsage ? formatBytes(resourceUsage.memory.used * 1024 * 1024) : "N/A"}
                </div>
                <p className="text-muted-foreground text-xs">
                  {resourceUsage && `of ${formatBytes(resourceUsage.memory.total * 1024 * 1024)}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Port</CardTitle>
                <Database className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resourceUsage?.port || "N/A"}</div>
                <p className="text-muted-foreground text-xs">Active</p>
              </CardContent>
            </Card>
          </div>

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
                <div
                  data-testid="button-new-chat"
                  role="button"
                  onClick={handleNewSession}
                  className="h-20 w-full"
                >
                  <Button
                    data-testid="quick-action-new-chat"
                    variant="outline"
                    className="h-20 w-full flex-col items-center justify-center gap-2"
                    disabled={false}
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-xs">New Chat</span>
                  </Button>
                </div>

                <Button
                  data-testid="quick-action-file-browser"
                  variant="outline"
                  className="h-20 w-full flex-col items-center justify-center gap-2"
                  onClick={() => navigate(`/projects/${projectId}/files`)}
                  disabled={false}
                >
                  <FolderOpen className="h-5 w-5" />
                  <span className="text-xs">File Browser</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 w-full flex-col items-center justify-center gap-2"
                  onClick={() => navigate(`/projects/${projectId}/git`)}
                  disabled={false}
                >
                  <GitBranch className="h-5 w-5" />
                  <span className="text-xs">Git Status</span>
                </Button>

                <div
                  data-testid="manage-agents-button"
                  role="button"
                  onClick={() => navigate(`/projects/${projectId}/agents`)}
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
                  onClick={() => navigate(`/projects/${projectId}/settings`)}
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
            <Card>
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
                        <p className="text-muted-foreground truncate text-sm">
                          {gitStatus.lastCommit.message}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          by {gitStatus.lastCommit.author} •{" "}
                          {formatRelativeTime(gitStatus.lastCommit.date)}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <GitBranch className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
                    <p className="text-muted-foreground">Git status unavailable</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {"Not a git repository"}
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

          {/* Resource Usage */}
          {resourceUsage && (
            <Card data-testid="project-metrics-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Resource Usage
                </CardTitle>
                <CardDescription>System resources and performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Memory Usage</span>
                      <span className="text-muted-foreground text-sm">
                        {formatBytes(resourceUsage.memory.used * 1024 * 1024)} /{" "}
                        {formatBytes(resourceUsage.memory.total * 1024 * 1024)}
                      </span>
                    </div>
                    <Progress
                      value={(resourceUsage.memory.used / resourceUsage.memory.total) * 100}
                      className="h-2"
                    />
                  </div>

                  {resourceUsage.port && (
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-sm font-medium">Server Port</span>
                      <Badge variant="outline">{resourceUsage.port}</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

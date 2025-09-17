import { useState, useEffect, useMemo } from "react"
import { NavLink, useNavigate, useParams } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  LayoutDashboard,
  GitBranch,
  Bot,
  Files,
  Settings,
  Circle,
  Folder,
  Clock,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Trash2,
  Edit3,
} from "lucide-react"

import { useCurrentProject } from "../../stores/projects"
import {
  useSessionsStore,
  useSessionsForProject,
  useCurrentSession,
  useSessionsListLoading,
  useSessionsCreateLoading,
  useSessionsError,
  Session,
} from "../../stores/sessions"
import {
  useWorktreesForProject,
  useWorktreesLoading,
  useWorktreesStore,
} from "@/stores/worktrees"
import { Button } from "../ui/button"
import { ScrollArea } from "../ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"

interface ProjectSidebarProps {
  className?: string
}

const TooltipWrapper = ({
  children,
  content,
  disabled,
}: {
  children: React.ReactNode
  content: string
  disabled: boolean
}) => {
  if (disabled) {
    return <>{children}</>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{children}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function ProjectSidebar({ className }: ProjectSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [removingWorktreeId, setRemovingWorktreeId] = useState<string | null>(null)

  const navigate = useNavigate()
  const { projectId, worktreeId } = useParams<{ projectId: string; worktreeId: string }>()
  const activeWorktreeId = worktreeId || "default"

  const currentProject = useCurrentProject()
  const { loadSessions, createSession, selectSession, deleteSession, clearError } =
    useSessionsStore()
  const loadWorktrees = useWorktreesStore((state) => state.loadWorktrees)
  const removeWorktree = useWorktreesStore((state) => state.removeWorktree)
  const worktrees = useWorktreesForProject(currentProject?.id || "")
  const worktreesLoading = useWorktreesLoading(currentProject?.id || "")

  const activeWorktree = useMemo(() => {
    if (!currentProject?.path) return undefined
    if (activeWorktreeId === "default") {
      return {
        id: "default",
        path: currentProject.path,
        title: `${currentProject.name ?? "Project"} (default)`,
      }
    }
    return worktrees.find((worktree) => worktree.id === activeWorktreeId)
  }, [worktrees, activeWorktreeId, currentProject?.path, currentProject?.name])

  const activeWorktreePath = activeWorktree?.path || currentProject?.path

  const sessions = useSessionsForProject(currentProject?.id || "", activeWorktreePath)
  const recentSessions = useMemo(() => {
    if (sessions.length === 0) return []
    return [...sessions].sort((a, b) => b.time.updated - a.time.updated).slice(0, 10)
  }, [sessions])
  const currentSession = useCurrentSession()
  const createLoading = useSessionsCreateLoading()
  const sessionsLoading = useSessionsListLoading()
  const sessionsError = useSessionsError()

  // Load sessions when project changes
  useEffect(() => {
    if (currentProject?.id) {
      void loadWorktrees(currentProject.id)
    }
  }, [currentProject?.id, loadWorktrees])

  useEffect(() => {
    if (currentProject?.id && activeWorktreePath) {
      loadSessions(currentProject.id, activeWorktreePath)
    }
  }, [currentProject?.id, activeWorktreePath, loadSessions])

  const handleNewSession = async () => {
    if (!currentProject?.path || !activeWorktreePath) return

    try {
      const session = await createSession(
        currentProject.id,
        activeWorktreePath,
        "New Session"
      )
      selectSession(session)
      if (session?.id) {
        navigate(`/projects/${currentProject.id}/${activeWorktreeId}/sessions/${session.id}/chat`)
      }
    } catch (error) {
      console.error("Failed to create session:", error)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!currentProject?.path || !activeWorktreePath) return

    try {
      await deleteSession(currentProject.id, activeWorktreePath, sessionId)
      navigate(`/projects/${currentProject.id}/${activeWorktreeId}/sessions`)
    } catch (error) {
      console.error("Failed to delete session:", error)
    }
  }

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

  const handleWorktreeSelect = (id: string) => {
    if (!currentProject?.id) return
    navigate(`/projects/${currentProject.id}/${id}`)
  }

  const handleWorktreeRemove = async (id: string) => {
    if (!currentProject?.id || id === "default") return
    setRemovingWorktreeId(id)
    try {
      await removeWorktree(currentProject.id, id)
      await loadWorktrees(currentProject.id)
      if (activeWorktreeId === id) {
        navigate(`/projects/${currentProject.id}/default`)
      }
    } catch (error) {
      console.error("Failed to remove worktree:", error)
    } finally {
      setRemovingWorktreeId(null)
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "running":
        return "text-green-500"
      case "starting":
        return "text-yellow-500"
      case "stopped":
        return "text-gray-500"
      case "error":
        return "text-red-500"
      default:
        return "text-gray-500"
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "starting":
        return <Loader2 className="h-3 w-3 animate-spin" />
      default:
        return <Circle className="h-3 w-3 fill-current" />
    }
  }

  const navigationItems = [
    { segment: "", icon: LayoutDashboard, label: "Dashboard" },
    { segment: "git", icon: GitBranch, label: "Git" },
    { segment: "agents", icon: Bot, label: "Agents" },
    { segment: "files", icon: Files, label: "Files" },
    { segment: "settings", icon: Settings, label: "Settings" },
  ]

  const basePath = currentProject?.id
    ? `/projects/${currentProject.id}/${activeWorktreeId}`
    : projectId
    ? `/projects/${projectId}/${activeWorktreeId}`
    : undefined

  return (
    <div
      data-testid="project-sidebar"
      className={`flex flex-col border-r border-border bg-background text-foreground transition-all duration-300 ease-in-out ${isCollapsed ? "w-[60px]" : "w-[250px]"} ${className} `}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#27272a] p-4">
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <Folder className="h-5 w-5 flex-shrink-0 text-blue-400" />
              <span className="truncate text-sm font-medium">
                {currentProject?.name || "No Project"}
              </span>
            </div>
            {activeWorktree && (
              <span className="mt-1 block truncate text-xs text-gray-500">
                {activeWorktree.title}
              </span>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          aria-label="Toggle sidebar"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 flex-shrink-0 p-0 hover:bg-muted/50"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!isCollapsed && (
        <div className="border-b border-[#27272a] px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium tracking-wider text-gray-400 uppercase">Worktrees</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300"
              onClick={() => {
                if (!currentProject?.id) return
                navigate(`/projects/${currentProject.id}/${activeWorktreeId}`)
              }}
              disabled={!currentProject?.id}
            >
              Manage
            </Button>
          </div>
          {worktreesLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading worktrees...
            </div>
          ) : (
            <div className="space-y-1">
              {sortedWorktrees.map((worktree) => {
                const isActive = worktree.id === activeWorktreeId
                const isDefault = worktree.id === "default"
                return (
                  <div
                    key={worktree.id}
                    className={`flex items-center justify-between rounded px-2 py-1 text-xs transition-colors ${
                      isActive ? "bg-blue-600/20 text-blue-300" : "hover:bg-[#27272a]"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-2 text-left"
                      onClick={() => handleWorktreeSelect(worktree.id)}
                    >
                      <span className="truncate">{worktree.title}</span>
                      {isActive && <span className="text-blue-400">•</span>}
                    </button>
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-400 hover:text-red-300"
                        onClick={() => handleWorktreeRemove(worktree.id)}
                        disabled={removingWorktreeId === worktree.id}
                      >
                        {removingWorktreeId === worktree.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* New Session Button */}
      <div className="p-4">
        <TooltipWrapper content="New Session" disabled={!isCollapsed}>
          <Button
            onClick={handleNewSession}
            disabled={!currentProject || createLoading}
            variant="default"
            className={`${isCollapsed ? "px-0" : "justify-start"}`}
          >
            {createLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {!isCollapsed && <span className="ml-2">New Session</span>}
          </Button>
        </TooltipWrapper>
      </div>

      {/* Sessions List */}
      {!isCollapsed && (
        <div className="min-h-0 flex-1">
          <div className="px-4 pb-2">
            <h3 className="text-xs font-medium tracking-wider text-gray-400 uppercase">Sessions</h3>
          </div>

          <ScrollArea className="flex-1 px-2">
            {sessionsError && (
              <div className="mx-2 mb-2 rounded border border-red-800 bg-red-900/20 p-2 text-xs text-red-400">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-3 w-3" />
                  <span>Failed to load sessions</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                  className="mt-1 h-6 text-xs text-red-400 hover:text-red-300"
                >
                  Dismiss
                </Button>
              </div>
            )}

            {sessionsLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            )}

            {!sessionsLoading && recentSessions.length === 0 && (
              <div className="px-2 py-8 text-center text-sm text-gray-500">No sessions yet</div>
            )}

            <div className="space-y-1">
              {recentSessions.map((session: Session) => (
                <div
                  key={session.id}
                  className={`group relative flex cursor-pointer items-center space-x-2 rounded-md px-2 py-2 transition-colors duration-150 ${
                    currentSession?.id === session.id
                      ? "border border-blue-600/30 bg-blue-600/20"
                      : "hover:bg-[#27272a]"
                  } `}
                  onClick={() => selectSession(session)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="truncate text-sm font-medium">{session.title}</span>
                    </div>
                    <div className="mt-1 flex items-center space-x-1">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(session.time.updated * 1000), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Session actions"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-muted/50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-40 border-border bg-popover text-popover-foreground"
                    >
                      <DropdownMenuItem className="text-xs text-white hover:bg-[#27272a] hover:text-white">
                        <Edit3 className="mr-2 h-3 w-3" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-[#27272a]" />
                      <DropdownMenuItem
                        className="text-xs text-red-400 hover:bg-[#27272a] hover:text-red-300"
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Navigation */}
      <div className="border-t border-[#27272a] p-2">
        <nav data-testid="main-navigation" className="space-y-1">
          {navigationItems.map((item) => {
            const target = basePath
              ? item.segment
                ? `${basePath}/${item.segment}`
                : basePath
              : "#"
            return (
              <TooltipWrapper key={item.label} content={item.label} disabled={!isCollapsed}>
                <NavLink
                  data-testid={item.label === "Dashboard" ? "dashboard-nav" : `nav-${item.label.toLowerCase()}`}
                  to={target}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? "border border-blue-600/30 bg-blue-600/20 text-blue-400"
                        : "text-gray-300 hover:bg-[#27272a] hover:text-white"
                    } ${isCollapsed ? "justify-center" : ""}`
                  }
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </NavLink>
              </TooltipWrapper>
            )
          })}
        </nav>
      </div>

      {/* Project Info */}
      {!isCollapsed && currentProject && (
        <div className="border-t border-[#27272a] p-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">Path:</span>
              <span className="truncate font-mono text-xs text-gray-300">
                {currentProject.path}
              </span>
            </div>

            {currentProject.instance && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">Status:</span>
                <div className="flex items-center space-x-1">
                  <span className={`text-xs ${getStatusColor(currentProject.instance.status)}`}>
                    {getStatusIcon(currentProject.instance.status)}
                  </span>
                  <span
                    className={`text-xs capitalize ${getStatusColor(currentProject.instance.status)}`}
                  >
                    {currentProject.instance.status}
                  </span>
                  {currentProject.instance.port && currentProject.instance.status === "running" && (
                    <span className="text-xs text-gray-500">:{currentProject.instance.port}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

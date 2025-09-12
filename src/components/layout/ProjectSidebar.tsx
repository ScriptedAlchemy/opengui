import { useState, useEffect, useMemo } from "react"
import { NavLink } from "react-router-dom"
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
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function ProjectSidebar({ className }: ProjectSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const currentProject = useCurrentProject()
  const { loadSessions, createSession, selectSession, deleteSession, clearError } =
    useSessionsStore()

  const sessions = useSessionsForProject(currentProject?.id || "")
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
    if (currentProject?.id && currentProject?.path) {
      loadSessions(currentProject.id, currentProject.path)
    }
  }, [currentProject?.id, currentProject?.path, loadSessions])

  const handleNewSession = async () => {
    if (!currentProject?.path) return

    try {
      const session = await createSession(currentProject.id, currentProject.path, "New Session")
      selectSession(session)
    } catch (error) {
      console.error("Failed to create session:", error)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!currentProject?.path) return

    try {
      await deleteSession(currentProject.id, currentProject.path, sessionId)
    } catch (error) {
      console.error("Failed to delete session:", error)
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
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/git", icon: GitBranch, label: "Git" },
    { to: "/agents", icon: Bot, label: "Agents" },
    { to: "/files", icon: Files, label: "Files" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ]

  return (
    <div
      data-testid="project-sidebar"
      className={`flex flex-col border-r border-border bg-background text-foreground transition-all duration-300 ease-in-out ${isCollapsed ? "w-[60px]" : "w-[250px]"} ${className} `}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#27272a] p-4">
        {!isCollapsed && (
          <div className="flex min-w-0 flex-1 items-center space-x-2">
            <Folder className="h-5 w-5 flex-shrink-0 text-blue-400" />
            <span className="truncate text-sm font-medium">
              {currentProject?.name || "No Project"}
            </span>
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
          {navigationItems.map((item) => (
            <TooltipWrapper key={item.to} content={item.label} disabled={!isCollapsed}>
              <NavLink
                data-testid={item.label === "Dashboard" ? "dashboard-nav" : item.label.toLowerCase() === "sessions" ? "nav-sessions" : `nav-${item.label.toLowerCase()}`}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? "border border-blue-600/30 bg-blue-600/20 text-blue-400"
                      : "text-gray-300 hover:bg-[#27272a] hover:text-white"
                  } ${isCollapsed ? "justify-center" : ""} `
                }
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            </TooltipWrapper>
          ))}
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
import React from "react"

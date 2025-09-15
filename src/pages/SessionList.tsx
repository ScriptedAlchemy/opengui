import React, { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Plus,
  Search,
  MessageSquare,
  Calendar,
  Trash2,
  Share,
  Edit2,
  MoreVertical,
  SortAsc,
  SortDesc,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { useSessionsStore } from "@/stores/sessions"
import type { Session } from "@opencode-ai/sdk/client"
import { useCurrentProject, useProjectsActions, useProjectsStore } from "@/stores/projects"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"
import { cn, formatDateTime, formatRelativeTime } from "../lib/utils"

interface SessionItemProps {
  session: {
    id: string
    title: string
    time: {
      created: number
      updated: number
    }
    share?: {
      url: string
    }
  }
  projectId: string
  onSelect: () => void
  onDelete: () => void
  onShare: () => void
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  projectId,
  onSelect,
  onDelete,
  onShare,
}) => {
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // Guard against missing session data
  if (!session) {
    return null
  }

  const handleDelete = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setIsDeleting(true)
    try {
      onDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    onShare()
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Navigate to chat interface for editing
    navigate(`/projects/${projectId}/sessions/${session.id}/chat`)
  }

  return (
    <>
    <div
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenuOpen(true)
      }}
      className="group relative cursor-pointer rounded-lg border border-border bg-card p-4 transition-all hover:bg-accent/50"
      data-testid="session-item"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MessageSquare className="h-4 w-4 flex-shrink-0 text-primary" />
          <h3 className="truncate font-medium text-foreground">{session.title || "Untitled Session"}</h3>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            data-testid="delete-button"
            aria-label="Delete session"
            onClick={(e) => {
              e.stopPropagation()
              setShowConfirm(true)
            }}
            className="h-8 w-8 text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="More actions"
                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="border-border bg-popover text-popover-foreground"
            data-testid="session-context-menu"
          >
            <DropdownMenuItem onClick={handleEdit} className="text-foreground hover:bg-[#262626]">
              <Edit2 className="mr-2 h-4 w-4" />
              Open
            </DropdownMenuItem>
            {session.share && (
              <DropdownMenuItem onClick={handleShare} className="text-foreground hover:bg-[#262626]">
                <Share className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-[#262626]" />
            <DropdownMenuItem
              onClick={() => setShowConfirm(true)}
              disabled={isDeleting}
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

       <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span title={session.time?.updated ? formatDateTime(session.time.updated) : ""}>
              {session.time?.updated ? formatRelativeTime(session.time.updated) : "No date"}
            </span>
          </div>
        </div>

        {session.share && (
          <div className="flex items-center gap-1 text-primary">
            <Share className="h-3 w-3" />
            <span className="text-xs">Shared</span>
          </div>
        )}
      </div>
    </div>
    {/* Delete confirmation dialog for e2e */}
    {showConfirm && (
      <div
        data-testid="delete-confirmation-dialog"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={(e) => {
          e.stopPropagation()
          setShowConfirm(false)
        }}
      >
        <div
          className="rounded-lg border border-border bg-background p-4 text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="mb-2 text-lg font-semibold">Delete Session</h4>
          <p className="mb-4 text-sm text-muted-foreground">
            Are you sure you want to delete "{session.title || "Untitled Session"}"?
          </p>
          <div className="flex justify-end gap-2">
            <Button
              data-testid="cancel-delete-button"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                setShowConfirm(false)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={(e) => {
                handleDelete(e)
                setShowConfirm(false)
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

const EmptyState: React.FC<{ onCreateSession: () => void }> = ({ onCreateSession }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
     <MessageSquare className="mb-4 h-16 w-16 text-muted-foreground" />
    <h3 className="mb-2 text-xl font-semibold text-foreground">No sessions yet</h3>
    <p className="mb-6 max-w-md text-muted-foreground">
      Start your first conversation with OpenCode. Create a new session to begin chatting with AI
      about your project.
    </p>
    <Button onClick={onCreateSession} variant="default">
      <Plus className="mr-2 h-4 w-4" />
      Create First Session
    </Button>
  </div>
)

const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <div className="flex items-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>Loading sessions...</span>
    </div>
  </div>
)

const ErrorState: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <AlertCircle className="mb-4 h-16 w-16 text-red-400" />
    <h3 className="mb-2 text-xl font-semibold text-foreground">Failed to load sessions</h3>
    <p className="mb-6 max-w-md text-muted-foreground">{error}</p>
    <Button
      onClick={onRetry}
      variant="outline"
      className="border-border text-foreground hover:bg-card"
    >
      Try Again
    </Button>
  </div>
)

type SortOption = "recent" | "alphabetical" | "created"

export default function SessionList() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const currentProject = useCurrentProject()
  const { selectProject } = useProjectsActions()
  const effectiveProjectId = projectId || currentProject?.id

  const {
    sessions,
    listLoading,
    createLoading,
    error,
    loadSessions,
    createSession,
    deleteSession,
    clearError,
  } = useSessionsStore()

  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("recent")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [projectLoading, setProjectLoading] = useState(false)

  const projectSessions = useMemo(() => {
    if (!effectiveProjectId) {
      return []
    }
    return sessions.get(effectiveProjectId) || []
  }, [sessions, effectiveProjectId])

  // Ensure project is loaded and then load sessions
  useEffect(() => {
    const loadProjectAndSessions = async () => {
      if (!effectiveProjectId) return
      
      // If currentProject is not loaded, try to load it
      if (!currentProject || currentProject.id !== effectiveProjectId) {
        setProjectLoading(true)
        try {
          await selectProject(effectiveProjectId)
          // After selection, get the current project from the store
          const storeState = useProjectsStore.getState()
          const updatedProject = storeState.currentProject
          if (updatedProject?.path) {
            await loadSessions(effectiveProjectId, updatedProject.path)
          }
        } catch (err) {
          console.error("Failed to load project:", err)
        } finally {
          setProjectLoading(false)
        }
      } else if (currentProject?.path) {
        // Project is already loaded, just load sessions
        loadSessions(effectiveProjectId, currentProject.path)
      }
    }
    
    loadProjectAndSessions()
  }, [effectiveProjectId, currentProject, selectProject, loadSessions])

  // Clear error when component unmounts
  useEffect(() => {
    return () => clearError()
  }, [clearError])

  // Filter and sort sessions
  const filteredAndSortedSessions = useMemo(() => {
    let filtered = projectSessions

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((session) =>
        (session.title || "Untitled Session").toLowerCase().includes(query)
      )
    }

    // Sort sessions
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case "recent":
          comparison = b.time.updated - a.time.updated
          break
        case "created":
          comparison = b.time.created - a.time.created
          break
        case "alphabetical":
          comparison = (a.title || "Untitled Session").localeCompare(b.title || "Untitled Session")
          break
      }

      return sortOrder === "asc" ? -comparison : comparison
    })

    return sorted
  }, [projectSessions, searchQuery, sortBy, sortOrder])

  const handleCreateSession = async () => {
    if (!effectiveProjectId || !currentProject?.path) {
      console.error("Cannot create session: missing projectId or currentProject.path", { projectId, currentProject })
      return
    }

    // Prevent double-clicking during creation
    if (createLoading) {
      console.log("Session creation already in progress, ignoring click")
      return
    }

    try {
      console.log("Creating session for project:", { projectId, path: currentProject.path })
      const session = await createSession(effectiveProjectId, currentProject.path)
      console.log("Session created successfully:", session)
      
      if (!session || !session.id) {
        console.error("Invalid session returned from createSession:", session)
        // Show error message to user
        console.error("Session creation failed: Invalid session data")
        return
      }
      
      // Validate session ID format (should be a non-empty string)
      if (typeof session.id !== 'string' || session.id.trim().length === 0) {
        console.error("Invalid session ID format:", session.id)
        return
      }
      
      const targetUrl = `/projects/${effectiveProjectId}/sessions/${session.id}/chat`
      console.log("Navigating to:", targetUrl)
      
      // Add a small delay to ensure the session is properly created before navigation
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Use replace instead of push to avoid history issues
      navigate(targetUrl, { replace: true })
      
      // Verify navigation succeeded after a short delay
      setTimeout(() => {
        const currentUrl = window.location.pathname
        if (!currentUrl.includes(`/sessions/${session.id}/chat`)) {
          console.warn("Navigation may have failed, current URL:", currentUrl)
        }
      }, 1000)
      
    } catch (error) {
      console.error("Failed to create session:", error)
      console.error("Error details:", error)
      // Show error message to user instead of silent navigation
      console.error("Session creation failed. Please try again.")
    }
  }

  const handleSelectSession = (sessionId: string) => {
    navigate(`/projects/${effectiveProjectId}/sessions/${sessionId}/chat`)
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!effectiveProjectId || !currentProject?.path) return
    await deleteSession(effectiveProjectId, currentProject.path, sessionId)
  }

  const handleShareSession = (session: Session) => {
    if (session.share?.url) {
      navigator.clipboard.writeText(session.share.url)
      // You might want to show a toast notification here
    }
  }

  const handleRetry = () => {
    if (effectiveProjectId && currentProject?.path) {
      loadSessions(effectiveProjectId, currentProject.path)
    }
  }

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  if (!effectiveProjectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-400" />
          <h3 className="mb-2 text-xl font-semibold text-foreground">Invalid Project</h3>
          <p className="text-muted-foreground">No project ID provided</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-background text-foreground" data-testid="sessions-page">
      {/* Header */}
      <div className="border-b border-border p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chat Sessions</h1>
             <p className="mt-1 text-muted-foreground">Manage your conversations with OpenCode</p>
          </div>

          <Button
            onClick={handleCreateSession}
            disabled={createLoading}
            variant="default"
            data-testid="new-session-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </div>

        {/* Search and Sort Controls */}
        <div className="flex items-center gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="sort-button" variant="outline">
                <Clock className="mr-2 h-4 w-4" />
                Sort: {sortBy === "recent" ? "Recent" : sortBy === "created" ? "Created" : "A-Z"}
                {sortOrder === "asc" ? (
                  <SortAsc className="ml-2 h-4 w-4" />
                ) : (
                  <SortDesc className="ml-2 h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-border bg-popover text-popover-foreground">
              <DropdownMenuItem
                onClick={() => setSortBy("recent")}
                className={cn(
                  "text-foreground hover:bg-accent",
                  sortBy === "recent" && "bg-accent"
                )}
              >
                Recent Activity
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortBy("created")}
                className={cn(
                  "text-foreground hover:bg-accent",
                  sortBy === "created" && "bg-accent"
                )}
              >
                Date Created
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortBy("alphabetical")}
                className={cn(
                  "text-foreground hover:bg-accent",
                  sortBy === "alphabetical" && "bg-accent"
                )}
              >
                Alphabetical
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={toggleSortOrder} className="text-foreground hover:bg-accent">
                {sortOrder === "asc" ? (
                  <>
                    <SortDesc className="mr-2 h-4 w-4" />
                    Sort Descending
                  </>
                ) : (
                  <>
                    <SortAsc className="mr-2 h-4 w-4" />
                    Sort Ascending
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {listLoading || projectLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : filteredAndSortedSessions.length === 0 ? (
          searchQuery.trim() ? (
            <div className="py-16 text-center">
              <Search className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold text-foreground">No sessions found</h3>
              <p className="text-muted-foreground">No sessions match your search for "{searchQuery}"</p>
            </div>
          ) : (
            <EmptyState onCreateSession={handleCreateSession} />
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="sessions-list">
            {filteredAndSortedSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                projectId={(effectiveProjectId || "") as string}
                onSelect={() => handleSelectSession(session.id)}
                onDelete={() => handleDeleteSession(session.id)}
                onShare={() => handleShareSession(session)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

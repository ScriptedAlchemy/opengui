/* @jsxImportSource react */
/* @jsxRuntime automatic */
import { useEffect, useMemo, useState } from "react"
import { ChevronDown, MessageSquare, Plus, Search } from "lucide-react"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { Input } from "../ui/input"
import { useSessionsForProject, useCurrentSession, useSessionsStore } from "@/stores/sessions"
import { useWorktreesStore, useWorktreesForProject } from "@/stores/worktrees"
import { useCurrentProject } from "@/stores/projects"
import { useParams, useNavigate } from "react-router-dom"

export function SessionSwitcher({ projectId: projectIdProp, navigateOverride }: { projectId?: string; navigateOverride?: (path: string) => void } = {}) {
  const params = useParams<{ projectId: string; worktreeId: string }>()
  const projectIdParam = params.projectId ?? ""
  const activeWorktreeId = params.worktreeId ?? "default"
  let navigate: (path: string) => void
  try {
    const hook = useNavigate()
    navigate = navigateOverride ?? hook
  } catch {
    navigate = navigateOverride ?? (() => {})
  }
  const pid = projectIdProp ?? projectIdParam ?? ""
  const currentProject = useCurrentProject()
  const loadWorktrees = useWorktreesStore((state) => state.loadWorktrees)
  const worktrees = useWorktreesForProject(pid)

  useEffect(() => {
    if (pid) {
      void loadWorktrees(pid)
    }
  }, [pid, loadWorktrees])

  const activeWorktreePath = useMemo(() => {
    if (activeWorktreeId === "default") {
      return currentProject?.path
    }
    return worktrees.find((worktree) => worktree.id === activeWorktreeId)?.path || currentProject?.path
  }, [activeWorktreeId, worktrees, currentProject?.path])

  const sessions = useSessionsForProject(pid, activeWorktreePath)
  const currentSession = useCurrentSession()
  const { createSession, selectSession } = useSessionsStore()
  const [searchQuery, setSearchQuery] = useState("")

  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
    // Helpful debug in tests
    console.debug("[SessionSwitcher] sessions count=", sessions.length, "projectId=", pid, "worktree=", activeWorktreeId)
  }

  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const basePath = pid ? `/projects/${pid}/${activeWorktreeId}` : undefined

  const handleNewSession = async () => {
    if (!pid || !activeWorktreePath) return
    try {
      const session = await createSession(pid, activeWorktreePath, "New Chat Session")
      if (session?.id && basePath) {
        navigate(`${basePath}/sessions/${session.id}/chat`)
      }
    } catch (error) {
      console.error("Failed to create session:", error)
    }
  }

  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (session) {
      selectSession(session)
      if (basePath) {
        navigate(`${basePath}/sessions/${sessionId}/chat`)
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="truncate">
              {currentSession ? currentSession.title : "Select Session"}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[250px]" align="start">
        <DropdownMenuLabel>Sessions</DropdownMenuLabel>
        <div className="p-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          {filteredSessions.length > 0 ? (
            filteredSessions.map((session) => (
              <DropdownMenuItem
                key={session.id}
                data-testid={`session-item-${session.id}`}
                onSelect={() => handleSelectSession(session.id)}
                onClick={() => handleSelectSession(session.id)}
                className="cursor-pointer"
              >
                <div className="flex w-full items-center gap-2">
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{session.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(session.time.updated * 1000).toLocaleDateString()}
                    </p>
                  </div>
                  {currentSession?.id === session.id && (
                    <div className="bg-primary h-2 w-2 shrink-0 rounded-full" />
                  )}
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="text-muted-foreground p-4 text-center text-sm">No sessions found</div>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="new-session" onSelect={handleNewSession} onClick={handleNewSession} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          New Session
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

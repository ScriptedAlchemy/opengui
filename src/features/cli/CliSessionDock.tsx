import { useEffect, useState } from "react"
import { Terminal, PlugZap, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useCurrentProject } from "@/stores/projects"
import { useWorktreesForProject } from "@/stores/worktrees"
import { useCliSessionsStore } from "@/stores/cliSessions"
import { CreateSessionDialog } from "./CreateSessionDialog"

interface CliSessionDockProps {
  className?: string
}

export function CliSessionDock({ className }: CliSessionDockProps) {
  const project = useCurrentProject()
  const worktrees = useWorktreesForProject(project?.id ?? "")
  const sessions = useCliSessionsStore((state) => state.sessions)
  const activeSessionId = useCliSessionsStore((state) => state.activeSessionId)
  const setActiveSession = useCliSessionsStore((state) => state.setActiveSession)
  const createSession = useCliSessionsStore((state) => state.createSession)
  const closeSession = useCliSessionsStore((state) => state.closeSession)
  const loadTools = useCliSessionsStore((state) => state.loadTools)
  const tools = useCliSessionsStore((state) => state.tools)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    void loadTools()
  }, [loadTools])

  const handleLaunchClick = () => {
    if (!project?.id) {
      alert("Select a project first")
      return
    }
    if (worktrees.length === 0) {
      alert("No worktrees available")
      return
    }
    setDialogOpen(true)
  }

  return (
    <TooltipProvider>
      <div className={cn("bg-card flex h-full flex-col", className)}>
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">CLI Sessions</p>
            <p className="text-foreground text-sm font-medium">
              {sessions.length} active
            </p>
          </div>
          <Button variant="default" size="sm" onClick={handleLaunchClick}>
            <PlugZap className="mr-2 h-4 w-4" />
            Launch
          </Button>
        </div>

        {project && (
          <CreateSessionDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            projectId={project.id}
            worktrees={worktrees}
            tools={tools}
            onCreateSession={createSession}
          />
        )}

        <ScrollArea className="flex-1">
          <div className="space-y-2 p-3">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setActiveSession(session.id)}
                className={cn(
                  "group flex w-full items-start justify-between rounded border px-3 py-2 text-left",
                  activeSessionId === session.id
                    ? "border-primary bg-primary/10"
                    : "border-transparent bg-background hover:border-border hover:bg-muted/40"
                )}
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Terminal className="h-4 w-4" />
                    {session.title || session.id}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {session.tool} · {session.worktreeId}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge
                    variant={session.status === "running" ? "default" : "secondary"}
                    className="uppercase"
                  >
                    {session.status}
                  </Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 transition group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation()
                          void closeSession(session.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Close session</TooltipContent>
                  </Tooltip>
                </div>
              </button>
            ))}
            {sessions.length === 0 ? (
              <div className="text-muted-foreground border border-dashed p-4 text-sm">
                No sessions yet. Launch one to start coding.
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  )
}

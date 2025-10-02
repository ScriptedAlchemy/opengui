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
import { Tooltip as ShadTooltip, TooltipContent as ShadTooltipContent, TooltipProvider as ShadTooltipProvider, TooltipTrigger as ShadTooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmSessionId, setConfirmSessionId] = useState<string | null>(null)

  useEffect(() => {
    void loadTools()
  }, [loadTools])

  const handleLaunchClick = () => {
    if (!project?.id) {
      toast.error("Select a project first")
      return
    }
    if (worktrees.length === 0) {
      toast.error("No worktrees available")
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
          {(() => {
            const canLaunch = !!project?.id && worktrees.length > 0
            const reason = !project?.id ? "Select a project first" : worktrees.length === 0 ? "No worktrees available" : null
            return (
              <ShadTooltipProvider>
                <ShadTooltip>
                  <ShadTooltipTrigger asChild>
                    <span>
                      <Button variant="default" size="sm" onClick={handleLaunchClick} disabled={!canLaunch}>
                        <PlugZap className="mr-2 h-4 w-4" />
                        Launch
                      </Button>
                    </span>
                  </ShadTooltipTrigger>
                  {reason ? <ShadTooltipContent>{reason}</ShadTooltipContent> : null}
                </ShadTooltip>
              </ShadTooltipProvider>
            )
          })()}
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
                data-testid="cli-session-row"
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
                        data-testid="session-close"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (session.status === "running" || session.status === "starting") {
                            setConfirmSessionId(session.id)
                            setConfirmOpen(true)
                          } else {
                            void closeSession(session.id)
                          }
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
      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!o) { setConfirmBusy(false); setConfirmSessionId(null) } setConfirmOpen(o) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will terminate the running CLI process and close the terminal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" disabled={confirmBusy}>Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={confirmBusy || !confirmSessionId}
                onClick={async () => {
                  if (!confirmSessionId) return
                  setConfirmBusy(true)
                  try {
                    await closeSession(confirmSessionId)
                    setConfirmOpen(false)
                    setConfirmSessionId(null)
                  } catch (error) {
                    toast.error("Failed to close session")
                    console.error("Session close error:", error)
                  } finally {
                    setConfirmBusy(false)
                  }
                }}
              >
                {confirmBusy ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ending...</>) : 'End Session'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}

import { useEffect, useMemo, useState } from "react"
import { GitBranch, PlayCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useCurrentProject } from "@/stores/projects"
import {
  useWorktreesForProject,
  useWorktreesLoading,
  useWorktreesStore,
  useWorktreesError,
} from "@/stores/worktrees"
import { useCliSessionsStore } from "@/stores/cliSessions"
import { CreateSessionDialog } from "../cli/CreateSessionDialog"
import { CreateWorktreeDialog } from "./CreateWorktreeDialog"
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
import { Checkbox } from "@/components/ui/checkbox"

interface WorktreeBoardProps {
  className?: string
}

export function WorktreeBoard({ className }: WorktreeBoardProps) {
  const project = useCurrentProject()
  const worktrees = useWorktreesForProject(project?.id ?? "")
  const isLoading = useWorktreesLoading(project?.id ?? "")
  const error = useWorktreesError(project?.id ?? "")
  const loadWorktrees = useWorktreesStore((state) => state.loadWorktrees)
  const removeWorktree = useWorktreesStore((state) => state.removeWorktree)
  const { createSession, tools, loadTools } = useCliSessionsStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedWorktreeId, setSelectedWorktreeId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteForce, setDeleteForce] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (project?.id) {
      void loadWorktrees(project.id)
    }
  }, [project?.id, loadWorktrees])

  useEffect(() => {
    void loadTools()
  }, [loadTools])

  const sorted = useMemo(() => {
    return [...worktrees].sort((a, b) => {
      if (a.id === "default") return -1
      if (b.id === "default") return 1
      return a.title.localeCompare(b.title)
    })
  }, [worktrees])

  const handleLaunchSession = (worktreeId: string) => {
    setSelectedWorktreeId(worktreeId)
    setDialogOpen(true)
  }

  const handleRemove = async (worktreeId: string) => {
    if (!project?.id || worktreeId === "default") return
    setPendingDeleteId(worktreeId)
    setDeleteForce(false)
    setDeleteOpen(true)
  }

  return (
    <TooltipProvider>
      <div className={cn("bg-background flex h-full flex-col", className)}>
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Worktrees</p>
            <p className="text-foreground text-sm font-medium">
              {project ? project.name : "Select a project"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            data-testid="open-new-worktree"
            onClick={() => setCreateDialogOpen(true)}
            disabled={!project}
          >
            New Worktree
          </Button>
        </div>

        {project && (
          <CreateWorktreeDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            projectId={project.id}
            onCreate={async (params) => {
              await useWorktreesStore.getState().createWorktree(project.id, params)
              await loadWorktrees(project.id)
            }}
          />
        )}

        {project && (
          <CreateSessionDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            projectId={project.id}
            worktrees={worktrees}
            tools={tools}
            defaultWorktreeId={selectedWorktreeId ?? undefined}
            onCreateSession={createSession}
          />
        )}

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent data-testid="remove-worktree-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove worktree?</AlertDialogTitle>
              <AlertDialogDescription>
                This will run <code className="font-mono">git worktree remove</code>. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {(() => {
              const wt = worktrees.find((w) => w.id === pendingDeleteId)
              return wt ? (
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  <div>Title: {wt.title}</div>
                  <div>Path: {wt.path}</div>
                  {wt.branch ? <div>Branch: {wt.branch}</div> : null}
                </div>
              ) : null
            })()}
            <div className="flex items-center gap-2">
              <Checkbox id="force-remove" checked={deleteForce} onCheckedChange={(v) => setDeleteForce(Boolean(v))} />
              <label htmlFor="force-remove" className="text-sm">Force remove</label>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline" disabled={deleteBusy}>Cancel</Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant="destructive"
                  disabled={deleteBusy}
                  onClick={async () => {
                    if (!project?.id || !pendingDeleteId) return
                    setDeleteBusy(true)
                    try {
                      await removeWorktree(project.id, pendingDeleteId, deleteForce)
                      setDeleteOpen(false)
                      setPendingDeleteId(null)
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Failed to remove worktree"
                      const { toast } = await import("sonner")
                      toast.error(message)
                      console.error("Worktree remove error:", error)
                    } finally {
                      setDeleteBusy(false)
                    }
                  }}
                >
                  {deleteBusy ? 'Removing…' : 'Remove'}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {error ? <div className="p-3 text-sm text-red-500">{error}</div> : null}
        <ScrollArea className="flex-1">
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((worktree) => (
              <Card key={worktree.id} className="border-muted-foreground/20 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 relative z-10">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    {worktree.title || worktree.id}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => handleLaunchSession(worktree.id)}>
                          <PlayCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Launch session</TooltipContent>
                    </Tooltip>
                    {worktree.id !== "default" ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            data-testid={`worktree-remove-${worktree.id}`}
                            onClick={() => void handleRemove(worktree.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove worktree</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div className="truncate">{worktree.path}</div>
                  {worktree.branch ? <div>Branch: {worktree.branch}</div> : null}
                  {worktree.relativePath ? <div>Relative: {worktree.relativePath}</div> : null}
                </CardContent>
              </Card>
            ))}
            {sorted.length === 0 && !isLoading ? (
              <div className="text-muted-foreground border-muted rounded border border-dashed p-6 text-center text-sm">
                No worktrees yet
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  )
}

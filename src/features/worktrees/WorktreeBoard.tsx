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
    const confirmed = confirm("Remove worktree? This will run git worktree remove.")
    if (!confirmed) return
    await removeWorktree(project.id, worktreeId, true)
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
          <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)} disabled={!project}>
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

        {error ? <div className="p-3 text-sm text-red-500">{error}</div> : null}
        <ScrollArea className="flex-1">
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((worktree) => (
              <Card key={worktree.id} className="border-muted-foreground/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
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

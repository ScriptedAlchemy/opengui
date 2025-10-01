import { useMemo, useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  useProjects,
  useProjectsLoading,
  useProjectsError,
  useProjectsActions,
  useCurrentProject,
} from "@/stores/projects"
import { AddProjectDialog } from "./AddProjectDialog"

interface ProjectRailProps {
  className?: string
}

export function ProjectRail({ className }: ProjectRailProps) {
  const projects = useProjects()
  const isLoading = useProjectsLoading()
  const error = useProjectsError()
  const current = useCurrentProject()
  const { selectProject, loadProjects, createProject } = useProjectsActions()
  const [dialogOpen, setDialogOpen] = useState(false)

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (a.lastOpened && b.lastOpened) {
        return new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
      }
      if (a.lastOpened) return -1
      if (b.lastOpened) return 1
      return a.name.localeCompare(b.name)
    })
  }, [projects])

  return (
    <TooltipProvider>
      <div className={cn("bg-card flex h-full flex-col", className)} data-testid="project-rail">
        <div className="border-border flex items-center justify-between border-b px-3 py-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Projects</p>
            <p className="text-foreground text-sm font-medium">
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={() => void loadProjects()} disabled={isLoading}>
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh projects</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDialogOpen(true)}
                  aria-label="Add project"
                  data-testid="add-project-button"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add project</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <AddProjectDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAddProject={createProject}
        />

      {error ? (
        <div className="p-3 text-sm text-red-500">{error}</div>
      ) : null}

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {sorted.map((project) => {
            const isActive = current?.id === project.id
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => void selectProject(project.id)}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left transition",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent bg-background hover:border-border hover:bg-muted/40"
                )}
              >
                <div className="text-sm font-medium">{project.name}</div>
                <div className="text-muted-foreground text-xs">{project.path}</div>
              </button>
            )
          })}
          {sorted.length === 0 && !isLoading ? (
            <div className="text-muted-foreground rounded border border-dashed p-4 text-sm">
              No projects yet
            </div>
          ) : null}
        </div>
      </ScrollArea>
      </div>
    </TooltipProvider>
  )
}

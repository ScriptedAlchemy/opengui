import { useEffect, useState } from "react"
import { FolderGit2, PanelsTopLeft, PlugZap, GitBranch, LayoutPanelLeft } from "lucide-react"
import { ProjectRail } from "@/features/projects/ProjectRail"
import { WorktreeBoard } from "@/features/worktrees/WorktreeBoard"
import { CliSessionDock } from "@/features/cli/CliSessionDock"
import { TerminalCanvas } from "@/features/cli/TerminalCanvas"
import { useProjectsActions, useCurrentProject } from "@/stores/projects"
import { useCliSessionsStore } from "@/stores/cliSessions"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { CreateWorktreeDialog } from "@/features/worktrees/CreateWorktreeDialog"
import { CreateSessionDialog } from "@/features/cli/CreateSessionDialog"
import { useWorktreesForProject } from "@/stores/worktrees"

export default function OperationsHub() {
  const { loadProjects } = useProjectsActions()
  const loadSessions = useCliSessionsStore((state) => state.loadSessions)
  const { createSession, tools, loadTools } = useCliSessionsStore()
  const project = useCurrentProject()
  const worktrees = project ? useWorktreesForProject(project.id) : []
  const [worktreesOpen, setWorktreesOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [newSessionOpen, setNewSessionOpen] = useState(false)
  const [newWorktreeOpen, setNewWorktreeOpen] = useState(false)

  useEffect(() => {
    void loadProjects()
    void loadSessions()
    void loadTools()
  }, [loadProjects, loadSessions, loadTools])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Slim project rail for quick switching */}
      <ProjectRail className="w-14 border-r" />

      {/* Terminal-first workspace */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
          <div className="flex items-center gap-2 px-3 py-2">
            <Button size="sm" variant="outline" onClick={() => setWorktreesOpen(true)} title="Worktrees">
              <GitBranch className="mr-2 h-4 w-4" /> Worktrees
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSessionsOpen(true)} title="Sessions">
              <PanelsTopLeft className="mr-2 h-4 w-4" /> Sessions
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="default" onClick={() => setNewSessionOpen(true)} data-testid="open-new-session">
                <PlugZap className="mr-2 h-4 w-4" /> New Session
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNewWorktreeOpen(true)} data-testid="open-new-worktree">
                <FolderGit2 className="mr-2 h-4 w-4" /> New Worktree
              </Button>
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          <TerminalCanvas className="flex-1" />
        </div>
      </div>

      {/* Worktrees side sheet */}
      <Sheet open={worktreesOpen} onOpenChange={setWorktreesOpen}>
        <SheetTrigger asChild><span className="hidden" /></SheetTrigger>
        <SheetContent side="left" className="w-[560px] p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2"><LayoutPanelLeft className="h-4 w-4" /> Worktrees</SheetTitle>
          </SheetHeader>
          <WorktreeBoard className="h-[calc(100%-49px)]" />
        </SheetContent>
      </Sheet>

      {/* Sessions side sheet */}
      <Sheet open={sessionsOpen} onOpenChange={setSessionsOpen}>
        <SheetTrigger asChild><span className="hidden" /></SheetTrigger>
        <SheetContent side="right" className="w-[420px] p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2"><PanelsTopLeft className="h-4 w-4" /> Sessions</SheetTitle>
          </SheetHeader>
          <CliSessionDock className="h-[calc(100%-49px)]" />
        </SheetContent>
      </Sheet>

      {/* New Worktree dialog */}
      {project && (
        <CreateWorktreeDialog
          open={newWorktreeOpen}
          onOpenChange={setNewWorktreeOpen}
          projectId={project.id}
          onCreate={async (params) => {
            const mod = await import("@/stores/worktrees")
            await mod.useWorktreesStore.getState().createWorktree(project.id, params)
            await mod.useWorktreesStore.getState().loadWorktrees(project.id)
            setNewWorktreeOpen(false)
          }}
        />
      )}

      {/* New Session dialog */}
      {project && (
        <CreateSessionDialog
          open={newSessionOpen}
          onOpenChange={setNewSessionOpen}
          projectId={project.id}
          worktrees={worktrees}
          tools={tools}
          onCreateSession={createSession}
        />
      )}
    </div>
  )
}

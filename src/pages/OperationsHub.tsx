import { useEffect, useState } from "react"
import { FolderGit2, PanelsTopLeft, PlugZap, GitBranch, LayoutPanelLeft } from "lucide-react"
import { ProjectRail } from "@/features/projects/ProjectRail"
import { WorktreeBoard } from "@/features/worktrees/WorktreeBoard"
import { CliSessionDock } from "@/features/cli/CliSessionDock"
import { TerminalCanvas } from "@/features/cli/TerminalCanvas"
import { useProjectsActions, useCurrentProject } from "@/stores/projects"
import { useCliSessionsStore } from "@/stores/cliSessions"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
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
  // Initialize persisted project rail width
  useEffect(() => {
    try {
      const saved = localStorage.getItem('project_rail_width')
      if (saved) {
        document.documentElement.style.setProperty('--project-rail-width', `${parseInt(saved, 10)}px`)
      }
    } catch {}
  }, [])

  useEffect(() => {
    void loadProjects()
    void loadSessions()
    void loadTools()
  }, [loadProjects, loadSessions, loadTools])

  // Keyboard shortcuts for overlays and quick actions
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (!e.shiftKey && (e.key === 'w' || e.key === 'W')) { // Alt+W
          e.preventDefault()
          setWorktreesOpen((v) => !v)
          return
        }
        if (!e.shiftKey && (e.key === 's' || e.key === 'S')) { // Alt+S
          e.preventDefault()
          setSessionsOpen((v) => !v)
          return
        }
        if (!e.shiftKey && (e.key === 'n' || e.key === 'N')) { // Alt+N
          e.preventDefault()
          setNewSessionOpen(true)
          return
        }
        if (e.shiftKey && (e.key === 'N')) { // Alt+Shift+N
          e.preventDefault()
          setNewWorktreeOpen(true)
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Project rail — wider and resizable */}
      <div className="relative border-r" style={{ width: 'var(--project-rail-width, 280px)' }} data-testid="project-rail-container">
        <ProjectRail className="w-full" />
        {/* Drag handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize"
          className="absolute right-[-3px] top-0 h-full w-1.5 cursor-col-resize select-none bg-transparent hover:bg-muted/40"
          onMouseDown={(e) => {
            const startX = e.clientX
            const container = (e.currentTarget.parentElement as HTMLDivElement)!
            const rect = container.getBoundingClientRect()
            const startWidth = rect.width
            const min = 220
            const max = 480
            const applyWidth = (next: number) => {
              const value = `${next}px`
              container.style.setProperty('--project-rail-width', value)
              document.documentElement.style.setProperty('--project-rail-width', value)
              try { localStorage.setItem('project_rail_width', String(next)) } catch {}
            }
            const onMove = (ev: MouseEvent) => {
              const delta = ev.clientX - startX
              const next = Math.min(max, Math.max(min, Math.round(startWidth + delta)))
              applyWidth(next)
            }
            const onUp = () => {
              window.removeEventListener('mousemove', onMove)
              window.removeEventListener('mouseup', onUp)
            }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
          onDoubleClick={(e) => {
            const container = (e.currentTarget.parentElement as HTMLDivElement)!
            const reset = 280
            const value = `${reset}px`
            container.style.setProperty('--project-rail-width', value)
            document.documentElement.style.setProperty('--project-rail-width', value)
            try { localStorage.setItem('project_rail_width', String(reset)) } catch {}
          }}
        />
      </div>

      {/* Terminal-first workspace */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
          <div className="flex items-center gap-2 px-3 py-2" data-testid="command-bar">
            <Button size="sm" variant="outline" onClick={() => setWorktreesOpen(true)} title="Worktrees" data-testid="btn-worktrees">
              <GitBranch className="mr-2 h-4 w-4" /> Worktrees
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSessionsOpen(true)} title="Sessions" data-testid="btn-sessions">
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

      {/* Worktrees sheet (left side) */}
      <Sheet open={worktreesOpen} onOpenChange={setWorktreesOpen}>
        <SheetTrigger asChild><span className="hidden" /></SheetTrigger>
        <SheetContent
          side="left"
          className="sm:max-w-none w-full p-0 top-[var(--header-height)] h-[calc(100vh-var(--header-height))] border-r z-50"
          data-testid="worktrees-drawer"
        >
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <LayoutPanelLeft className="h-4 w-4" /> Worktrees
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Manage git worktrees for the selected project.
            </SheetDescription>
          </SheetHeader>
          <WorktreeBoard className="h-[calc(100%-49px)]" />
        </SheetContent>
      </Sheet>

      {/* Sessions side sheet */}
      <Sheet open={sessionsOpen} onOpenChange={setSessionsOpen}>
        <SheetTrigger asChild><span className="hidden" /></SheetTrigger>
        <SheetContent
          side="right"
          className="sm:max-w-none w-[420px] p-0 top-[var(--header-height)] h-[calc(100vh-var(--header-height))] z-50"
          data-testid="sessions-sheet"
        >
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

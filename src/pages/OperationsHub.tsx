import { useEffect, useState } from "react"
import { ProjectRail } from "@/features/projects/ProjectRail"
import { WorktreeBoard } from "@/features/worktrees/WorktreeBoard"
import { CliSessionDock } from "@/features/cli/CliSessionDock"
import { TerminalCanvas } from "@/features/cli/TerminalCanvas"
import { useProjectsActions } from "@/stores/projects"
import { useCliSessionsStore } from "@/stores/cliSessions"

export default function OperationsHub() {
  const { loadProjects } = useProjectsActions()
  const loadSessions = useCliSessionsStore((state) => state.loadSessions)
  const [terminalFullscreen, setTerminalFullscreen] = useState(false)

  useEffect(() => {
    void loadProjects()
    void loadSessions()
  }, [loadProjects, loadSessions])

  // Exit fullscreen on Escape
  useEffect(() => {
    if (!terminalFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTerminalFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [terminalFullscreen])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {!terminalFullscreen && (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ProjectRail className="w-72 border-r" />
          <WorktreeBoard className="flex-1 border-r" />
          <CliSessionDock className="w-80" />
        </div>
      )}
      <TerminalCanvas
        className={terminalFullscreen ? "flex-1" : "h-72 border-t"}
        fullscreen={terminalFullscreen}
        onToggleFullscreen={() => {
          setTerminalFullscreen((v) => !v)
          // Kick xterm fit handlers
          setTimeout(() => window.dispatchEvent(new Event("resize")), 0)
        }}
      />
    </div>
  )
}

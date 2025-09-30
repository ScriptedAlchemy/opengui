import { useEffect } from "react"
import { ProjectRail } from "@/features/projects/ProjectRail"
import { WorktreeBoard } from "@/features/worktrees/WorktreeBoard"
import { CliSessionDock } from "@/features/cli/CliSessionDock"
import { TerminalCanvas } from "@/features/cli/TerminalCanvas"
import { useProjectsActions } from "@/stores/projects"
import { useCliSessionsStore } from "@/stores/cliSessions"

export default function OperationsHub() {
  const { loadProjects } = useProjectsActions()
  const loadSessions = useCliSessionsStore((state) => state.loadSessions)

  useEffect(() => {
    void loadProjects()
    void loadSessions()
  }, [loadProjects, loadSessions])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ProjectRail className="w-72 border-r" />
        <WorktreeBoard className="flex-1 border-r" />
        <CliSessionDock className="w-80" />
      </div>
      <TerminalCanvas className="h-72 border-t" />
    </div>
  )
}

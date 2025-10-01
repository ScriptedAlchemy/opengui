import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { ProjectRail } from "@/features/projects/ProjectRail"
import { WorktreeBoard } from "@/features/worktrees/WorktreeBoard"
import { CliSessionDock } from "@/features/cli/CliSessionDock"
import { TerminalCanvas } from "@/features/cli/TerminalCanvas"
import { useProjectsActions } from "@/stores/projects"
import { useCliSessionsStore } from "@/stores/cliSessions"

export default function OperationsHub() {
  const { loadProjects } = useProjectsActions()
  const loadSessions = useCliSessionsStore((state) => state.loadSessions)
  const sessions = useCliSessionsStore((state) => state.sessions)
  const [topCollapsed, setTopCollapsed] = useState(false)
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    if (typeof window === "undefined") return 350
    const saved = window.localStorage.getItem("terminalHeightPx")
    const n = saved ? parseInt(saved, 10) : 350
    return Math.max(350, Math.min(n || 350, Math.round(window.innerHeight * 0.8)))
  })

  // Persist height
  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("terminalHeightPx", String(terminalHeight))
  }, [terminalHeight])

  // Refit xterm on height updates
  useLayoutEffect(() => {
    // Defer to next frame to allow layout to settle
    const t = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")))
    return () => cancelAnimationFrame(t)
  }, [terminalHeight])

  useEffect(() => {
    void loadProjects()
    void loadSessions()
  }, [loadProjects, loadSessions])

  // Exit collapse on Escape
  useEffect(() => {
    if (!topCollapsed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTopCollapsed(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [topCollapsed])

  // Keyboard shortcut to toggle collapse: Alt+Shift+C
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && !e.metaKey && !e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        setTopCollapsed((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // If no sessions remain, ensure not collapsed
  useEffect(() => {
    if (sessions.length === 0 && topCollapsed) setTopCollapsed(false)
  }, [sessions.length, topCollapsed])

  // Trigger xterm fit on collapse/expand transitions
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 0)
    return () => clearTimeout(t)
  }, [topCollapsed])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {!topCollapsed && (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ProjectRail className="w-64 border-r" />
          <WorktreeBoard className="flex-1 border-r" />
          <CliSessionDock className="w-96" />
        </div>
      )}
      {!topCollapsed && (
        <div
          role="separator"
          aria-orientation="horizontal"
          title="Drag to resize terminal"
          onDoubleClick={() => setTerminalHeight((h) => (h < window.innerHeight * 0.5 ? Math.round(window.innerHeight * 0.6) : 350))}
          onPointerDown={(e) => {
            const target = e.target as HTMLElement
            if (target.closest('button')) {
              return
            }
            target.setPointerCapture(e.pointerId)
            dragStateRef.current = { startY: e.clientY, startHeight: terminalHeight }
          }}
          onPointerMove={(e) => {
            if (!dragStateRef.current) return
            const dy = e.clientY - dragStateRef.current.startY
            // Invert so dragging UP increases terminal height (more terminal area)
            const next = dragStateRef.current.startHeight - dy
            const min = 350
            const max = Math.round(window.innerHeight * 0.85)
            setTerminalHeight(Math.max(min, Math.min(max, next)))
          }}
          onPointerUp={(e) => {
            try {
              (e.target as HTMLElement).releasePointerCapture(e.pointerId)
            } catch {}
            dragStateRef.current = null
          }}
          className="bg-border/60 hover:bg-border focus-visible:bg-ring relative h-1 w-full cursor-row-resize border-t outline-none"
          style={{ touchAction: "none" as any }}
        >
          <button
            type="button"
            aria-label="Collapse top panes"
            title="Collapse top panes"
            onClick={() => setTopCollapsed(true)}
            className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background px-2 py-1 text-xs shadow-sm"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      )}
      {topCollapsed && (
        <div
          role="separator"
          aria-orientation="horizontal"
          className="relative h-2 w-full border-t"
        >
          <button
            type="button"
            aria-label="Expand top panes"
            title="Expand top panes"
            onClick={() => setTopCollapsed(false)}
            className="absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background px-2 py-1 text-xs shadow-sm"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}
      <TerminalCanvas
        className={topCollapsed ? "flex-1" : "border-t"}
        style={!topCollapsed ? { height: `${terminalHeight}px` } : undefined}
      />
    </div>
  )
}

import { useEffect, useMemo, useRef } from "react"
import { useLocation } from "react-router-dom"
import { useCurrentProject } from "@/stores/projects"
import { useWorktreesStore, useWorktreeById } from "@/stores/worktrees"
import { useSessionsStore, sessionKeyForProjectPath } from "@/stores/sessions"

/**
 * WorktreeSessionSync
 *
 * Listens to route changes and ensures the sessions list is loaded for
 * the active project + worktree directory. This centralizes refresh logic
 * so counts and recents update immediately when switching worktrees.
 */
export default function WorktreeSessionSync() {
  const location = useLocation()
  const currentProject = useCurrentProject()
  const loadWorktrees = useWorktreesStore((s) => s.loadWorktrees)
  const loadSessions = useSessionsStore((s) => s.loadSessions)
  const lastKeyRef = useRef<string | null>(null)

  const { projectId, worktreeId } = useMemo(() => {
    const m = location.pathname.match(/^\/projects\/([^/]+)\/([^/]+)/)
    return { projectId: m?.[1] || "", worktreeId: m?.[2] || "default" }
  }, [location.pathname])

  // Subscribe to specific worktree metadata
  const activeWorktree = useWorktreeById(projectId, worktreeId)

  // Ensure worktrees are loaded for this project
  useEffect(() => {
    if (projectId) {
      void loadWorktrees(projectId)
    }
  }, [projectId, loadWorktrees])

  // Compute effective path for the active worktree
  const activePath = useMemo(() => {
    if (!projectId) return undefined
    if (worktreeId === "default") {
      return currentProject?.id === projectId ? currentProject?.path : activeWorktree?.path
    }
    return activeWorktree?.path || currentProject?.path
  }, [projectId, worktreeId, activeWorktree?.path, currentProject?.id, currentProject?.path])

  // Load sessions when (projectId, activePath) changes
  useEffect(() => {
    if (!projectId || !activePath) return
    const key = sessionKeyForProjectPath(projectId, activePath)
    if (lastKeyRef.current === key) return
    lastKeyRef.current = key
    void loadSessions(projectId, activePath)
  }, [projectId, activePath, loadSessions])

  return null
}

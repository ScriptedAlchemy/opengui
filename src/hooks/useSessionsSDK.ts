import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import type { SessionInfo } from "@/types/chat"
import { useProjectSDK } from "@/contexts/OpencodeSDKContext"

export function useSessionsSDK(
  projectId: string | undefined,
  projectPath: string | undefined,
  sessionId: string | undefined,
  instanceStatus: "running" | "stopped" | "starting",
  loadMessages: (sessionId: string) => Promise<void>,
  worktreeId?: string
) {
  // Mark loadMessages as intentionally unused here; message loading is handled by useMessagesSDK
  void loadMessages
  const navigate = useNavigate()
  const { client, isLoading: sdkLoading, error: sdkError } = useProjectSDK(projectId, projectPath)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  // Create new session (stable reference)
  const resolvedWorktreeId = worktreeId || "default"

  const handleCreateSession = useCallback(async () => {
    if (!projectId || !projectPath || !client) return

    try {
      setIsLoading(true)
      const response = await client.session.create({
        query: { directory: projectPath },
        body: {
          title: `New Session ${new Date().toLocaleString()}`,
        },
      })

      if (!response.data) {
        throw new Error("Failed to create session")
      }

      // Use SDK Session type directly (SessionInfo is an alias for Session)
      const newSession: SessionInfo = response.data

      setSessions((prev) => [...prev, newSession])
      setCurrentSession(newSession)
      navigate(`/projects/${projectId}/${resolvedWorktreeId}/sessions/${newSession.id}/chat`)
    } catch (error) {
      console.error("Failed to create session:", error)
      toast.error("Failed to create session")
    } finally {
      setIsLoading(false)
    }
  }, [projectId, projectPath, client, navigate, resolvedWorktreeId])

  // Load sessions
  useEffect(() => {
    const debug = (() => {
      try {
        return localStorage.getItem("debugSessions") === "1"
      } catch {
        return false
      }
    })()
    const log = (...args: unknown[]) => {
      if (debug) console.debug(...args)
    }

    log("useSessionsSDK: checking conditions", {
      projectId,
      projectPath,
      instanceStatus,
      sessionId,
      client: !!client,
    })

    // Only require projectId. If client is missing in test/dev, provide a safe fallback session
    if (!projectId) {
      log("useSessionsSDK: skipping load due to missing projectId")
      return
    }
    if (!client || !projectPath) {
      if (sessionId && sessionId !== "new") {
        const now = Date.now()
        const fallback: SessionInfo = {
          id: sessionId,
          projectID: projectId,
          directory: projectPath || "/",
          title: "Chat Session",
          version: "1.0.0",
          time: { created: now, updated: now },
        }
        setSessions([fallback])
        setCurrentSession(fallback)
      }
      log("useSessionsSDK: client or projectPath missing; using fallback (if any)")
      return
    }

    const loadSessions = async () => {
      try {
        log("useSessionsSDK: fetching sessions via SDK")
        const response = await client.session.list({
          query: { directory: projectPath },
        })
        log("useSessionsSDK: response received:", response)

        if (!response.data) {
          throw new Error("No data received from SDK")
        }

        // Use SDK Session type directly (SessionInfo is an alias for Session)
        const sessionsData: SessionInfo[] = response.data

        setSessions(sessionsData)

        // Load current session if sessionId is provided
        if (sessionId && sessionId !== "new") {
          const session = sessionsData.find((s: SessionInfo) => s.id === sessionId)
          log("useSessionsSDK: looking for session", { sessionId, found: !!session })
          if (session) {
            setCurrentSession(session)
            // Message loading handled in useMessagesSDK
          } else if (debug) {
            console.warn("useSessionsSDK: session not found; keeping current state")
          }
        } else if (sessionId === "new") {
          // Handle new session creation
          handleCreateSession()
        }
      } catch (error) {
        if (debug) console.error("Failed to load sessions:", error)
        if (sdkError && debug) {
          console.error("SDK error:", sdkError)
        }
        // Do not navigate away; keep current URL and allow UI to function with any existing state
      }
    }

    loadSessions()
  }, [projectId, projectPath, instanceStatus, client, handleCreateSession, sessionId, sdkError])

  // Rename session
  const handleRenameSession = async (sessionIdParam: string, newName: string) => {
    if (!projectId || !projectPath || !client || !newName.trim()) return

    try {
      const response = await client.session.update({
        path: { id: sessionIdParam },
        query: { directory: projectPath },
        body: { title: newName },
      })

      if (!response.data) {
        throw new Error("Failed to rename session")
      }

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionIdParam ? { ...s, title: newName } : s))
      )

      if (currentSession?.id === sessionIdParam) {
        setCurrentSession((prev) => (prev ? { ...prev, title: newName } : null))
      }

      toast.success("Session renamed")
    } catch (error) {
      console.error("Failed to rename session:", error)
      toast.error("Failed to rename session")
    } finally {
      setRenamingSessionId(null)
      setRenameValue("")
    }
  }

  // Delete session
  const handleDeleteSession = async (sessionIdParam: string) => {
    if (!projectId || !projectPath || !client) return

    try {
      await client.session.delete({
        path: { id: sessionIdParam },
        query: { directory: projectPath },
      })

      setSessions((prev) => prev.filter((s) => s.id !== sessionIdParam))

      if (currentSession?.id === sessionIdParam) {
        setCurrentSession(null)
        navigate(`/projects/${projectId}/${resolvedWorktreeId}/sessions`)
      }

      toast.success("Session deleted")
    } catch (error) {
      console.error("Failed to delete session:", error)
      toast.error("Failed to delete session")
    }
  }

  return {
    sessions,
    currentSession,
    isLoading: isLoading || sdkLoading,
    renamingSessionId,
    renameValue,
    setSessions,
    setCurrentSession,
    setIsLoading,
    setRenamingSessionId,
    setRenameValue,
    handleCreateSession,
    handleRenameSession,
    handleDeleteSession,
  }
}

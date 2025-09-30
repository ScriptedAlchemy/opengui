import { useEffect, useMemo, useRef } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useCliSessionsStore } from "@/stores/cliSessions"
import type { CliSession } from "@/stores/cliSessions"
import { Button } from "@/components/ui/button"
import { useCurrentProject } from "@/stores/projects"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"

interface TerminalCanvasProps {
  className?: string
}

export function TerminalCanvas({ className }: TerminalCanvasProps) {
  const sessions = useCliSessionsStore((state) => state.sessions)
  const activeSessionId = useCliSessionsStore((state) => state.activeSessionId)
  const setActiveSession = useCliSessionsStore((state) => state.setActiveSession)
  const closeSession = useCliSessionsStore((state) => state.closeSession)
  const project = useCurrentProject()

  const value = useMemo(() => {
    if (activeSessionId) return activeSessionId
    return sessions[0]?.id ?? "none"
  }, [activeSessionId, sessions])

  useEffect(() => {
    if (!activeSessionId && sessions[0]) {
      setActiveSession(sessions[0].id)
    }
  }, [activeSessionId, sessions, setActiveSession])

  if (sessions.length === 0) {
    return (
      <div className={cn("bg-card flex items-center justify-center", className)}>
        <div className="text-muted-foreground text-sm">
          {project ? "Launch a CLI session to begin." : "Select a project to launch sessions."}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("bg-background flex flex-col", className)}>
      <Tabs value={value} onValueChange={(next) => setActiveSession(next)} className="flex-1">
        <TabsList className="border-border/60 bg-card flex items-center justify-between border-b px-2">
          <div className="flex items-center gap-2">
            {sessions.map((session) => (
              <TabsTrigger key={session.id} value={session.id} className="flex items-center gap-2">
                <span className="text-sm font-medium">{session.title || session.id}</span>
                <span className="text-xs uppercase text-muted-foreground">{session.tool}</span>
              </TabsTrigger>
            ))}
          </div>
          {value !== "none" ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500"
              onClick={() => void closeSession(value)}
            >
              Close
            </Button>
          ) : null}
        </TabsList>
        {sessions.map((session) => (
          <TabsContent key={session.id} value={session.id} className="h-full">
            <CliTerminalPane session={session} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

interface CliTerminalPaneProps {
  session: CliSession
}

function CliTerminalPane({ session }: CliTerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const listenerCleanupRef = useRef<(() => void) | null>(null)
  const updateStatus = useCliSessionsStore((state) => state.updateSessionStatus)

  useEffect(() => {
    let disposed = false

    function setupXterm() {
      if (!containerRef.current) return

      const fitAddon = new FitAddon()
      const term = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        theme: {
          background: "#0f172a",
          foreground: "#f8fafc",
          cursor: "#38bdf8",
        },
      })

      termRef.current = term
      term.loadAddon(fitAddon)
      term.open(containerRef.current)
      fitAddon.fit()

      const handleResize = () => {
        try {
          fitAddon.fit()
          const { cols, rows } = term
          wsRef.current?.send(
            JSON.stringify({
              type: "resize",
              cols,
              rows,
            })
          )
        } catch {
          // ignore
        }
      }

      window.addEventListener("resize", handleResize)

      const onData = term.onData((data) => {
        wsRef.current?.send(
          JSON.stringify({
            type: "input",
            data,
          })
        )
      })

      listenerCleanupRef.current = () => {
        window.removeEventListener("resize", handleResize)
        onData.dispose()
        term.dispose()
      }

      const protocol = window.location.protocol === "https:" ? "wss" : "ws"
      const token = session.wsToken
      if (!token) {
        term.writeln("Error: No WebSocket token available for this session.")
        updateStatus(session.id, "error")
        return
      }
      const wsUrl = `${protocol}://${window.location.host}/ws/cli?token=${encodeURIComponent(token)}`
      const socket = new WebSocket(wsUrl)
      wsRef.current = socket

      socket.addEventListener("open", () => {
        updateStatus(session.id, "running")
        const { cols, rows } = term
        socket.send(JSON.stringify({ type: "resize", cols, rows }))
      })

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            type: string
            data?: string
            status?: string
            code?: number
          }
          if (payload.type === "data" && typeof payload.data === "string") {
            term.write(payload.data)
          } else if (payload.type === "exit") {
            updateStatus(session.id, "exited")
            term.writeln(`\r\nProcess exited (${payload.code ?? 0}).`)
          } else if (payload.type === "status" && payload.status) {
            updateStatus(session.id, payload.status as CliSession["status"])
          } else if (payload.type === "snapshot" && payload.data) {
            term.write(payload.data)
          }
        } catch (error) {
          console.warn("Failed parsing CLI message", error)
        }
      })

      socket.addEventListener("close", () => {
        if (!disposed) {
          updateStatus(session.id, "exited")
        }
      })

      socket.addEventListener("error", () => {
        updateStatus(session.id, "error")
      })
    }

    setupXterm()

    return () => {
      disposed = true
      listenerCleanupRef.current?.()
      listenerCleanupRef.current = null
      wsRef.current?.close()
      wsRef.current = null
      termRef.current = null
    }
  }, [session.id, updateStatus])

  return <div ref={containerRef} className="h-full w-full" />
}

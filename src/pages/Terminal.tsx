import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { X as StopIcon, RotateCcw as ResetIcon, Search as SearchIcon, ArrowDown, ArrowUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useCurrentProject } from "@/stores/projects"
import { useProjectSDK } from "@/contexts/OpencodeSDKContext"
import type { Event, Part, ToolState } from "@opencode-ai/sdk/client"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { useProjectsActions, useCurrentProject as useCurrentProjectFromStore } from "@/stores/projects"
// xterm runtime import; CSS is provided by the package at runtime
import type { Terminal as XTerm } from "xterm"
import "xterm/css/xterm.css"

type Entry = {
  id: string
  command: string
  output: string
  error?: string
  durationMs?: number
}

function joinPath(base: string, next: string): string {
  if (!next || next === ".") return base
  if (next === "~") return base // no home resolution in app; keep base
  if (next.startsWith("/")) return next

  const parts = [...base.split("/"), ...next.split("/")]
  const stack: string[] = []
  for (const p of parts) {
    if (!p || p === ".") continue
    if (p === "..") {
      if (stack.length > 1) stack.pop() // keep root
    } else {
      stack.push(p)
    }
  }
  // ensure leading slash if base was absolute
  const absolute = base.startsWith("/")
  return (absolute ? "/" : "") + stack.join("/")
}

export default function Terminal() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = useCurrentProject()
  const { client } = useProjectSDK(projectId, project?.path)

  const initialDir = useMemo(() => project?.path ?? "" , [project?.path])
  const [cwd, setCwd] = useState<string>(initialDir)
  // Legacy input state removed; typing is handled inside xterm
  const [history, setHistory] = useState<Entry[]>([])
  const [cursor, setCursor] = useState<number>(-1)
  const [running, setRunning] = useState<boolean>(false)

  // xterm
  const termRef = useRef<XTerm | null>(null)
  const termElRef = useRef<HTMLDivElement | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const activePartIdRef = useRef<string | null>(null)
  const lastOutputLenRef = useRef<number>(0)
  const sseAbortRef = useRef<AbortController | null>(null)
  const termInputRef = useRef<string>("")
  const promptRef = useRef<string>("")
  const searchAddonRef = useRef<any>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (project?.path) setCwd(project.path)
  }, [project?.path])

  // Initialize xterm
  useEffect(() => {
    let disposed = false
    let resizeObserver: ResizeObserver | null = null
    let onResize: ((this: Window, ev: UIEvent) => any) | null = null
    async function initTerm() {
      if (termRef.current || !termElRef.current) return
      // Dynamic import to avoid SSR/tooling issues
      const { Terminal } = await import("xterm")
      const t = new Terminal({
        cursorBlink: true,
        scrollback: 2000,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        theme: {
          background: "#000000",
          foreground: "#eeeeee",
          cursor: "#00ff9c",
        },
      })
      if (disposed) {
        t.dispose()
        return
      }
      termRef.current = t
      t.open(termElRef.current)
      t.write("OpenCode Terminal\r\n")
      {
        const name = project?.name ?? "project"
        const base = (cwd || project?.path || "") as string
        const cwdDisplay = base.replace(project?.path ?? "", "") || "/"
        t.write(`${name}:${cwdDisplay}$ `)
      }

      // Addons (optional)
      try {
        const [{ FitAddon }, { WebLinksAddon }] = await Promise.all([
          import("xterm-addon-fit"),
          import("xterm-addon-web-links"),
        ])
        const fitAddon = new FitAddon()
        const linksAddon = new WebLinksAddon()
        t.loadAddon(fitAddon)
        t.loadAddon(linksAddon)
        fitAddon.fit()
        if (typeof ResizeObserver !== "undefined" && termElRef.current) {
          resizeObserver = new ResizeObserver(() => fitAddon.fit())
          resizeObserver.observe(termElRef.current)
        }
        onResize = () => fitAddon.fit()
        window.addEventListener("resize", onResize)
      } catch (_e) {
        // Fit addon not available; skip
      }
      // Optional WebGL addon
      try {
        const { WebglAddon } = await import("xterm-addon-webgl")
        const webgl = new WebglAddon()
        t.loadAddon(webgl)
      } catch {
        // ignore
      }
      // Optional Search addon
      try {
        const { SearchAddon } = await import("xterm-addon-search")
        const searchAddon = new SearchAddon()
        t.loadAddon(searchAddon)
        searchAddonRef.current = searchAddon
      } catch {
        searchAddonRef.current = null
      }
    }
    void initTerm()
    return () => {
      disposed = true
      if (onResize) window.removeEventListener("resize", onResize)
      resizeObserver?.disconnect()
      termRef.current?.dispose()
      termRef.current = null
    }
  }, [])

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (!client || !project?.path) return null
    if (sessionId) return sessionId
    try {
      const created = await client.session.create({ query: { directory: project.path } })
      const id = created.data?.id ?? null
      setSessionId(id)
      return id
    } catch (e) {
      console.error("Failed to create terminal session:", e)
      return null
    }
  }, [client, project?.path, sessionId])

  const startEventStream = useCallback(async (sessId: string) => {
    if (!client) return
    // Abort any existing stream
    sseAbortRef.current?.abort()
    const abort = new AbortController()
    sseAbortRef.current = abort
    try {
      await client.event.subscribe({
        signal: abort.signal,
        onSseEvent: (evt) => {
          const ev = evt.data as Event
          if (ev.type !== "message.part.updated") return
          const part = ev.properties.part as Part
          if (part.type !== "tool") return
          if ((part as any).tool !== "bash") return
          if (part.sessionID !== sessId) return

          const toolPart = part as Extract<Part, { type: "tool" }>
          const state = toolPart.state
          const term = termRef.current
          if (!term) return

          // Establish active part
          if (!activePartIdRef.current) {
            activePartIdRef.current = toolPart.id
            lastOutputLenRef.current = 0
          }
          if (activePartIdRef.current !== toolPart.id) return

          if (state.status === "running") {
            const running = state as Extract<ToolState, { status: "running" }>
            const m = running.metadata as { output?: unknown } | undefined
            const full = typeof m?.output === "string" ? m.output : ""
            const prevLen = lastOutputLenRef.current
            if (full.length > prevLen) {
              const chunk = full.slice(prevLen)
              term.write(chunk.replace(/\n/g, "\r\n"))
              lastOutputLenRef.current = full.length
            }
          } else if (state.status === "completed") {
            const completed = state as Extract<ToolState, { status: "completed" }>
            const out = typeof completed.output === "string" ? completed.output : ""
            if (out && out.length > lastOutputLenRef.current) {
              const chunk = out.slice(lastOutputLenRef.current)
              term.write(chunk.replace(/\n/g, "\r\n"))
            }
            term.write("\r\n")
            activePartIdRef.current = null
            lastOutputLenRef.current = 0
            setRunning(false)
            term.write(`${promptRef.current} `)
          }
        },
      })
    } catch (e) {
      if ((e as any)?.name === "AbortError") return
      console.error("Terminal SSE error:", e)
    }
  }, [client])

  const runShell = useCallback(async (command: string) => {
    if (!client || !project?.path) return { output: "", error: "SDK not ready" }
    try {
      const sessId = await ensureSession()
      if (!sessId) return { output: "", error: "No session" }
      // Start SSE stream if not already running
      if (!sseAbortRef.current) {
        void startEventStream(sessId)
      }
      const start = performance.now()
      const resp = await client.session.shell({
        path: { id: sessId },
        body: { command, agent: "shell" },
        query: { directory: cwd || project.path },
      })
      void resp // response not used; stream handles output
      const end = performance.now()
      // No need to parse parts here; streaming handler will print
      setRunning(true)
      return { output: "", durationMs: Math.round(end - start) }
    } catch (e) {
      return { output: "", error: e instanceof Error ? e.message : String(e) }
    }
  }, [client, project?.path, cwd, ensureSession, startEventStream])

  const abortSession = useCallback(async () => {
    try {
      if (client && sessionId) {
        await client.session.abort({ path: { id: sessionId }, query: { directory: project?.path } })
      }
    } catch {
      // ignore
    } finally {
      setRunning(false)
      termRef.current?.write("^C\r\n")
      termRef.current?.write(`${promptRef.current} `)
    }
  }, [client, sessionId, project?.path])

  const resetSession = useCallback(async () => {
    await abortSession()
    if (client && sessionId) {
      try {
        await client.session.delete({ path: { id: sessionId }, query: { directory: project?.path } })
      } catch {
        // ignore
      }
    }
    setSessionId(null)
    activePartIdRef.current = null
    lastOutputLenRef.current = 0
    termInputRef.current = ""
    setHistory([])
    setCursor(-1)
    termRef.current?.clear()
    termRef.current?.write("OpenCode Terminal\r\n")
    termRef.current?.write(`${promptRef.current} `)
  }, [abortSession, client, sessionId, project?.path])

  const executeCommand = useCallback(
    async (cmd: string, echoInTerm: boolean) => {
      const command = cmd.trim()
      if (!command) return

      // local commands
      if (command === "clear") {
        termRef.current?.clear()
        setHistory([])
        // input bar removed
        termInputRef.current = ""
        setCursor(-1)
        termRef.current?.write(`${promptRef.current} `)
        return
      }
      if (command.startsWith("cd ") || command === "cd") {
        const target = command.slice(2).trim() || project?.path || cwd
        const next = joinPath(cwd || project?.path || "", target)
        if (echoInTerm) termRef.current?.write(`${promptRef.current} ${command}\r\n`)
        setHistory((h) => [...h, { id: crypto.randomUUID(), command, output: "" }])
        setCwd(next)
        // input bar removed
        termInputRef.current = ""
        setCursor(-1)
        termRef.current?.write(`\r\n${promptRef.current} `)
        return
      }

      const entryId = crypto.randomUUID()
      if (echoInTerm) termRef.current?.write(`${promptRef.current} ${command}\r\n`)
      setHistory((h) => [...h, { id: entryId, command, output: "" }])
      // input bar removed
      termInputRef.current = ""
      setCursor(-1)

      const result = await runShell(command)
      setHistory((h) => h.map((e) => (e.id === entryId ? { ...e, ...result } : e)))
    },
    [cwd, project?.path, runShell],
  )

  // Input bar removed; executeCommand is triggered from xterm handlers.

  // Cleanup event stream on unmount
  useEffect(() => {
    return () => {
      sseAbortRef.current?.abort()
      sseAbortRef.current = null
      // Attempt to clean up the ephemeral session
      const sid = sessionId
      const sdk = client
      if (sid && sdk) {
        sdk.session
          .delete({ path: { id: sid }, query: { directory: project?.path } })
          .catch(() => {})
      }
    }
  }, [client, project?.path, sessionId])

  // Removed input bar keyboard handler; input is captured directly in xterm.

  // Raw typing inside xterm
  useEffect(() => {
    const term = termRef.current
    if (!term) return

    const handleKey = (e: { key: string; domEvent: KeyboardEvent }) => {
      const ev = e.domEvent
      if (ev.key === "Enter") {
        term.write("\r\n")
        const cmd = termInputRef.current
        termInputRef.current = ""
        void executeCommand(cmd, false)
        return
      }
      if (ev.key === "Backspace") {
        if (termInputRef.current.length > 0) {
          term.write("\b \b")
          termInputRef.current = termInputRef.current.slice(0, -1)
        }
        return
      }
      // History navigation
      if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
        if (history.length === 0) return
        let nextIndex = cursor
        if (ev.key === "ArrowUp") nextIndex = cursor < 0 ? history.length - 1 : Math.max(0, cursor - 1)
        if (ev.key === "ArrowDown") nextIndex = cursor < 0 ? -1 : Math.min(history.length - 1, cursor + 1)

        // Erase current input
        for (let i = 0; i < termInputRef.current.length; i++) term.write("\b \b")
        const nextCmd = nextIndex === -1 ? "" : history[nextIndex]?.command ?? ""
        termInputRef.current = nextCmd
        if (nextCmd) term.write(nextCmd)
        setCursor(nextIndex)
        return
      }
      // Ctrl+C kill
      if (ev.ctrlKey && ev.key.toLowerCase() === "c") {
        void abortSession()
        termInputRef.current = ""
        return
      }
      // Printable single char
      if (e.key && e.key.length === 1 && !ev.ctrlKey && !ev.metaKey) {
        termInputRef.current += e.key
        term.write(e.key)
      }
    }
    // For pasted data and multi-char
    const handleData = (data: string) => {
      // Filter out CR which we handle in onKey
      const clean = data.replace(/\r/g, "")
      if (!clean) return
      if (clean.includes("\n")) {
        // Write lines and execute sequentially (use the last as current input)
        const parts = clean.split("\n")
        for (let i = 0; i < parts.length; i++) {
          const chunk = parts[i]
          if (chunk) {
            term.write(chunk)
            termInputRef.current += chunk
          }
          if (i < parts.length - 1) {
            term.write("\r\n")
            const cmd = termInputRef.current
            termInputRef.current = ""
            void executeCommand(cmd, false)
          }
        }
        return
      }
      term.write(clean)
      termInputRef.current += clean
    }

    const keySub = term.onKey(handleKey)
    const dataSub = term.onData(handleData)
    return () => {
      keySub.dispose()
      dataSub.dispose()
    }
  }, [executeCommand, abortSession, cursor, history])

  const prompt = useMemo(() => {
    const name = project?.name ?? "project"
    const cwdDisplay = cwd?.replace(project?.path ?? "", "") || "/"
    return `${name}:${cwdDisplay}$`
  }, [project?.name, project?.path, cwd])
  useEffect(() => {
    promptRef.current = prompt
  }, [prompt])

  const [fullScreen, setFullScreen] = useState(false)
  const containerClass = fullScreen
    ? "fixed inset-0 z-50 bg-background p-3"
    : ""

  const { startInstance } = useProjectsActions()
  const storeProject = useCurrentProjectFromStore()
  const instanceRunning = Boolean(storeProject?.instance && storeProject.instance.status === "running")

  // If client not ready (no instance), render helper UI
  if (!client || !instanceRunning) {
    return (
      <div className="p-4">
        <div className="mb-3">
          <h1 className="text-lg font-semibold">Terminal</h1>
          <p className="text-muted-foreground text-sm">
            Terminal requires a running project instance. Start your instance to continue.
          </p>
        </div>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Project: <span className="font-mono">{project?.name}</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => project?.id && startInstance(project.id)} size="sm">
                Start Instance
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("p-4", containerClass)}>
      <div className="mb-3">
        <h1 className="text-lg font-semibold">Terminal</h1>
        <p className="text-muted-foreground text-sm">Type directly in the terminal. Use Ctrl+C to kill.</p>
      </div>
      <Card className="border rounded-md bg-black">
        <div className="flex items-center justify-between border-b p-2">
          <div className="text-xs text-muted-foreground">Session: {sessionId ?? "(new)"}</div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setShowSearch((v) => !v)}>
                <SearchIcon className="mr-1 h-3 w-3" /> Find
              </Button>
              {showSearch && (
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && searchAddonRef.current) {
                        searchAddonRef.current.findNext(searchTerm || "")
                      }
                    }}
                    className="h-7 w-40"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => searchAddonRef.current?.findPrevious(searchTerm || "")}
                    title="Prev"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => searchAddonRef.current?.findNext(searchTerm || "")}
                    title="Next"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              const term = termRef.current
              if (!term) return
              try {
                const selected = term.hasSelection() ? term.getSelection() : ""
                if (selected) await navigator.clipboard.writeText(selected)
              } catch { /* ignore */ }
            }}>
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={() => { termRef.current?.clear() }}>
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => void resetSession()}>
              <ResetIcon className="mr-1 h-3 w-3" /> Reset
            </Button>
            <Button variant="destructive" size="sm" disabled={!running || !sessionId} onClick={() => void abortSession()}>
              <StopIcon className="mr-1 h-3 w-3" /> Kill
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFullScreen((v) => !v)}>
              {fullScreen ? "Exit Fullscreen" : "Fullscreen"}
            </Button>
          </div>
        </div>
        <div className={cn("h-[50vh] p-2", "xterm-container")}> 
          <div ref={termElRef} className="h-full w-full" />
        </div>
      </Card>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Directory:</span>
        <code className="font-mono">{cwd || project?.path || ""}</code>
        <span className="ml-auto">Commands: cd, clear</span>
      </div>
    </div>
  )
}

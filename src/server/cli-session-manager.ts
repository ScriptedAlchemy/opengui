import { randomUUID } from "node:crypto"
import { spawn, type IPty } from "node-pty"
import { EventEmitter } from "node:events"
import path from "node:path"
import os from "node:os"
import fs from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { WebSocket, RawData } from "ws"
import { Log } from "../util/log"

const execFileAsync = promisify(execFile)

export type CliToolId = "codex" | "claude" | "opencode"

export interface CliToolConfig {
  id: CliToolId
  name: string
  command: string
  args: string[]
  description: string
  env?: Record<string, string>
  available?: boolean
  version?: string
}

export interface CreateCliSessionInput {
  projectId: string
  worktreeId: string
  cwd: string
  tool: CliToolId
  title?: string
  commandArgs?: string[]
}

export interface CliSessionInfo {
  id: string
  title: string
  projectId: string
  worktreeId: string
  cwd: string
  tool: CliToolId
  status: "starting" | "running" | "exited" | "error"
  createdAt: string
  updatedAt: string
}

interface CliSessionRecord extends CliSessionInfo {
  pty: IPty
  buffer: string
  sockets: Set<WebSocket>
  emitter: EventEmitter
  lastActivity: Date
}

const BUFFER_LIMIT = 64 * 1024 // 64KB snapshot buffer
const SESSION_IDLE_TIMEOUT = 60 * 60 * 1000 // 1 hour
const MAX_SESSIONS_PER_PROJECT = 10
const MAX_TOTAL_SESSIONS = 50
const PTY_KILL_TIMEOUT = 5000 // 5 seconds to wait for graceful exit

export class CliSessionManager {
  private sessions = new Map<string, CliSessionRecord>()
  private idleCheckInterval: NodeJS.Timeout | null = null
  private logger = Log.create({ service: "cli-session-manager" })

  private tools: Record<CliToolId, CliToolConfig> = {
    codex: {
      id: "codex",
      name: "Codex CLI",
      command: "codex",
      args: [], // interactive TUI by default
      description: "OpenAI Codex assistant CLI",
    },
    claude: {
      id: "claude",
      name: "Claude Code",
      command: "claude",
      args: [], // interactive REPL by default
      description: "Anthropic Claude Code interactive CLI",
    },
    opencode: {
      id: "opencode",
      name: "OpenCode",
      command: "opencode",
      args: [], // interactive TUI by default
      description: "OpenCode terminal UI",
    },
  }

  constructor() {
    // Start idle session cleanup
    this.startIdleCheck()
    // Detect tool availability on startup
    this.detectToolAvailability()
  }

  // Reserved for future behavior differences in tests; currently unused
  // private isTestMode(): boolean {
  //   const v = process.env["AGENT_ORANGE_TEST_MODE"]
  //   return typeof v === "string" && /^(1|true)$/i.test(v)
  // }

  private startIdleCheck(): void {
    this.idleCheckInterval = setInterval(() => {
      this.cleanupIdleSessions()
    }, 5 * 60 * 1000) // Check every 5 minutes
  }

  private cleanupIdleSessions(): void {
    const now = Date.now()
    for (const [id, session] of this.sessions.entries()) {
      if (session.status === "running" && session.sockets.size === 0) {
        const idleTime = now - session.lastActivity.getTime()
        if (idleTime > SESSION_IDLE_TIMEOUT) {
          this.log("info", `Cleaning up idle session ${id} (idle for ${Math.round(idleTime / 1000)}s)`, { sessionId: id })
          this.close(id)
        }
      }
    }
  }

  private async detectToolAvailability(): Promise<void> {
    const tools = Object.values(this.tools)
    await Promise.all(
      tools.map(async (tool) => {
        try {
          const { stdout } = await execFileAsync(tool.command, ["--version"], {
            timeout: 5000,
          })
          tool.available = true
          tool.version = stdout.trim().split("\n")[0]
          this.log("info", `Detected ${tool.name}: ${tool.version}`)
        } catch (error) {
          tool.available = false
          this.log("info", `${tool.name} not available: ${tool.command}`)
        }
      })
    )
  }

  async listTools(): Promise<CliToolConfig[]> {
    return Object.values(this.tools)
  }

  private log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>): void {
    // Delegate to centralized logger (respects LOG_LEVEL and NODE_ENV)
    if (level === "info") this.logger.info(message, meta)
    else if (level === "warn") this.logger.warn(message, meta)
    else this.logger.error(message, meta)
  }

  listSessions(): CliSessionInfo[] {
    return Array.from(this.sessions.values()).map((session) => this.toInfo(session))
  }

  getSession(id: string): CliSessionRecord | null {
    return this.sessions.get(id) ?? null
  }

  async createSession(input: CreateCliSessionInput): Promise<CliSessionInfo> {
    // Enforce session limits
    const totalSessions = this.sessions.size
    if (totalSessions >= MAX_TOTAL_SESSIONS) {
      throw new Error(`Maximum total sessions (${MAX_TOTAL_SESSIONS}) reached`)
    }

    const projectSessions = Array.from(this.sessions.values()).filter(
      (s) => s.projectId === input.projectId
    ).length
    if (projectSessions >= MAX_SESSIONS_PER_PROJECT) {
      throw new Error(`Maximum sessions per project (${MAX_SESSIONS_PER_PROJECT}) reached`)
    }

    const toolConfig = this.tools[input.tool]
    if (!toolConfig) {
      throw new Error(`Unsupported CLI tool: ${input.tool}`)
    }

    if (toolConfig.available === false) {
      throw new Error(`${toolConfig.name} is not available on this system`)
    }

    const resolvedCwd = await this.resolveCwd(input.cwd)
    this.log("info", `Creating session for ${input.tool}`, {
      projectId: input.projectId,
      worktreeId: input.worktreeId,
      cwd: resolvedCwd,
    })

    const { command, args: baseArgs, env } = toolConfig
    const commandArgs = [...baseArgs, ...(input.commandArgs ?? [])]

    const pty = spawn(command, commandArgs, {
      cols: 120,
      rows: 32,
      cwd: resolvedCwd,
      env: {
        ...process.env,
        ...(env ?? {}),
      },
      encoding: "utf8",
    })

    const now = new Date()
    const nowISO = now.toISOString()
    const id = randomUUID()
    const record: CliSessionRecord = {
      id,
      title: input.title || `${toolConfig.name} · ${input.worktreeId}`,
      projectId: input.projectId,
      worktreeId: input.worktreeId,
      cwd: resolvedCwd,
      tool: toolConfig.id,
      status: "starting",
      createdAt: nowISO,
      updatedAt: nowISO,
      pty,
      buffer: "",
      sockets: new Set(),
      emitter: new EventEmitter(),
      lastActivity: now,
    }

    this.sessions.set(id, record)
    this.log("info", `Session created: ${id}`, { sessionId: id, tool: toolConfig.id })

    pty.onData((data) => {
      record.lastActivity = new Date()
      this.appendBuffer(record, data)
      this.broadcast(record, { type: "data", data })
    })

    pty.onExit(({ exitCode }) => {
      this.log("info", `Session exited: ${id}`, { sessionId: id, exitCode })
      record.status = "exited"
      record.updatedAt = new Date().toISOString()
      this.broadcast(record, { type: "exit", code: exitCode })
      this.cleanup(record.id)
    })

    // Mark running once first tick completes
    setImmediate(() => {
      if (this.sessions.has(id)) {
        record.status = "running"
        record.updatedAt = new Date().toISOString()
        this.broadcast(record, { type: "status", status: "running" })
      }
    })

    return this.toInfo(record)
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error("Session not found")
    session.lastActivity = new Date()
    session.pty.write(data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error("Session not found")
    session.pty.resize(Math.max(20, cols), Math.max(4, rows))
  }

  attachWebSocket(sessionId: string, socket: WebSocket): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      socket.close(4004, "Session not found")
      return
    }

    session.sockets.add(socket)
    const snapshot = session.buffer
    if (snapshot.length > 0) {
      socket.send(JSON.stringify({ type: "snapshot", data: snapshot }))
    }
    socket.send(JSON.stringify({ type: "status", status: session.status }))

    const onMessage = (data: RawData) => {
      try {
        const payload = typeof data === "string" ? data : data.toString()
        const parsed = JSON.parse(payload) as {
          type: "input" | "resize"
          data?: string
          cols?: number
          rows?: number
        }
        if (parsed.type === "input" && typeof parsed.data === "string") {
          this.write(sessionId, parsed.data)
        } else if (
          parsed.type === "resize" && typeof parsed.cols === "number" && typeof parsed.rows === "number"
        ) {
          this.resize(sessionId, parsed.cols, parsed.rows)
        }
      } catch (error) {
        this.log("warn", "Invalid CLI session message", { error: String(error) })
      }
    }

    const onClose = () => {
      socket.off("message", onMessage)
      socket.off("close", onClose)
      socket.off("error", onClose)
      session.sockets.delete(socket)
    }

    socket.on("message", onMessage)
    socket.on("close", onClose)
    socket.on("error", onClose)
  }

  async close(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    this.log("info", `Closing session: ${sessionId}`, { sessionId })

    // Attempt graceful shutdown with timeout
    const ptyKilled = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.log("warn", `PTY did not exit gracefully within ${PTY_KILL_TIMEOUT}ms, forcing cleanup`, { sessionId })
        resolve()
      }, PTY_KILL_TIMEOUT)

      session.pty.onExit(() => {
        clearTimeout(timeout)
        resolve()
      })

      session.pty.kill()
    })

    await ptyKilled
    this.cleanup(sessionId)
  }

  private cleanup(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    this.log("info", `Cleaning up session: ${sessionId}`, { sessionId, socketCount: session.sockets.size })
    session.sockets.forEach((socket) => {
      try {
        socket.close()
      } catch {
        // ignore
      }
    })
    session.sockets.clear()
    this.sessions.delete(sessionId)
  }

  shutdown(): void {
    this.log("info", "Shutting down CLI session manager")
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval)
      this.idleCheckInterval = null
    }
    for (const id of this.sessions.keys()) {
      this.close(id)
    }
  }

  private toInfo(session: CliSessionRecord): CliSessionInfo {
    const { pty: _pty, sockets: _sockets, buffer: _buffer, emitter: _emitter, lastActivity: _lastActivity, ...info } = session
    return info
  }

  private broadcast(session: CliSessionRecord, payload: unknown) {
    const message = JSON.stringify(payload)
    for (const socket of session.sockets) {
      try {
        socket.send(message)
      } catch (error) {
        this.log("warn", "Failed sending CLI payload", { error: String(error) })
      }
    }
  }

  private appendBuffer(session: CliSessionRecord, chunk: string) {
    session.buffer += chunk
    if (session.buffer.length > BUFFER_LIMIT) {
      session.buffer = session.buffer.slice(session.buffer.length - BUFFER_LIMIT)
    }
  }

  private async resolveCwd(inputPath: string): Promise<string> {
    if (!inputPath) throw new Error("cwd is required")
    const normalized = path.resolve(inputPath)
    const stat = await fs.stat(normalized)
    if (!stat.isDirectory()) {
      throw new Error("cwd must be a directory")
    }
    // Enforce cwd under HOME or TMP
    const [realCwd, realHome, realTmp] = await Promise.all([
      fs.realpath(normalized).then((p) => path.resolve(p)),
      fs.realpath(os.homedir()).catch(() => os.homedir()).then((p) => path.resolve(p)),
      fs.realpath(os.tmpdir()).catch(() => os.tmpdir()).then((p) => path.resolve(p)),
    ])
    const within =
      realCwd === realHome ||
      realCwd.startsWith(`${realHome}${path.sep}`) ||
      realCwd === realTmp ||
      realCwd.startsWith(`${realTmp}${path.sep}`)
    if (!within) {
      throw new Error("cwd must be within the home or temp directory")
    }
    return realCwd
  }
}

export const cliSessionManager = new CliSessionManager()

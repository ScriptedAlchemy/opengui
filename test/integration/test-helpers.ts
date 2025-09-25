import { createOpencodeServer } from "@opencode-ai/sdk"
import { spawnProcess, spawnAdvanced, sleep, file, serve } from "../utils/node-utils"
import { dirname, join, resolve } from "path"
import { fileURLToPath } from "url"
import type { Readable } from "stream"

type SpawnedProcess = ReturnType<typeof spawnAdvanced>

export interface TestServer {
  serverProcess: SpawnedProcess | null
  baseUrl: string
  tempDir: string
  cleanup: () => Promise<void>
}

export interface ServerReadySignal {
  ready: boolean
  error?: string
  port?: number
}

// Track all active test servers for cleanup
const activeServers = new Set<TestServer>()

// Clean up all servers on process exit
process.on("beforeExit", async () => {
  for (const testServer of activeServers) {
    await testServer.cleanup()
  }
})

// Optimized server creation using Bun's advanced spawn features
export async function createTestServer(): Promise<TestServer> {
  // Create temp directory using Node.js fs operations
  const here = dirname(fileURLToPath(import.meta.url))
  const uniqueSuffix = `opencode-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const repoRoot = resolve(here, '../../..')
  const repoTempRoot = join(repoRoot, "tmp")
  const systemTempRoot = "/tmp"
  const tempRoot = (await file.exists(repoRoot)) ? repoTempRoot : systemTempRoot
  const tempDir = join(tempRoot, uniqueSuffix)

  await spawnProcess(["mkdir", "-p", tempDir])
  console.log(`Created temp directory: ${tempDir}`)

  // Set up environment for the OpenCode server
  const env = {
    ...process.env,
    NODE_ENV: "test",
    OPENCODE_DATA_DIR: tempDir,
    OPENCODE_LOG_LEVEL: "INFO",
    OPENCODE_PRINT_LOGS: "true",
  }

  // Prefer starting the OpenCode server using the SDK to avoid external CLI dependency
  try {
    const sdkServer = await createOpencodeServer({ port: 0, hostname: "127.0.0.1" })

    // Quick readiness check (SDK resolves when listening)
    // Prepare cleanup
    const cleanup = async () => {
      try {
        console.log(`Cleaning up server at ${sdkServer.url}`)
        try {
          await Promise.resolve(sdkServer.close())
        } catch (e) {
          console.log("Error closing SDK server:", e)
        }
        await sleep(200)
        try {
          await spawnProcess(["rm", "-rf", tempDir])
          console.log(`Removed temp directory: ${tempDir}`)
        } catch (e) {
          console.log("Could not remove temp directory:", e)
        }
      } finally {
        // Remove from active servers
        // 'result' will be defined after we construct it
      }
    }

    const result: TestServer = {
      serverProcess: null,
      baseUrl: sdkServer.url,
      tempDir,
      cleanup: async () => {
        await cleanup()
        activeServers.delete(result)
      },
    }
    activeServers.add(result)
    console.log(`Server ready at ${sdkServer.url}`)
    return result
  } catch (sdkError) {
    console.log("SDK server start failed, falling back to CLI spawn:", sdkError)
  }

  // Fallback: Get the path to the OpenCode CLI (monorepo dev environment only)
  const opencodePath = `${process.cwd()}/../../packages/opencode/src/index.ts`

  // Find an available port for CLI fallback
  const portFinder = serve({
    port: 0,
    fetch() {
      return new Response("ok")
    },
  })
  const port = portFinder.port
  portFinder.stop()
  console.log(`Using port: ${port}`)

  const baseUrl = `http://127.0.0.1:${port}`

  // Create a promise that resolves when server is ready
  let readyResolver: (value: ServerReadySignal) => void
  let readyRejecter: (error: Error) => void
  const readyPromise = new Promise<ServerReadySignal>((resolve, reject) => {
    readyResolver = resolve
    readyRejecter = reject
  })

  // Start the OpenCode server with enhanced monitoring (CLI fallback)
  console.log(`Starting OpenCode server: bun run ${opencodePath} serve --port ${port}`)
  const serverProcess = spawnAdvanced({
    cmd: ["bun", "run", opencodePath, "serve", "--port", String(port), "--hostname", "127.0.0.1"],
    env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore", // We don't need stdin for the server
    onExit: (_, exitCode, signalCode, error) => {
      if (exitCode !== null && exitCode !== 0) {
        readyRejecter(new Error(`Server exited with code ${exitCode}, signal: ${signalCode}, error: ${error?.message}`))
      }
    },
  })

  // Enhanced stdout/stderr monitoring for better readiness detection
  const stdoutMonitor = monitorServerOutput(serverProcess.stdout, port || 0, readyResolver!, readyRejecter!)
  const stderrMonitor = monitorServerOutput(serverProcess.stderr, port || 0, readyResolver!, readyRejecter!, true)

  // Cleanup function with better resource management
  const cleanup = async () => {
    try {
      console.log(`Cleaning up server at ${baseUrl}`)

      // Cancel output monitoring first
      stdoutMonitor?.cancel()
      stderrMonitor?.cancel()

      // Graceful shutdown with timeout
      if (serverProcess) {
        console.log("Sending SIGTERM to server process")
        serverProcess.kill("SIGTERM")

        // Wait for graceful shutdown with shorter timeout
        try {
          await Promise.race([
            serverProcess.exited,
            sleep(1000).then(() => {
              console.log("Graceful shutdown timeout, sending SIGKILL")
              serverProcess.kill("SIGKILL")
              return serverProcess.exited
            }),
          ])
        } catch (e) {
          console.log("Error during server shutdown:", e)
        }
      }

      // Wait a bit for the server to fully shut down
      await sleep(200)

      // Remove temp directory using Node.js operations
      try {
        await spawnProcess(["rm", "-rf", tempDir])
        console.log(`Removed temp directory: ${tempDir}`)
      } catch (e) {
        // Directory might not exist or already be removed
        console.log("Could not remove temp directory:", e)
      }

      // Remove from active servers
      activeServers.delete(result)
      console.log(`Server cleanup complete for ${baseUrl}`)
    } catch (error) {
      console.error("Cleanup error:", error)
    }
  }

  // Wait for server to be ready with timeout
  const timeoutPromise = sleep(15000).then(() => ({
    ready: false,
    error: "Server startup timeout after 15 seconds",
  }))

  const readySignal = await Promise.race([readyPromise, timeoutPromise])

  if (!readySignal.ready) {
    await cleanup()
    throw new Error(readySignal.error || "Server failed to start")
  }

  console.log(`Server ready at ${baseUrl}`)

  const result: TestServer = {
    serverProcess,
    baseUrl,
    tempDir,
    cleanup,
  }

  activeServers.add(result)
  return result
}

// Enhanced output monitoring that detects server readiness from logs
function monitorServerOutput(
  stream: Readable | null | undefined,
  expectedPort: number,
  readyResolver: (value: ServerReadySignal) => void,
  readyRejecter: (error: Error) => void,
  isStderr = false,
): { cancel: () => void } | undefined {
  if (!stream) return undefined

  let cancelled = false
  let settled = false
  let buffer = ""
  const decoder = new TextDecoder()

  const cleanup = () => {
    if (settled) return
    settled = true
    stream.removeListener("data", onData)
    stream.removeListener("error", onError)
    stream.removeListener("close", onClose)
    stream.removeListener("end", onClose)
  }

  const settle = (callback: () => void) => {
    if (settled) return
    callback()
    cleanup()
  }

  const onData = (chunk: Buffer) => {
    if (cancelled || settled) return
    buffer += decoder.decode(chunk)

    let newlineIndex = buffer.indexOf("\n")
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line) {
        if (isStderr) {
          console.error("OpenCode stderr:", line)
        } else {
          console.log("OpenCode stdout:", line)
        }

        if (line.includes("opencode server listening on") && line.includes(`:${expectedPort}`)) {
          settle(() => readyResolver({ ready: true, port: expectedPort }))
          return
        }

        if (
          isStderr &&
          (line.includes("Error:") ||
            line.includes("EADDRINUSE") ||
            line.includes("Permission denied") ||
            line.includes("fatal"))
        ) {
          settle(() => readyRejecter(new Error(`Server startup error: ${line}`)))
          return
        }
      }

      newlineIndex = buffer.indexOf("\n")
    }
  }

  const onError = (error: Error) => {
    if (cancelled || settled) return
    settle(() => readyRejecter(new Error(`Output monitoring error: ${error.message}`)))
  }

  const onClose = () => {
    cleanup()
  }

  stream.on("data", onData)
  stream.on("error", onError)
  stream.on("close", onClose)
  stream.on("end", onClose)

  return {
    cancel: () => {
      if (cancelled) return
      cancelled = true
      cleanup()
    },
  }
}

// Helper to wait with timeout using Bun's sleep
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await condition()) return true
    await sleep(interval)
  }
  return false
}

// Helper to create test projects (for compatibility with old tests)
export async function createTestProject(_baseUrl: string, tempDir: string, name: string): Promise<any> {
  const projectPath = `${tempDir}/${name.toLowerCase().replace(/\s+/g, "-")}`

  // Create the project directory using Node.js spawn helper
  await spawnProcess(["mkdir", "-p", projectPath])

  // Since OpenCode server doesn't have a projects API, we'll simulate a project structure
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    path: projectPath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// Enhanced server health check with retry logic
export async function waitForServerHealth(baseUrl: string, timeout = 10000): Promise<boolean> {
  const start = Date.now()
  const interval = 200

  while (Date.now() - start < timeout) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000)

      const response = await fetch(`${baseUrl}/doc`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const doc = await response.json()
        if (doc && doc.openapi) {
          return true
        }
      }
    } catch (e) {
      // Continue trying
    }

    await sleep(interval)
  }

  return false
}

// Helper to check if server is down (for cleanup verification)
export async function waitForServerShutdown(baseUrl: string, timeout = 5000): Promise<boolean> {
  const start = Date.now()
  const interval = 100

  while (Date.now() - start < timeout) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 500)

      await fetch(`${baseUrl}/doc`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      // If we get here, server is still running
      await sleep(interval)
    } catch (e) {
      // Server is down (expected)
      return true
    }
  }

  return false // Server still running after timeout
}

// Safe fetch with proper error handling for tests
export async function safeFetch(
  url: string,
  options?: RequestInit & { expectError?: boolean; timeout?: number },
): Promise<Response | null> {
  const { expectError = false, timeout = 5000, ...fetchOptions } = options || {}

  try {
    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    return response
  } catch (error) {
    if (expectError) {
      // Expected error (like ECONNREFUSED, ECONNRESET, timeout), return null
      return null
    }

    // Check if it's a connection error that should be handled gracefully
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ECONNRESET") ||
      errorMessage.includes("aborted") ||
      errorMessage.includes("timeout")
    ) {
      // These are connection errors that might be expected in tests
      return null
    }

    // Unexpected error, re-throw
    throw error
  }
}

// Concurrent server creation for parallel tests
export async function createMultipleTestServers(count: number): Promise<TestServer[]> {
  const promises = Array.from({ length: count }, () => createTestServer())
  return Promise.all(promises)
}

// Server pool management for test optimization
export class TestServerPool {
  private servers: TestServer[] = []
  private available: TestServer[] = []
  private inUse: Set<TestServer> = new Set()

  async initialize(poolSize = 3): Promise<void> {
    console.log(`Initializing test server pool with ${poolSize} servers...`)
    this.servers = await createMultipleTestServers(poolSize)
    this.available = [...this.servers]
    console.log(`Test server pool ready with ${this.servers.length} servers`)
  }

  async acquire(): Promise<TestServer> {
    if (this.available.length === 0) {
      // Create a new server if pool is exhausted
      const newServer = await createTestServer()
      this.servers.push(newServer)
      this.inUse.add(newServer)
      return newServer
    }

    const server = this.available.pop()!
    this.inUse.add(server)
    return server
  }

  release(server: TestServer): void {
    if (this.inUse.has(server)) {
      this.inUse.delete(server)
      this.available.push(server)
    }
  }

  async cleanup(): Promise<void> {
    console.log(`Cleaning up test server pool with ${this.servers.length} servers...`)
    await Promise.all(this.servers.map((server) => server.cleanup()))
    this.servers = []
    this.available = []
    this.inUse.clear()
  }
}

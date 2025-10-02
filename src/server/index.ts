/**
 * OpenCode App Server
 *
 * Main server entry point that:
 * 1. Serves the React app from ./web-dist
 * 2. Provides project management APIs (add/remove/list projects)
 * 3. Starts and provides the OpenCode backend URL to clients
 *
 * The client connects directly to the OpenCode backend using the SDK.
 * This server does NOT proxy OpenCode API calls.
 */

import { Hono } from "hono"
import type { HttpBindings } from "@hono/node-server"
import type { Context } from "hono"
import { cors } from "hono/cors"
import { serveStatic } from "@hono/node-server/serve-static"
import { serve } from "@hono/node-server"
import { addIntegratedProjectRoutes } from "./integrated-project-routes"
import { registerCliRoutes } from "./cli-routes"
import { projectManager } from "./project-manager"
import { Log } from "../util/log"
import { cliSessionManager } from "./cli-session-manager"
import { WebSocketServer, WebSocket } from "ws"
import { verifySessionToken } from "./ws-auth"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
const log = Log.create({ service: "app-server" })

// Global OpenCode backend server instance

export interface ServerConfig {
  port?: number
  hostname?: string
  staticDir?: string
}

export function createServer(config: ServerConfig = {}) {
  // Always serve from web-dist, regardless of NODE_ENV
  const { staticDir = "./web-dist" } = config
  const development = process.env["NODE_ENV"] === "development"
  // Resolve static directory relative to the built server file location
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const resolvedStaticDir = path.isAbsolute(staticDir)
    ? staticDir
    : path.resolve(__dirname, staticDir)

  // Check if static directory exists
  const staticDirExists = fs.existsSync(resolvedStaticDir)

  const app = new Hono<{ Bindings: HttpBindings }>()

  // Error handling middleware - must be first
  app.onError((err: Error & { message?: string }, c: Context) => {
    log.error("Request error:", err)

    // Handle JSON parse errors
    if (err.message?.includes("JSON") || err.message?.includes("Unexpected")) {
      return c.json({ error: "Invalid JSON in request body" }, 400)
    }

    // Handle validation errors
    if (err.message?.includes("required") || err.message?.includes("invalid")) {
      return c.json({ error: err.message }, 400)
    }

    // Default error response
    return c.json(
      {
        error: development ? err.message : "Internal server error",
      },
      500
    )
  })

  // Middleware - CORS
  // Permissive but browser-compatible with credentials:
  // - If request has an Origin header, reflect it and allow credentials.
  // - If there's no Origin, skip adding CORS headers (no need for CORS).
  app.use("*", async (c, next) => {
    const reqOrigin = c.req.header("Origin") || c.req.header("origin")
    if (reqOrigin) {
      const handler = cors({
        origin: reqOrigin,
        credentials: true,
      })
      return handler(c, next)
    }

    // No Origin header:
    // - Still respond to OPTIONS preflight to be permissive for non-browser clients/tests
    // - Do not interfere with normal requests
    if (c.req.method === "OPTIONS") {
      const reqHeaders = c.req.header("access-control-request-headers") || "*"
      const reqMethod = c.req.header("access-control-request-method") || "*"
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-credentials": "true",
          "access-control-allow-methods": reqMethod || "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
          "access-control-allow-headers": reqHeaders,
          vary: "Origin, Access-Control-Request-Headers, Access-Control-Request-Method",
        },
      })
    }

    return next()
  })

  // Create a sub-app for API routes to ensure they're handled first
  const apiApp = new Hono()

  // Optional request logger (enable by setting AGENT_ORANGE_REQUEST_LOG=1)
  apiApp.use("*", async (c, next) => {
    if (process.env["AGENT_ORANGE_REQUEST_LOG"] === "1") {
      try {
        console.log(JSON.stringify({ service: "api", method: c.req.method, path: c.req.path }))
      } catch {}
    }
    await next()
  })

  // Health check endpoint
  apiApp.get("/api/health", async (c) => {
    const sessions = cliSessionManager.listSessions()
    const runningSessions = sessions.filter(s => s.status === "running").length

    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      projects: projectManager.getAllProjects().length,
      cli: {
        totalSessions: sessions.length,
        runningSessions,
      },
    })
  })

  // Readiness check endpoint
  apiApp.get("/api/health/ready", async (c) => {
    const tools = await cliSessionManager.listTools()
    const availableTools = tools.filter(t => t.available).length

    return c.json({
      status: "ready",
      timestamp: new Date().toISOString(),
      cli: {
        availableTools,
        totalTools: tools.length,
      },
    })
  })

  // Liveness check endpoint
  apiApp.get("/api/health/live", async (c) => {
    return c.json({
      status: "alive",
      timestamp: new Date().toISOString(),
    })
  })

  // Add integrated project management routes to API sub-app
  // These routes manage projects and provide backend URL to clients
  addIntegratedProjectRoutes(apiApp)
  registerCliRoutes(apiApp)

  // Mount the API app at root (routes already have /api prefix)
  // This must come before static file serving to ensure API routes are handled first
  app.route("/", apiApp)

  // Serve static assets with Node.js static file serving
  // Only if the directory exists (to avoid warnings in tests)
  if (staticDirExists) {
    // Ensure serve-static root points to the built web assets from the current cwd
    const staticRoot = path.relative(process.cwd(), resolvedStaticDir) || "."
    app.use(
      "/*",
      serveStatic({
        root: staticRoot,
        rewriteRequestPath: (path) => {
          if (path === "/") return "/index.html"
          return path
        },
      })
    )
  }

  // Fallback to index.html for client-side routing using Node.js fs
  if (staticDirExists) {
    app.get("*", async (c) => {
      const indexPath = path.join(resolvedStaticDir, "index.html")

      try {
        const content = await fs.promises.readFile(indexPath, "utf-8")

        return new Response(content, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            // Signal test mode to the client for E2E-only behavior (non-HttpOnly so client can read)
            ...(process.env["AGENT_ORANGE_TEST_MODE"] === "1"
              ? { "Set-Cookie": "AGENT_ORANGE_TEST_MODE=1; Path=/; SameSite=Lax" }
              : {}),
          },
        })
      } catch (error) {
        console.error("Failed to serve index.html:", error)
        return c.notFound()
      }
    })
  }

  return app
}

export async function startServer(config: ServerConfig = {}) {
  const { port = 3099, hostname = "127.0.0.1" } = config
  const development = process.env["NODE_ENV"] === "development"

  const app = createServer(config)

  // Create Node.js HTTP server
  const server = serve({
    fetch: app.fetch,
    port,
    hostname,
  })

  const wss = new WebSocketServer({ noServer: true })

  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host}`)
      if (url.pathname !== "/ws/cli") {
        socket.destroy()
        return
      }

      // Verify token
      const token = url.searchParams.get("token")
      if (!token) {
        log.warn("WebSocket upgrade rejected: missing token")
        socket.destroy()
        return
      }

      const tokenData = verifySessionToken(token)
      if (!tokenData) {
        log.warn("WebSocket upgrade rejected: invalid token")
        socket.destroy()
        return
      }

      const sessionId = tokenData.sessionId

      // Verify session exists
      const session = cliSessionManager.getSession(sessionId)
      if (!session) {
        log.warn("WebSocket upgrade rejected: session not found", { sessionId })
        socket.destroy()
        return
      }

      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        log.info("WebSocket connected", { sessionId })
        cliSessionManager.attachWebSocket(sessionId, ws)
      })
    } catch (error) {
      log.error("WebSocket upgrade failed", error)
      socket.destroy()
    }
  })

  wss.on("close", () => {
    // ensure all CLI sessions are torn down when websocket server closes
    for (const session of cliSessionManager.listSessions()) {
      void cliSessionManager.close(session.id)
    }
  })

  log.info("Server started", {
    port,
    hostname,
    development,
    url: `http://${hostname}:${port}`,
  })

  // Graceful shutdown
  process.on("SIGINT", async () => {
    log.info("Shutting down server...")
    cliSessionManager.shutdown()
    await projectManager.shutdown()
    try {
      for (const client of wss.clients) {
        client.terminate()
      }
      wss.close()
    } catch (error) {
      log.warn("Failed to close WebSocket server", error)
    }
    server.close()
    process.exit(0)
  })

  process.on("SIGTERM", async () => {
    log.info("Shutting down server...")
    cliSessionManager.shutdown()
    await projectManager.shutdown()
    try {
      for (const client of wss.clients) {
        client.terminate()
      }
      wss.close()
    } catch (error) {
      log.warn("Failed to close WebSocket server", error)
    }
    server.close()
    process.exit(0)
  })

  return server
}

// Start server if this file is run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = parseInt(process.env["PORT"] || "3099")
  const hostname = process.env["HOST"] || "127.0.0.1"

  await startServer({ port, hostname })
}

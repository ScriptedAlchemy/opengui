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
import { cors } from "hono/cors"
import { serveStatic } from "@hono/node-server/serve-static"
import { serve } from "@hono/node-server"
import { addIntegratedProjectRoutes } from "./integrated-project-routes"
import { projectManager } from "./project-manager"
import { Log } from "../util/log"
import { createOpencodeServer } from "@opencode-ai/sdk/server"
import path from "node:path"
import { fileURLToPath } from "node:url"

const log = Log.create({ service: "app-server" })

// Global OpenCode backend server instance
let opencodeBackend: { url: string; close: () => void } | null = null

export interface ServerConfig {
  port?: number
  hostname?: string
  staticDir?: string
  opencodePort?: number
  opencodeHostname?: string
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

  const app = new Hono()

  // Error handling middleware - must be first
  app.onError((err, c) => {
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

  // Middleware - production CORS settings
  app.use(
    "*",
    cors({
      origin: ["*"],
      credentials: true,
    })
  )

  // Create a sub-app for API routes to ensure they're handled first
  const apiApp = new Hono()

  // Health check endpoint
  apiApp.get("/api/health", async (c) => {
    try {
      await projectManager.monitorHealth()
    } catch (e) {
      // In tests or when backend isn't started, health should still return 200
    }
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      projects: projectManager.getAllProjects().length,
    })
  })

  // Add integrated project management routes to API sub-app
  // These routes manage projects and provide backend URL to clients
  addIntegratedProjectRoutes(apiApp)

  // Mount the API app at root (routes already have /api prefix)
  // This must come before static file serving to ensure API routes are handled first
  app.route("/", apiApp)

  // Proxy OpenCode API requests to the backend under a single prefix
  // Clients should use baseUrl "/opencode" to avoid CORS
  const proxyOpencode = async (c: any) => {
    const backendUrl = process.env["OPENCODE_API_URL"]
    if (!backendUrl) {
      return c.json({ error: "OpenCode backend not available" }, 503)
    }

    const url = new URL(c.req.url)
    // Strip the "/opencode" prefix when forwarding
    const forwardedPath = url.pathname.replace(/^\/opencode/, "") || "/"
    const targetUrl = `${backendUrl}${forwardedPath}${url.search}`

    // Forward the request to the OpenCode backend
    const headers = new Headers(c.req.raw.headers)
    headers.delete("host")

    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers,
      body: c.req.raw.body,
      // enable streaming/SSE compatibility
      duplex: "half",
    } as RequestInit)

    // Return the backend response as-is
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }

  // Catch-all proxy for anything under /opencode
  app.all("/opencode", proxyOpencode)
  app.all("/opencode/*", proxyOpencode)

  // Serve static assets with Node.js static file serving
  app.use(
    "/*",
    serveStatic({
      root: resolvedStaticDir,
      rewriteRequestPath: (path) => {
        // Handle root path to serve index.html
        if (path === "/") return "/index.html"
        return path
      },
    })
  )

  // Fallback to index.html for client-side routing using Node.js fs
  app.get("*", async (c) => {
    const indexPath = path.join(resolvedStaticDir, "index.html")
    
    try {
      const fs = require("fs/promises")
      const content = await fs.readFile(indexPath, "utf-8")
      
      return new Response(content, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      })
    } catch (error) {
      // For tests without index.html, return a simple 404
      return c.notFound()
    }
  })

  return app
}

export async function startServer(config: ServerConfig = {}) {
  const {
    port = 3001,
    hostname = "127.0.0.1",
    opencodePort, // Don't set a default - let OpenCode choose
    opencodeHostname = "127.0.0.1",
  } = config
  const development = process.env["NODE_ENV"] === "development"

  // Start OpenCode backend server first
  try {
    log.info("Starting OpenCode backend server (auto-selecting port)...")
    const serverOptions = {
      hostname: opencodeHostname,
      timeout: 10000,
      port: opencodePort || 0, // Use 0 to auto-select available port
    }
    opencodeBackend = await createOpencodeServer(serverOptions)
    log.info(`OpenCode backend started at ${opencodeBackend!.url}`)

    // Store the backend URL for clients to retrieve via API
    process.env["OPENCODE_API_URL"] = opencodeBackend!.url
  } catch (error) {
    log.error("Failed to start OpenCode backend:", error)
    // If we can't start the backend, we can't continue
    throw new Error("Unable to start OpenCode backend server")
  }

  const app = createServer(config)

  // Create Node.js HTTP server
  const server = serve({
    fetch: app.fetch,
    port,
    hostname,
  })

  log.info("Server started", {
    port,
    hostname,
    development,
    url: `http://${hostname}:${port}`,
    opencodeBackend: process.env["OPENCODE_API_URL"],
  })

  // Graceful shutdown
  process.on("SIGINT", async () => {
    log.info("Shutting down server...")
    await projectManager.shutdown()
    if (opencodeBackend) {
      log.info("Stopping OpenCode backend...")
      opencodeBackend.close()
    }
    server.close()
    process.exit(0)
  })

  process.on("SIGTERM", async () => {
    log.info("Shutting down server...")
    await projectManager.shutdown()
    if (opencodeBackend) {
      log.info("Stopping OpenCode backend...")
      opencodeBackend.close()
    }
    server.close()
    process.exit(0)
  })

  return server
}

// Start server if this file is run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = parseInt(process.env["PORT"] || "3001")
  const hostname = process.env["HOST"] || "127.0.0.1"

  await startServer({ port, hostname })
}

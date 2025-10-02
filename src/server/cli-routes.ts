import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { cliSessionManager } from "./cli-session-manager"
import { projectManager } from "./project-manager"
import { generateSessionToken } from "./ws-auth"

const CreateSessionSchema = z.object({
  projectId: z.string().min(1),
  worktreeId: z.string().min(1),
  tool: z.enum(["codex", "claude", "opencode"]),
  title: z.string().optional(),
  commandArgs: z.array(z.string()).optional(),
})

export function registerCliRoutes(app: Hono) {
  const router = new Hono()

  router.get("/cli/tools", async (c) => {
    const tools = await cliSessionManager.listTools()
    return c.json({ tools })
  })

  router.get("/cli/sessions", (c) => {
    const sessions = cliSessionManager.listSessions()
    // Generate fresh tokens for each session
    const sessionsWithTokens = sessions.map((session) => ({
      ...session,
      wsToken: generateSessionToken(session.id),
    }))
    return c.json({ sessions: sessionsWithTokens })
  })

  router.post("/cli/sessions", zValidator("json", CreateSessionSchema), async (c) => {
      const body = c.req.valid("json")
      const project = projectManager.getProject(body.projectId)
      if (!project) {
        return c.json({ error: "Project not found" }, 404)
      }

      const worktree = projectManager.findWorktreeById(body.projectId, body.worktreeId)
      if (!worktree) {
        return c.json({ error: "Worktree not found" }, 404)
      }

      try {
        const session = await cliSessionManager.createSession({
          projectId: body.projectId,
          worktreeId: body.worktreeId,
          cwd: worktree.path,
          tool: body.tool,
          title: body.title,
          commandArgs: body.commandArgs,
        })
        const wsToken = generateSessionToken(session.id)
        return c.json({ session, wsToken }, 201)
      } catch (error) {
        console.error("Failed to create CLI session", error)
        return c.json({ error: error instanceof Error ? error.message : "Unable to create session" }, 400)
      }
    }
  )

  router.delete(
    "/cli/sessions/:id",
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param")
      await cliSessionManager.close(id)
      return c.json({ success: true })
    }
  )

  app.route("/api", router)
}

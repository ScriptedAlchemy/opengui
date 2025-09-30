# Operator Hub Server

The backend for Operator Hub. It serves the React UI, manages project/worktree
metadata, exposes REST endpoints, and hosts a WebSocket bridge for interactive
CLI sessions.

## Architecture

```
Browser
  ├── GET / (React bundle)
  ├── REST /api/projects/* (projects + worktrees + git status)
  ├── REST /api/cli/* (CLI session lifecycle)
  └── WebSocket /ws/cli (pty stream for each session)
Server
  ├── project-manager.ts    // persists project/worktree metadata
  ├── integrated-project-routes.ts
  ├── cli-session-manager.ts
  └── cli-routes.ts
```

No OpenCode SDK proxy is used anymore; the server simply orchestrates projects
and multiplexes terminal connections.

## API Surface

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:id/worktrees`
- `POST /api/projects/:id/worktrees`
- `PATCH /api/projects/:id/worktrees/:worktreeId`
- `DELETE /api/projects/:id/worktrees/:worktreeId`
- `GET /api/projects/:id/git/status`
- `GET /api/cli/tools`
- `GET /api/cli/sessions`
- `POST /api/cli/sessions`
- `DELETE /api/cli/sessions/:id`
- GitHub helper routes (`/api/projects/:id/github/*`)

### WebSocket

`/ws/cli?sessionId=<id>` upgrades to a PTY-backed terminal stream created via
`node-pty`. Messages are small JSON blobs:

- Client → Server: `{ type: "input", data }`, `{ type: "resize", cols, rows }`
- Server → Client: `{ type: "data", data }`, `{ type: "status", status }`, `{ type: "exit", code }`

## Running

```bash
pnpm run build
pnpm start
```

The server reads/writes metadata under `~/.agent-orange` (configurable via
`AGENT_ORANGE_CONFIG_DIR`) and is otherwise stateless.

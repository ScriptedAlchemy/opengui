# Operator Hub

A high-density web interface for managing multiple projects, their Git worktrees, and CLI-based coding agents (Codex CLI, Claude Code, OpenCode) from a single browser-based UI.

## Quick Start

```bash
# Install dependencies
pnpm install

# Development mode (hot reload, unminified)
pnpm run dev              # Default port 3099
pnpm run dev:full         # Run client + server concurrently

# Production build
pnpm run build            # Minified build in ./web-dist and server-dist

# Serve build
pnpm start                # Production server (./server-dist)

# Run tests
pnpm test                 # All tests
pnpm run test:integration # Integration tests only
pnpm run test:components  # Component tests only
```

## Common Commands

| Command              | Description                        | Default Port |
| -------------------- | ---------------------------------- | ------------ |
| `pnpm run dev`       | Development server with HMR        | 3099         |
| `pnpm run dev:server`| API server only                    | 3099         |
| `pnpm run dev:full`  | Client + server sequential build   | 3099         |
| `pnpm run build`     | Production build (client + server) | -            |
| `pnpm start`         | Serve production build             | 3099         |

## Features

- 📂 **Project & Worktree Control** – Manage multiple repositories and their git worktrees from a single high-density console.
- 🖥️ **CLI Agent Sessions** – Launch Codex CLI, Claude Code shell, or OpenCode chat CLI sessions bound to a specific worktree and stream them in tabbed terminals.
- 🔄 **Fast Switching** – Snap between projects, worktrees, and active terminals without leaving the operations hub.
- 🔌 **WebSocket I/O** – Real-time terminal streaming backed by a single WebSocket per session for low-latency command and output handling.
- 🐙 **GitHub Insight** – Preserve the GitHub integration view for issues, pull requests, and status checks with worktree-aware automation hooks.
- 🧱 **Shadcn UI Base** – Keep shadcn/ui components and Tailwind styling for consistent theming and responsive layouts.

## Worktrees

Each project exposes its primary checkout as the `default` worktree. Creating additional worktrees lets you:

- Launch isolated CLI coding agents tied to feature branches.
- Run git/file automation against a dedicated working directory.
- Stage follow-up work without disturbing the primary checkout.

Switch worktrees from the operations hub. CLI sessions inherit the selected worktree automatically so tooling starts in the correct directory.

## Architecture

The app consists of a Hono server that serves both the React app and provides REST/WebSocket endpoints for CLI sessions:

```
Browser → Hono Server (Port 3099)
            ├── / → React Operations Hub
            ├── /api/* → Project & worktree APIs + CLI session lifecycle
            └── /ws/cli → WebSocket stream for interactive terminals
```

### Development Mode

- Current dev flow builds the client and server, then starts the Node server.
- For live edits, re-run `pnpm run dev` or switch to iterative build tooling as needed.

### Production Mode

- Pre-built and minified assets served from `./web-dist`
- Static file serving handled by the Hono server
- Efficient caching headers for assets

### Debug Mode

- Unminified build with inline source maps (use dev mode for debugging)
- Easier debugging of development issues with HMR

## Project Structure

```
src/
├── features/              # High-level UI modules
│   ├── cli/               # Terminal dock components
│   ├── projects/          # Project rail
│   └── worktrees/         # Worktree board
├── pages/
│   ├── OperationsHub.tsx  # Primary dashboard
│   └── GitHubIntegration.tsx
├── stores/                # Zustand stores
│   ├── cliSessions.ts
│   ├── projects.ts
│   └── worktrees.ts
├── server/
│   ├── cli-session-manager.ts
│   ├── cli-routes.ts
│   ├── integrated-project-routes.ts
│   └── project-manager.ts
└── components/
    ├── ui/                # shadcn/ui primitives
    ├── nav-*.tsx          # Navigation helpers
    └── app-sidebar.tsx
```

## Routes

- `/` — Operations hub for projects, worktrees, and CLI sessions.
- `/github` — Global GitHub integration dashboard (project optional).
- `/projects/:projectId/:worktreeId/github` — Worktree-scoped GitHub view with automation actions.

## API Endpoints

- `GET /api/health` — Server health probe.
- `GET /api/projects` — List all registered projects.
- `POST /api/projects` — Register a new project (path + optional name).
- `GET /api/projects/:id` — Retrieve project metadata (including worktrees).
- `PATCH /api/projects/:id` — Update project properties.
- `DELETE /api/projects/:id` — Remove a project from the hub (does not delete files).
- `GET /api/projects/:id/worktrees` — List git worktrees for a project.
- `POST /api/projects/:id/worktrees` — Create a new worktree (supports branch/base args).
- `PATCH /api/projects/:id/worktrees/:worktreeId` — Update worktree metadata such as title.
- `DELETE /api/projects/:id/worktrees/:worktreeId` — Remove a non-default worktree.
- `GET /api/cli/tools` — Enumerate available CLI tool presets.
- `GET /api/cli/sessions` — List active CLI terminal sessions.
- `POST /api/cli/sessions` — Launch a new CLI session bound to a project/worktree.
- `DELETE /api/cli/sessions/:id` — Terminate an existing CLI session.

## Technology Stack

- **Runtime**: Node.js (pnpm managed)
- **Frontend**: React 18 + TypeScript
- **Server**: Hono + WebSocket bridge (ws) + node-pty for PTY management
- **Build Tool**: Rsbuild (client) + Rslib (server)
- **UI Components**: shadcn/ui primitives + Tailwind CSS v4
- **State Management**: Zustand + React Query
- **Routing**: React Router v6
- **Terminal Streaming**: Native WebSockets bound to PTY streams

## Testing

The legacy chat-focused test suite has been removed. A new test harness for the CLI-first
workflow is planned—today you can smoke-test by running the dev server and launching CLI
sessions:

```bash
pnpm run dev
# open http://localhost:3099 and launch sessions from the Operations Hub
```

## Environment Variables

Primary variables (see docs/environment-variables.md for full list):

- `PORT` - Server port (default: 3099)
- `HOST` - Server hostname (default: 127.0.0.1)
- `NODE_ENV` - Environment (development/production)
- `AGENT_ORANGE_CONFIG_DIR` - Config directory (default: `$HOME/.agent-orange`)
- `AGENT_ORANGE_TEST_MODE` - Enables test behaviors (default: 0)

## Troubleshooting

### Port Already in Use

If you get a "port in use" error:

```bash
# Find process using port
lsof -i :3099

# Kill process
kill <PID>

# Or use a different port
PORT=3002 pnpm run dev
```

### Build Issues

If the build fails:

```bash
# Clean and rebuild
rm -rf web-dist server-dist node_modules
pnpm install
pnpm run build
```

### CSS Not Loading

Ensure Tailwind CSS is processing:

Tailwind CSS v4 runs via PostCSS during build and dev; no manual step required.

## Documentation

- Environment variables: `docs/environment-variables.md`
- Requirements: `docs/requirements.md`
- TODO/Status: `docs/todo.md`
- Server entry: `src/server/index.ts`
- Project routes: `src/server/integrated-project-routes.ts`
- GitHub integration client: `src/server/github/gh-cli.ts`

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Test thoroughly (`pnpm test`)
5. Submit a pull request

## License

Same as OpenCode - see main repository for details.

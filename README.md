# OpenCode Web UI

A modern web interface for OpenCode that enables managing multiple projects/repositories from a single browser-based UI.

## Quick Start

```bash
# Install dependencies
pnpm install

# Development mode (hot reload, unminified)
pnpm run dev              # Default port 3099
pnpm run dev:full         # Run client + server concurrently

# Production build
pnpm run build            # Minified build in ./web-dist and server-dist

# Serve builds
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
| `pnpm run dev:server`| API server only                    | 3002         |
| `pnpm run dev:full`  | Client + server concurrently       | 3099/3002    |
| `pnpm run build`     | Production build (client + server) | -            |
| `pnpm start`         | Serve production build             | 3099         |

## Features

- 🚀 **Multi-Project Management** - Add and manage multiple projects/repositories
- 💬 **AI Chat Interface** - Powered by assistant-ui with streaming responses
- 🔧 **Git Integration** - Visual git operations, commits, branches, and per-worktree views
- 🤖 **Agent Management** - Create, edit, and test AI agents
- 📁 **File Browser** - Navigate and manage project files
- ⚡ **Real-time Updates** - Server-Sent Events for live streaming
- 🎨 **Modern UI** - Built with shadcn/ui and Tailwind CSS
- 💾 **Persistent Projects** - Your project list is saved and restored
- 🌳 **Worktree Aware** - Switch between Git worktrees and run isolated agent/chat sessions per worktree

## Worktrees

Each project exposes its primary checkout as the `default` worktree. Creating additional worktrees lets you:

- Launch isolated chat sessions tied to feature branches.
- Run terminal/git/file operations against a separate working directory.
- Manage worktree-specific agents and settings.

You can switch worktrees from the project sidebar or the dashboard. URLs now take the form `/projects/:projectId/:worktreeId/...`, so deep links remain stable per worktree.

## Architecture

The app consists of a Hono server that serves both the React app and provides API endpoints:

```
Browser → Hono Server (Port 3099)
            ├── / → React App (dev: transpiled on-the-fly, prod: pre-built)
            ├── /api/* → Project Management APIs
            └── SDK Integration → Direct SDK access (no proxy)
```

### Development Mode

- Current dev flow runs a local build then starts the Node server.
- For live edits, re-run `pnpm run dev` or wire up `rsbuild dev` if desired.

### Production Mode

- Pre-built and minified assets served from `./web-dist`
- Static file serving handled by the Hono server
- Efficient caching headers for assets

### Debug Mode

- Unminified build with inline source maps (use dev mode for debugging)
- Easier debugging of development issues with HMR

## Project Structure

```
app/
├── src/
│   ├── server/        # Hono API server
│   │   ├── index.ts   # Main server entry
│   │   ├── project-manager.ts        # Project & worktree metadata
│   │   └── integrated-project-routes.ts   # API route handlers (projects, worktrees, agents)
│   ├── lib/           # Core libraries
│   │   ├── api/       # API clients and types
│   │   └── chat/      # assistant-ui runtime
│   ├── components/    # React components
│   │   ├── assistant-ui/  # Chat interface components
│   │   ├── ui/        # shadcn/ui components
│   │   └── layout/    # Layout components
│   ├── pages/         # Route pages
│   ├── stores/        # Zustand state management (projects, worktrees, sessions, etc.)
│   └── App.tsx        # Main app with worktree-aware routing
├── scripts/           # Build and dev scripts
│   ├── dev.ts         # Development server
│   ├── build.ts       # Production build
│   ├── build-debug.ts # Debug build
│   └── serve-debug.ts # Debug server
├── test/              # Test files
│   ├── integration/   # API integration tests
│   ├── components/    # React component tests
│   └── e2e/          # Playwright E2E tests
└── package.json       # Dependencies
```

## Routes

- `/` - Project list/dashboard
- `/projects/:projectId/:worktreeId` - Project overview (default worktree id: `default`)
- `/projects/:projectId/:worktreeId/sessions` - Session management
- `/projects/:projectId/:worktreeId/sessions/:sessionId/chat` - AI chat interface
- `/projects/:projectId/:worktreeId/git` - Git operations
- `/projects/:projectId/:worktreeId/agents` - Agent management
- `/projects/:projectId/:worktreeId/files` - File browser
- `/projects/:projectId/:worktreeId/settings` - Project & worktree settings

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details (includes worktree metadata)
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Remove project
- `POST /api/projects/:id/start` - Start project instance
- `POST /api/projects/:id/stop` - Stop project instance
- `GET /api/projects/:id/status` - Get instance status
- `GET /api/projects/:id/worktrees` - List git worktrees for a project
- `POST /api/projects/:id/worktrees` - Create a new worktree (title + directory)
- `PATCH /api/projects/:id/worktrees/:worktreeId` - Update worktree metadata
- `DELETE /api/projects/:id/worktrees/:worktreeId` - Remove a non-default worktree

## Technology Stack

- **Runtime**: Node.js (managed with pnpm)
- **Frontend**: React 18 + TypeScript
- **Server**: Hono (lightweight web framework)
- **Build Tool**: Rsbuild (client) + Rslib (server)
- **UI Components**: shadcn/ui + assistant-ui
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand + React Query
- **Routing**: React Router v6
- **Real-time**: Server-Sent Events (SSE)
- **Testing**: Rstest + Playwright

## Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm run test:components      # React component tests
pnpm run test:integration     # API integration tests
pnpm run test:runtime         # Runtime tests
pnpm run test:stores          # Store tests

# E2E tests (requires Playwright)
pnpm run test:e2e             # Run all E2E tests

# CI E2E run (real models)
pnpm run test:e2e:ci          # Runs Playwright against real providers/models

Notes:
- E2E tests select Anthropic as provider and Claude Sonnet 4 as model.
- Ensure ANTHROPIC_API_KEY is set in your environment before running E2E.
```

## Environment Variables

- `PORT` - Server port (default: 3099)
- `HOST` - Server hostname (default: 127.0.0.1)
- `NODE_ENV` - Environment (development/production)

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

- API Types: `src/lib/api/types.ts`
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

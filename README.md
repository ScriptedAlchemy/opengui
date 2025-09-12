# OpenCode Web UI

A modern web interface for OpenCode that enables managing multiple projects/repositories from a single browser-based UI.

## Quick Start

```bash
# Install dependencies
pnpm install

# Development mode (hot reload, unminified)
pnpm run dev              # Default port 3001
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
| `pnpm run dev`       | Development server with HMR        | 3001         |
| `pnpm run dev:server`| API server only                    | 3002         |
| `pnpm run dev:full`  | Client + server concurrently       | 3001/3002    |
| `pnpm run build`     | Production build (client + server) | -            |
| `pnpm start`         | Serve production build             | 3001         |

## Features

- 🚀 **Multi-Project Management** - Add and manage multiple projects/repositories
- 💬 **AI Chat Interface** - Powered by assistant-ui with streaming responses
- 🔧 **Git Integration** - Visual git operations, commits, branches, and worktrees
- 🤖 **Agent Management** - Create, edit, and test AI agents
- 📁 **File Browser** - Navigate and manage project files
- ⚡ **Real-time Updates** - Server-Sent Events for live streaming
- 🎨 **Modern UI** - Built with shadcn/ui and Tailwind CSS
- 💾 **Persistent Projects** - Your project list is saved and restored

## Architecture

The app consists of a Hono server that serves both the React app and provides API endpoints:

```
Browser → Hono Server (Port 3001)
            ├── / → React App (dev: transpiled on-the-fly, prod: pre-built)
            ├── /api/* → Project Management APIs
            └── SDK Integration → Direct SDK access (no proxy)
```

### Development Mode

- TypeScript/TSX files served via Rsbuild dev server with HMR
- CSS is processed with Tailwind CSS v4
- Hot reload enabled for rapid development

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
│   │   ├── project-manager.ts  # Project instance management
│   │   └── project-routes.ts   # API route handlers
│   ├── lib/           # Core libraries
│   │   ├── api/       # API clients and types
│   │   └── chat/      # assistant-ui runtime
│   ├── components/    # React components
│   │   ├── assistant-ui/  # Chat interface components
│   │   ├── ui/        # shadcn/ui components
│   │   └── layout/    # Layout components
│   ├── pages/         # Route pages
│   ├── stores/        # Zustand state management
│   └── App.tsx        # Main app with routing
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
- `/projects/:projectId` - Project overview
- `/projects/:projectId/sessions` - Session management
- `/projects/:projectId/sessions/:sessionId/chat` - AI chat interface
- `/projects/:projectId/git` - Git operations
- `/projects/:projectId/agents` - Agent management
- `/projects/:projectId/files` - File browser
- `/projects/:projectId/settings` - Project settings

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Remove project
- `POST /api/projects/:id/start` - Start project instance
- `POST /api/projects/:id/stop` - Stop project instance
- `GET /api/projects/:id/status` - Get instance status

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
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `HOST` - Server hostname (default: 127.0.0.1)
- `NODE_ENV` - Environment (development/production)

## Troubleshooting

### Port Already in Use

If you get a "port in use" error:

```bash
# Find process using port
lsof -i :3001

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

- [Architecture](./docs/ARCHITECTURE.md) - System design and technical details
- [Implementation Guide](./docs/IMPLEMENTATION.md) - Step-by-step setup instructions
- [API Types](./src/lib/api/types.ts) - TypeScript type definitions
- [Server Documentation](./src/server/README.md) - Server implementation details

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Test thoroughly (`pnpm test`)
5. Submit a pull request

## License

Same as OpenCode - see main repository for details.

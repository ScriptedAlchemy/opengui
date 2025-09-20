# OpenCode App Server

The server component that manages OpenCode projects and provides the web interface.

## Architecture Overview

The server manages project metadata and serves the React app. Clients connect to the OpenCode backend through a lightweight proxy mounted at `/opencode` to avoid CORS and support streaming/SSE.

### Core Components

- **index.ts** - Main server entry point, serves React app and handles routing
- **project-manager.ts** - Manages project lifecycle and persistence
- **integrated-project-routes.ts** - Handles project CRUD operations and management

### Supporting Files

- **project-schemas.ts** - Zod schemas for project validation
- **shared-schemas.ts** - Common schemas used across modules
- **util/log.ts** - Logging utilities
- **util/error.ts** - Error handling utilities

## Architecture Benefits

1. **Single Origin** - Clients use `/opencode` as base URL to reach the OpenCode backend
2. **Simplified Server** - Server manages projects and serves static files
3. **Streaming-Ready** - Proxy tuned for SSE/streamed responses with undici Agent
4. **Clear Separation** - Server handles metadata, client handles SDK operations

## API Endpoints

### Project Management

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project
- `PUT /api/projects/:id` - Update project (alias)
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/start` - Start OpenCode instance
- `POST /api/projects/:id/stop` - Stop OpenCode instance
- `GET /api/projects/:id/status` - Get instance status
- `GET /api/projects/:id/resources` - Get resource usage
- `GET /api/projects/:id/activity` - Get activity feed

- `GET /api/projects/:id/git/status` - Get git status

### Backend URL Endpoint

The server provides the OpenCode backend base path to clients:

- `GET /api/backend-url` - Returns `{ url: "/opencode" }`
- Clients use this relative URL as their SDK base to go through the proxy

## How It Works

1. **Server Startup**: Server starts OpenCode backend and stores its URL
2. **Project Management**: Server manages project metadata (add/remove/list)
3. **Client Connection**: Client retrieves backend URL from server:
   ```typescript
   const { url } = await fetch("/api/backend-url").then((r) => r.json())
   ```
4. **SDK Access via Proxy**: Client uses SDK to connect through the proxy:
   ```typescript
   const client = new OpenCodeSDK({
     apiKey: "your-key",
     baseURL: url, // "/opencode" – hits the server proxy
   })
   ```
5. **Proxying**: All SDK calls go through the server’s `/opencode` proxy

## Key Features

- **Direct Client-Backend Connection** - No proxy overhead
- **Project Management** - Full CRUD operations for projects
- **Persistence** - Projects saved to `~/.opencode/web-projects.json`
- **Static File Serving** - Efficient serving of React app

## Running the Server

The server only serves production builds. There is no development server mode.

### Build the App

First, build the frontend app to create the production bundle:

```bash
pnpm run build
```

This creates the `web-dist/` directory with the bundled application.

### Start the Server

```bash
pnpm start
```

The server will:

- Start on port 3001 (configurable via PORT env)
- Start OpenCode backend on an auto-selected port
- Serve pre-built static files from `web-dist/`
- Provide backend URL to clients via API
- Manage project metadata (not OpenCode instances)

**Note**: The server only serves production builds from `web-dist/`. There is no on-the-fly transpilation or ESM proxy support. All TypeScript/JSX must be pre-compiled during the build step.

## Environment Variables

- `PORT` - Server port (default: 3001)
- `HOST` - Server hostname (default: 127.0.0.1)
- `NODE_ENV` - Environment (used for error messages only, does not enable dev server)

## Architecture Decisions

### Why Direct Client Connections?

The simplified architecture has clients connect directly to the OpenCode backend. This eliminates:

- Proxy overhead and latency
- Complex request/response forwarding
- SSE streaming complications
- Server-side SDK management
- Maintenance burden

The SDK approach solves these by:

- Direct function calls to OpenCode
- Native TypeScript support
- Simplified error handling
- Better performance and reliability

### Future Improvements

1. **Performance Optimization** - Further optimize SDK usage
2. **Memory Management** - Implement resource usage monitoring
3. **Metrics Collection** - Add performance and usage analytics

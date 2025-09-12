# OpenCode Web UI Agent Guidelines

## Build/Test Commands

- **Install**: `pnpm install`
- **Dev Full**: `pnpm run dev:full` (client + server)
- **Dev Client**: `pnpm run dev` (React app only)
- **Dev Server**: `pnpm run dev:server` (API server only)
- **Build**: `pnpm run build` (client + server production build)
- **Start**: `pnpm start` (production server)
- **Typecheck**: `pnpm run typecheck`
- **Test**: `pnpm test`
- **Test E2E**: `pnpm run test:e2e`

## Code Style

- **Runtime**: Node.js with TypeScript, React 18, ESM modules
- **Server**: Hono with TypeScript, serves React app + APIs
- **Imports**: Use `@/*` for src imports, named imports preferred
- **Components**: Functional components, shadcn/ui and assistant-ui
- **State**: Zustand with immer for stores, React Query for server state
- **Styling**: Tailwind CSS only, use `cn()` for conditional classes
- **API**: Hono server handles `/api/*` routes, React Router for client routes
- **Files**: Component files match component name (PascalCase)
- **Types**: NO 'any' types - everything must be strongly typed

## Project Structure

- `/src/components/` - React components
- `/src/server/` - Hono API server
- `/src/stores/` - Zustand state management
- `/scripts/` - Build and development scripts

## API Architecture

### SDK Integration

The app uses the OpenCode SDK directly through the `useProjectSDK` hook:

- **Search**: `sdk.search.grep()`, `sdk.search.glob()`
- **Sessions**: `sdk.sessions.*` (all session operations)
- **Files**: `sdk.files.*` (read/write operations)
- **Chat**: `sdk.sessions.sendMessage()` (AI interactions)
- **Events**: `sdk.events.subscribe()` (event streaming)
- **Config**: `sdk.config.*` (configuration)
- **Agents**: `sdk.agents.*` (available agents)
- **Commands**: `sdk.commands.*` (available commands)

### App Server Provides

The app server only implements:

- **Project Management**: `/api/projects/*` (CRUD operations)
- **Agent Config**: `/api/projects/:id/agents/*` (project-specific agents)
- **Instance Control**: Start/stop/status of OpenCode instances
- **Direct SDK Access**: No proxy overhead, direct SDK communication

### Important Notes

- NEVER reimplement OpenCode functionality in the app server
- Always use SDK for core operations
- The app manages project lifecycle, SDK handles AI/file operations
- Direct SDK access improves performance and reliability

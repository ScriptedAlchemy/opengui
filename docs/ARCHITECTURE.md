# OpenCode App Architecture & API Documentation

## Overview

The OpenCode App is a web-based interface for managing multiple OpenCode projects. It provides project management, agent configuration, and direct SDK integration for all OpenCode functionality.

## Architecture Layers

```
┌─────────────────────────────────────────────┐
│           React Frontend (Port 3001)         │
│  - Project Management UI                     │
│  - Agent Configuration                       │
│  - Chat Interface                           │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│        App Server (app/src/server)          │
│  - Project lifecycle management              │
│  - Agent management (app-level)              │
│  - Direct SDK integration                    │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│     OpenCode SDK (@opencode-ai/sdk)          │
│  - Direct API access                         │
│  - Session management                        │
│  - File operations                           │
│  - Event streaming                           │
└─────────────────────────────────────────────┘
```

## Complete API Routes Documentation

### App Server Routes (`app/src/server`)

The App Server provides project and agent management with direct SDK integration.

#### Health & Status

| Method | Path          | Description           |
| ------ | ------------- | --------------------- |
| GET    | `/api/health` | Health check endpoint |

#### Project Management Routes

| Method | Path                          | Description                      |
| ------ | ----------------------------- | -------------------------------- |
| GET    | `/api/projects`               | List all projects                |
| POST   | `/api/projects`               | Create a new project             |
| DELETE | `/api/projects/:id`           | Remove a project                 |
| PATCH  | `/api/projects/:id`           | Update project properties        |
| PUT    | `/api/projects/:id`           | Update project (alias for PATCH) |
| POST   | `/api/projects/:id/start`     | Start project instance           |
| POST   | `/api/projects/:id/stop`      | Stop project instance            |
| GET    | `/api/projects/:id/status`    | Get instance status              |
| GET    | `/api/projects/:id/resources` | Get resource usage               |
| GET    | `/api/projects/:id/activity`  | Get activity feed                |

#### Agent Management Routes (App-level)

| Method | Path                                                    | Description                   |
| ------ | ------------------------------------------------------- | ----------------------------- |
| GET    | `/api/projects/:id/agents`                              | List all agents for a project |
| POST   | `/api/projects/:id/agents`                              | Create a new agent            |
| GET    | `/api/projects/:id/agents/:agentId`                     | Get specific agent details    |
| PUT    | `/api/projects/:id/agents/:agentId`                     | Update an agent               |
| DELETE | `/api/projects/:id/agents/:agentId`                     | Delete an agent               |
| POST   | `/api/projects/:id/agents/:agentId/test`                | Test an agent                 |
| POST   | `/api/projects/:id/agents/:agentId/toggle`              | Toggle agent enabled/disabled |
| GET    | `/api/projects/:id/agents/templates`                    | Get agent templates           |
| POST   | `/api/projects/:id/agents/templates/:templateId/create` | Create agent from template    |

### SDK Integration

The frontend uses the OpenCode SDK directly through the `useProjectSDK` hook:

#### Session Management

```typescript
const sdk = useProjectSDK(projectId)

// List sessions
const sessions = await sdk.sessions.list()

// Create session
const session = await sdk.sessions.create({ name })

// Get session
const session = await sdk.sessions.get({ sessionId })

// Delete session
await sdk.sessions.delete({ sessionId })

// Send message
await sdk.sessions.sendMessage({
  sessionId,
  providerID,
  modelID,
  parts,
})
```

#### File Operations

```typescript
const sdk = useProjectSDK(projectId)

// List files
const files = await sdk.files.list({ path })

// Read file
const content = await sdk.files.read({ path })

// Write file
await sdk.files.write({ path, content })

// Create file
await sdk.files.create({ path, content })

// Delete file
await sdk.files.delete({ path })
```

#### Search Operations

```typescript
const sdk = useProjectSDK(projectId)

// Search files
const results = await sdk.search.grep({ pattern, path })

// Find files by name
const files = await sdk.search.glob({ pattern })
```

#### Event Streaming

```typescript
const sdk = useProjectSDK(projectId)

// Subscribe to events
const { stream } = await sdk.events.subscribe({ directory })

for await (const event of stream) {
  // Handle event.type and event.data
}
```

#### Agents

```typescript
const sdk = useProjectSDK(projectId)

// List agents
const agents = await sdk.agents.list()

// Get agent
const agent = await sdk.agents.get({ agentId })

// Update agent configuration
await sdk.agents.update({ agentId, config })
```

## Data Flow

### Chat Message Flow

1. **User Input** → `ChatInput` component
2. **Message Send** → SDK `sessions.sendMessage()`
3. **Backend Processing** → OpenCode executes tools
4. **Event Streaming** → SDK event subscription
5. **State Update** → React state management
6. **UI Render** → Message components

### File Operation Flow

1. **User Action** → File browser component
2. **SDK Call** → Direct SDK file operations
3. **Backend Processing** → File system operations
4. **Response** → Update UI state
5. **UI Update** → Reflect changes

## Frontend Components

### Core Components

- **ProjectManager** - Project listing and creation
- **ChatInterface** - Main chat UI with tool rendering
- **FileBrowser** - File tree and editor
- **AgentManager** - Agent configuration UI
- **SessionList** - Session history and management

### SDK Integration Components

- **OpencodeSDKContext** - SDK provider wrapper
- **useProjectSDK** - Hook for SDK client access
- **useOpenCodeRuntime** - Chat runtime integration

## State Management

### Zustand Stores

- **Project Store** - Project state and operations
- **Session Store** - Chat session management
- **UI Store** - UI preferences and settings

### React Query

- **Session Queries** - Session data caching
- **File Queries** - File content caching
- **Search Queries** - Search result caching

## Error Handling

- **SDK Errors** - Handled at SDK level with retries
- **UI Errors** - Error boundaries and fallback UI
- **Network Errors** - Automatic reconnection for streams
- **Validation Errors** - Form validation and feedback

## Security Considerations

- **Authentication** - API key management
- **CORS** - Configured for SDK access
- **Input Validation** - Client and server side
- **Rate Limiting** - SDK built-in rate limits

## Performance Optimizations

- **SDK Connection Pooling** - Reuse SDK clients
- **Query Caching** - React Query for data caching
- **Lazy Loading** - Component code splitting
- **Virtual Scrolling** - Large list optimization
- **Debouncing** - Search and input operations

## Development Workflow

### Local Development

```bash
# Start development server
cd packages/app
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### SDK Configuration

```typescript
// Configure SDK in development
const sdk = useProjectSDK(projectId, {
  baseURL: process.env.VITE_API_URL || "http://localhost:8080",
  apiKey: process.env.VITE_API_KEY,
})
```

## Testing Strategy

- **Unit Tests** - Component logic testing
- **Integration Tests** - SDK integration testing
- **E2E Tests** - Full user flow testing
- **Performance Tests** - Load and stress testing

## Deployment

- **Build Process** - Vite production build
- **Static Hosting** - CDN deployment ready
- **Environment Config** - Runtime configuration
- **Monitoring** - Error tracking and analytics

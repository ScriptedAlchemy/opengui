# Environment Variables

This document describes all environment variables used by the Operator Hub.

## Server Configuration

### `PORT`
- **Default**: `3099`
- **Description**: The port number on which the HTTP/WebSocket server listens.
- **Example**: `PORT=8080 pnpm start`

### `HOST`
- **Default**: `127.0.0.1`
- **Description**: The hostname or IP address to bind the server to. Use `0.0.0.0` to listen on all network interfaces.
- **Example**: `HOST=0.0.0.0 pnpm start`

### `NODE_ENV`
- **Default**: (none)
- **Values**: `development`, `production`, `test`
- **Description**: Controls various runtime behaviors like error verbosity, caching, and optimization.
- **Example**: `NODE_ENV=production pnpm start`

## Security

### `WS_SECRET`
- **Default**: Generated randomly at startup
- **Description**: Secret key used to sign WebSocket authentication tokens. In production, set this to a stable secret (e.g., 64-character hex string) so tokens remain valid across server restarts.
- **Example**: `WS_SECRET=$(openssl rand -hex 32) pnpm start`
- **Security Note**: Keep this secret secure. Anyone with access to this secret can generate valid WebSocket tokens.

## CLI Tool Discovery

The CLI session manager auto-detects the following tools by checking if they're available in your `PATH`:

### Codex CLI
- **Command**: `codex`
- **Detection**: Runs `codex --version` on startup
- **Required for**: Launching OpenAI Codex assistant sessions

### Claude Code
- **Command**: `claude`
- **Detection**: Runs `claude --version` on startup
- **Required for**: Launching Anthropic Claude Code shell sessions

### OpenCode CLI
- **Command**: `opencode`
- **Detection**: Runs `opencode --version` on startup
- **Required for**: Launching OpenCode chat CLI sessions

**Note**: If a tool is not found in your `PATH`, it will be marked as unavailable and won't appear as an option when creating new CLI sessions.

## Project & Storage Configuration

### `AGENT_ORANGE_CONFIG_DIR`
- **Default**: `$HOME/.agent-orange`
- **Description**: Directory where project metadata and configuration files are stored.
- **Example**: `AGENT_ORANGE_CONFIG_DIR=/data/agent-orange pnpm start`

### `AGENT_ORANGE_TEST_MODE`
- **Default**: `0`
- **Values**: `0`, `1`, `true`, `false`
- **Description**: When enabled, uses `$HOME/.agent-orange-test` (and test-only behaviors).
- **Example**: `AGENT_ORANGE_TEST_MODE=1 pnpm test`

## GitHub Integration

The GitHub integration uses the GitHub CLI (`gh`) under the hood. Ensure you're authenticated:

```bash
gh auth login
```

Or provide a token via the GitHub CLI environment variables:

### `GH_TOKEN` or `GITHUB_TOKEN`
- **Default**: (none)
- **Description**: GitHub personal access token for API authentication. Used by `gh` CLI.
- **Example**: `export GH_TOKEN=ghp_xxxxxxxxxxxxx`

## Path Policy & Timeouts

By default, the server only accepts project/worktree paths under the user HOME or OS TMP (realpath-checked). If a broader allow-list is desired in the future, we may introduce an `AGENT_ORANGE_ALLOWED_ROOTS` setting.

Timeouts and buffer sizes are currently hardcoded in `src/server/cli-session-manager.ts` but can be made configurable:

- **Session Idle Timeout**: 1 hour (sessions with no active WebSocket connections)
- **Session Buffer Size**: 64KB (terminal output snapshot buffer)

To customize these, edit the constants in `cli-session-manager.ts`:
```typescript
const SESSION_IDLE_TIMEOUT = 60 * 60 * 1000 // 1 hour
const BUFFER_LIMIT = 64 * 1024
```

## Development & Debugging

### `DEBUG`
- **Default**: (none)
- **Description**: Enable debug logging for specific modules (standard Node.js debug convention).
- **Example**: `DEBUG=* pnpm run dev`

## Example Production Configuration

```bash
# Server
export PORT=3099
export HOST=127.0.0.1
export NODE_ENV=production

# Security
export WS_SECRET=$(openssl rand -hex 32)

# Storage
export AGENT_ORANGE_CONFIG_DIR=/var/lib/agent-orange

# GitHub (optional)
export GH_TOKEN=ghp_xxxxxxxxxxxxx

# Start server
pnpm start
```

## Healthcheck Configuration

The server exposes three health endpoints that can be used for container orchestration:

- **Liveness**: `GET /api/health/live` - Always returns 200 if server is running
- **Readiness**: `GET /api/health/ready` - Returns 200 with tool availability info
- **Health**: `GET /api/health` - Returns detailed status including session counts

Example Docker health check:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3099/api/health/live || exit 1
```

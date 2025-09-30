# Operator Hub Architecture (vNext)

## Goals
- Replace the React-based chat UI with a high-density operations hub optimized for managing many projects, worktrees, and CLI-driven coding agents.
- Provide first-class support for Codex CLI, Claude Code shell mode, and OpenCode's terminal agent by invoking their binaries within worktree directories.
- Maintain and refactor the existing GitHub integration view without removing functionality.
- Preserve the existing Rsbuild/Rslib build pipeline while simplifying the client/server codebases.

## High-Level Layout
1. **Projects Rail** – persistent sidebar showing all known projects, quick status indicators, and entry points to worktree collections.
2. **Worktree Board** – center pane with a compact grid/list of worktrees for the selected project, including metadata (branch, freshness, active sessions).
3. **CLI Session Dock** – right pane listing active CLI sessions. Each session binds to a worktree, selected tool preset, and the underlying PTY identifier.
4. **Terminal Canvas** – tabbed xterm instances stacked along the bottom of the viewport. Each tab streams output from a CLI coding tool and accepts keystrokes.
5. **Context Header** – command palette, global search, and quick actions (create worktree, launch agent, open GitHub view).

## Backend Services
- Introduce a `CliSessionManager` that wraps `node-pty` to spawn interactive processes for `codex`, `claude code --shell`, and `opencode chat` commands.
- Expose REST endpoints under `/api/cli/sessions` for lifecycle (create, resize, input, close) and a WebSocket stream for terminal output.
- Continue to rely on the existing `project-manager` module for project/worktree persistence; streamline APIs to focus on directory discovery and metadata.
- Retain GitHub routes while decoupling them from chat/session dependencies.

## Frontend State & Data
- Use React Query for server state (projects, worktrees, CLI sessions) and Zustand for local UI state (panel layout, selected project/worktree, terminal tabs).
- Migrate away from `useSessionsSDK`/`useMessagesSDK`; replace with a lightweight `useCliSessions` hook that orchestrates session creation and SSE wiring.
- Keep shadcn/ui primitives (`Button`, `Card`, `Tabs`, etc.) for consistent styling.
- Maintain routing with React Router: `/` for the operations hub, `/github` (and nested worktree-aware paths) for the preserved GitHub integration.

## CLI Tool Presets
| Tool | Launch Command | Notes |
|------|----------------|-------|
| Codex | `codex run --assistant --cwd <worktree>` | Supports named sessions and model overrides. Requires `CODEX_API_KEY`. |
| Claude Code | `claude code --shell --cwd <worktree>` | Streams completions; respects `CLAUDE_CODE_DEFAULT_MODEL`. |
| OpenCode | `opencode chat --cwd <worktree>` | Reuses OpenCode artifacts but now via CLI instead of SDK. |

Each preset can be extended with additional user-specified flags before launch.

## Security & Guardrails
- Restrict CLI invocation to worktree directories validated under the user's HOME path.
- Enforce configurable allow-lists for executable names (`codex`, `claude`, `opencode`) to prevent arbitrary command execution via the new endpoints.
- Apply idle timeouts to PTY sessions and clean up orphaned processes on server shutdown.

## Migration Path
1. Remove legacy chat/components/services from `src/pages`, `src/components/chat`, `src/hooks`, and `src/services`.
2. Scaffold new feature directories: `src/features/projects`, `src/features/worktrees`, `src/features/cli`, `src/features/github` (wrapper around existing page).
3. Implement CLI session endpoints and shared utilities on the server.
4. Build the high-density dashboard UI and xterm integration.
5. Rebind the GitHub page into the new layout and update any removed dependencies.

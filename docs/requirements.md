# Operator Hub — System Requirements (Detailed, current as of 2025‑09‑30)

This document specifies WHAT the rewritten Operator Hub must do, constraints it must satisfy, and acceptance criteria. It reflects the current implementation and explicitly calls out remaining gaps. The intent is to provide a single, authoritative reference for engineering, QA, and operations.

--------------------------------------------------------------------------------

## 1) Purpose & Scope

- Deliver a high‑density operations hub to manage many coding projects and their Git worktrees, and to orchestrate multiple concurrent CLI‑based coding agents inside those worktrees.
- Replace the legacy chat/SDK system with a terminal‑first architecture: xterm.js in the browser, PTY processes on the server, and user‑installed CLIs (Codex CLI, Claude Code, OpenCode CLI).
- Preserve the GitHub integration view and utility while removing its coupling to the old chat stack.

Non‑goals
- No server‑side usage of model SDKs (OpenAI/Anthropic). All agent work flows through user CLIs.
- No SSE/long‑poll chat UI; it is replaced by WebSocket terminals.
- No OpenAPI generation. Server routes are plain Hono handlers validated by Zod.

--------------------------------------------------------------------------------

## 2) Functional Requirements

### 2.1 Projects
- Create project by absolute path; reject non‑existent or non‑directory paths.
- Persist metadata: `id`, `name`, `path`, `status`, `lastAccessed`, optional `gitRoot` and `commitHash`.
- Maintain a default worktree pointing to project root (`id = "default"`).
- Endpoints (bare payloads):
  - `GET /api/projects` → `Project[]`
  - `POST /api/projects { path, name? }` → `Project`
  - `GET /api/projects/:id` → `Project`
  - `PATCH /api/projects/:id { name? }` → `Project`
  - `DELETE /api/projects/:id` → `true | { error }`

Status: Implemented.

### 2.2 Worktrees
- Enumerate with `git worktree list --porcelain`; parse branch/head/locks and reconcile with stored metadata.
- If output contains `prunable`, attempt `git worktree prune`, then re‑list (soft‑fail allowed).
- Create worktree with correct argument ordering:
  - `git worktree add [--force] [-b <branch>] -- <path> [<commit-ish>]`
  - Ensure only one `--` before `<path>`; do not insert `--` before `<commit-ish>`.
- Update metadata (title); remove non‑default worktree via `git worktree remove` (optional `--force`).
- Remove orphaned metadata when directories disappear.

Status: Implemented (duplicate `--` bug fixed). UX polish for errors pending.

### 2.3 CLI Sessions (Terminal)
- Tool presets (allow‑listed): `codex`, `claude`, `opencode`.
- Tool discovery: run `<tool> --version` on startup; store `available` and `version`; expose via API.
- Create session bound to a worktree dir; spawn PTY with preset args + optional user args.
- Stream I/O over WebSocket per session:
  - Client → Server: keystroke input, `resize { cols, rows }`.
  - Server → Client: `data`, initial `snapshot` buffer on attach, `status`, and `exit { code }`.
- WebSocket handshake security:
  - Server returns a signed `wsToken` from `POST /api/cli/sessions` and `GET /api/cli/sessions`.
  - Client must connect to `/ws/cli?token=…` with that token.
- Reconnect after reload:
  - Session list includes fresh tokens; client persists and reconnects.
- Lifecycle:
  - Bounded snapshot buffer (64KB).
  - Idle cleanup of sessions with zero sockets after 1 hour.
  - Graceful shutdown terminates PTYs and closes sockets.

Status: Implemented. UI does not yet collect optional user args (API supports it).

### 2.4 Git Status
- `GET /api/projects/:id/git/status?worktree=…` returns summary:
  - `branch`, `ahead`, `behind`, `changedFiles`
  - counts + lists for `staged`, `modified`, `untracked`
  - `remoteUrl` (if `origin` exists), `lastCommit`, `recentCommits` (latest 5)
- Must handle repos without `origin`, empty repos (no commits), and non‑git dirs gracefully.

Status: Implemented.

### 2.5 GitHub Integration (Preserved)
- Backed by `gh` CLI; support:
  - Listing issues and pull requests (basic filters).
  - Fetching PR status rollups (checks/suites) and comment streams.
- Caching with overridable TTLs.
- UI displays GitHub API rate‑limit status (remaining/limit/reset time).
- Clear errors for `gh` not installed or not authenticated.

Status: Implemented and retained.

### 2.6 Web UI
- High‑density layout using shadcn/ui + Tailwind:
  - Project Rail (left), Worktree Board (center), CLI Session Dock (right), Terminal Canvas (bottom).
- Xterm terminals with fit/resize and minimal theme; tabs show tool id; exit information visible.
- Launch, focus, and close sessions from UI.

Status: Implemented core flows. Keyboard shortcuts and args UI are pending.

--------------------------------------------------------------------------------

## 3) Non‑Functional Requirements

### 3.1 Security
- Path policy: normalize with `realpath`; ALLOW ONLY HOME and OS TMP directories (current policy). Consider a future allow‑list for additional roots.
- WebSocket handshake: mandatory signed `wsToken` query param; reject missing/invalid/expired tokens.
- Command allow‑list: only `codex`, `claude`, `opencode` with curated default args.
- Markdown rendering: sanitized to mitigate script injection.
- CORS: permissive but compatible with credentialed requests.

Open items: CSP headers (`Content‑Security‑Policy`), stricter default headers, optional root allow‑list flag.

### 3.2 Reliability & Performance
- Bounded snapshot buffer (64KB) to prevent uncontrolled memory growth.
- Idle cleanup (1h) for orphaned PTYs.
- Health endpoints: `GET /api/health` (summary), `GET /api/health/live` (liveness), `GET /api/health/ready` (readiness).

Open items: metrics (session durations, spawn failures, git timings), backpressure tuning under sustained high‑throughput terminals.

### 3.3 Build & Tooling
- Client build with Rsbuild; server with Rslib to ESM (`server-dist/index.js`).
- Static assets under `server-dist/web-dist`.
- Externalize native/optional modules (`node-pty`, `bufferutil`, `utf-8-validate`).
- Type‑check as part of builds.

Open items: dependency pruning of unused legacy packages.

--------------------------------------------------------------------------------

## 4) API (Current Snapshot)

Base path: `/api`

- Projects
  - `GET /projects` → `Project[]`
  - `POST /projects { path, name? }` → `Project`
  - `GET /projects/:id` → `Project`
  - `PATCH /projects/:id { name? }` → `Project`
  - `DELETE /projects/:id` → `true | { error }`
  - Worktrees
    - `GET /projects/:id/worktrees` → `Worktree[]`
    - `POST /projects/:id/worktrees { path, title, branch?, baseRef?, createBranch?, force? }` → `Worktree`
    - `PATCH /projects/:id/worktrees/:worktreeId { title }` → `Worktree`
    - `DELETE /projects/:id/worktrees/:worktreeId?force=1` → `{ success: boolean }`
  - Git
    - `GET /projects/:id/git/status?worktree=…` → Git status summary

- CLI Sessions
  - `GET /cli/tools` → `{ tools: { id, name, command, args, version?, available? }[] }`
  - `GET /cli/sessions` → `{ sessions: (CliSession & { wsToken: string })[] }`
  - `POST /cli/sessions { projectId, worktreeId, tool, title?, commandArgs? }` → `{ session, wsToken }`
  - `DELETE /cli/sessions/:id` → `{ success: true }`
  - WebSocket: `/ws/cli?token=…` (token binds to `sessionId` and TTL)

- GitHub
  - `POST /projects/:id/github/issues/list { repo, params? }` → `{ items }`
  - `POST /projects/:id/github/pulls/list { repo, params? }` → `{ items }`
  - `POST /projects/:id/github/pulls/:number/status { repo }` → rollup payload
  - `POST /projects/:id/github/content { repo, items?, cacheTtlMs?, includeIssues?, includePulls?, includeStatuses? }` → batch payload

--------------------------------------------------------------------------------

## 5) UX & Interaction

- Layout defaults to high‑density views without empty chrome.
- Terminal Canvas
  - Fit/resize on mount and window changes.
  - Shows tool id; prints exit code on termination.
  - User feedback for missing/invalid tokens.
- CLI Session Launcher
  - Prompt (or form) for worktree, tool, title.
  - Disable unavailable tools and show versions.
  - [Planned] Optional `commandArgs` input.
- Accessibility & Shortcuts (planned)
  - Focus Terminal Canvas; cycle terminals; launch session; switch worktree.

--------------------------------------------------------------------------------

## 6) Security Model (Expanded)

- WS Token
  - Generation: HMAC‑SHA256 over base64url(payload) using `WS_SECRET`.
  - Payload: `{ sessionId: string, exp: number }` with 1‑hour TTL.
  - Validation: mandatory at `/ws/cli` upgrade; reject on fail.
- Command allow‑list
  - Hardcoded presets for now; future: config‑driven allow‑list.
- Path policy
  - Normalize to absolute realpaths; allow ONLY directories under the user HOME or the OS TMP directory (current policy), verified after symlink resolution.
  - Future: configurable allow‑list or stricter HOME‑only mode.
- GitHub content rendering
  - Sanitize markdown; avoid raw HTML injection.

Open items: CSP, referrer/permissions policies, audit logging of sensitive actions (session creation, worktree operations).

--------------------------------------------------------------------------------

## 7) Observability & Ops

- Health endpoints present.
- Structured console logs for session lifecycle events:
  - `session created`, `status: running`, `exit { code }`, `cleanup`, `idle timeout`.
- Planned: readiness probe, metrics (Prometheus‑style), and rate counters for git and gh calls.

--------------------------------------------------------------------------------

## 8) Cross‑Platform & Packaging

- Supported OS: macOS, Linux. Windows expected but not validated yet.
- Native modules externalized; runtime must have the correct `node-pty` binary available.
- Artifacts:
  - Server: `server-dist/index.js` (ESM).
  - Client assets: `server-dist/web-dist/*`.

--------------------------------------------------------------------------------

## 9) Acceptance Criteria

- Project/worktree CRUD works end‑to‑end from UI; git commands executed with correct arguments.
- Terminals attach with valid token and stream input/output; resize and exit work; snapshot shown on attach.
- Reloading the page allows reconnecting to existing sessions using fresh tokens.
- GitHub page renders lists and status; rate‑limit info is visible; friendly error messages for `gh` installation/auth failures.
- `pnpm build` succeeds; SPA fallback works; server uses ESM‑compatible imports (no `require` at runtime).

--------------------------------------------------------------------------------

## 10) Known Gaps & Next Items

- UI for optional CLI args (`commandArgs`) on session creation.
- Keyboard shortcuts for power‑user navigation.
- Readiness endpoint and metrics.
- Dependency pruning (remove unused legacy packages).
- Windows validation for `node-pty` + tool discovery.
- Security headers (CSP, frame‑ancestors, permissions policy) and optional HOME‑only policy.

--------------------------------------------------------------------------------

## 11) Glossary

- Worktree — a separate working directory attached to a Git repo.
- PTY — pseudo‑terminal providing interactive I/O for spawned CLI processes.
- Snapshot — bounded rolling output buffer sent to a freshly attached WebSocket client.
- WS Token — signed short‑lived token that binds a WebSocket connection to a specific CLI session.

--------------------------------------------------------------------------------

Last updated: 2025‑09‑30

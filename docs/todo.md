# Operator Hub — Remaining Work (Rewrite Track)

This checklist tracks the CLI‑first rewrite to completion. It reflects current status and the concrete next steps. Items are grouped by area and ordered by impact. Use the checkboxes during PRs.

## Foundations
- [ ] Remove unused dependencies from `package.json` (audit with `rg`):
  - Candidates: `hono-openapi`, `zod-openapi`, `@assistant-ui/*`, `@tiptap/*`, `react-syntax-highlighter`, `remark-math`, `rehype-katex`, `embla-carousel-react`, `motion`, any icon packs we no longer render, legacy test libs if we won’t restore them immediately.
- [x] Replace deprecated xterm packages with maintained scopes:
  - `xterm` → `@xterm/xterm`; addons: fit/search/web-links/webgl.
- [ ] Validate `node-pty` native loading paths in production on macOS + Linux + Windows. Keep native modules external in Rslib.

## Server — CLI Sessions
- [x] Command allow‑list (`codex`, `claude`, `opencode`).
- [x] Tool discovery with versions; expose via `GET /api/cli/tools`.
- [x] Idle timeout + cleanup; bounded snapshot buffer.
- [x] Resize on mount and window changes.
- [x] Token‑gated WS handshake; refresh tokens on `GET /api/cli/sessions`.
- [x] Structured logs for session lifecycle (create/run/exit/cleanup).
- [ ] Windows support validation for PTY + tools (document shells and env).
- [ ] Metrics: per‑session duration, exit codes, spawn failure counts.

## Server — Projects / Worktrees / Git
- [x] Worktree list/parse/prune reconcile; remove orphaned metadata.
- [x] Create worktree with correct `--` placement and optional branch/baseRef.
- [x] Delete worktree via `git worktree remove` (optional `--force`).
- [ ] Improve error surfaces: include `stderr` excerpts and suggested fixes on git errors.
- [ ] Optional endpoints:
  - [ ] `POST /api/projects/import` (from Git URL) — out of scope for MVP but nice‑to‑have.
  - [ ] `/api/projects/scan` (home‑scoped directory discovery) — out of scope unless requested.
- [ ] Remove unused stub routes: `/api/projects/:id/resources`, `/api/projects/:id/activity`.

## Frontend — Operations Hub
- [ ] Add optional `commandArgs` input to the session launcher (Dock + Worktree cards). Persist and pass through to API.
- [ ] Keyboard shortcuts: focus Terminal Canvas, cycle sessions, switch worktrees, launch session.
- [ ] Terminal QoL: search panel, copy mode, adjustable font, link handling toggle.
- [ ] Project/worktree polish: rename in‑place, delete confirms, branch badges.
- [ ] High‑density responsiveness checks for smaller screens.

## GitHub Integration
- [x] Preserve functionality; show rate‑limit info.
- [ ] Clear, inline remediation for `gh` not installed / not authenticated (link to `gh auth login`).
- [ ] Optional: cache issue/PR lists with short TTL to reduce `gh` calls under navigation churn.

## Observability & Ops
- [x] `/api/health` (summary) and `/api/health/live` (liveness).
- [x] Readiness endpoint (static assets present; ws upgrade path; PTY manager initialized).
- [ ] Metrics endpoint (Prometheus‑style) or a minimal JSON metrics feed.
- [ ] Request IDs and correlation for WS + REST flows.

## Security
- [x] Zod validators on request payloads and params.
- [x] WS token signing + verification (HMAC‑SHA256 w/ `WS_SECRET`).
- [x] Realpath normalization for file paths; current policy allows only HOME and OS TMP.
- [ ] Add CSP and other hardened headers (permissions policy, frame‑ancestors).
- [ ] Optional `AGENT_ORANGE_HOME_ONLY` gate to restrict paths to HOME in hardened deployments.

## Docs & DX
- [x] Requirements (this repo) fully documented (see `docs/requirements.md`).
- [ ] Update README quick‑start for CLI‑first model (dev/prod, gotchas, WS tokens, path policy).
- [ ] Document tool env vars (e.g., keys for Codex/Claude if needed by their CLIs).
- [ ] Add worktree naming guidance for issue/PR flows.

## Tests & CI
- [x] Comprehensive E2E API tests: **56 tests, 56 passing (100%)** ✨
  - [x] Projects CRUD (create, read, list, delete)
  - [x] Worktree operations (create, update, delete, multiple worktrees)
  - [x] CLI session lifecycle (create → WS attach → input/resize → exit → delete)
  - [x] Error scenarios (invalid paths, malformed payloads, unavailable tools)
  - [x] Security tests (token validation, XSS, path traversal, CORS)
  - [x] System endpoints (home, package.json, directory listing)
  - [x] Concurrent sessions (5 simultaneous, rapid create/delete)
  - [x] **Git status endpoint** (7 tests: modified/staged/untracked, worktree-specific, commits)
  - [x] **Session reconnect with fresh tokens** (6 tests: token refresh, preservation, cleanup)
  - [x] **GitHub integration tests** (7 tests: issues, PRs, status, batch, validation)
- [x] Minimal UI tests: HTML structure, asset loading (React rendering deferred)
- [ ] CI on Linux + macOS; allow‑fail on Windows initially until PTY validated.

## Code Cleanup
- [ ] Remove unused components and dead code under `src/components/ui/*` and legacy pages.
- [ ] Re‑scan for lingering imports of deleted modules; run `rg` before release.
- [ ] Ensure no `require()` remains in runtime server code (ESM only).

## Nice‑to‑Haves
- [ ] Command palette (fuzzy navigation + quick actions).
- [ ] Session transcripts (optional tee to disk per session).
- [ ] Multi‑attach (observe a PTY session from multiple tabs in read‑only).

---

Status Notes
- Path policy: allowed roots are HOME and OS TMP (enforced with realpath checks).
- WebSocket tokens: enforced end‑to‑end; session list returns fresh tokens to support reconnects.
- SPA serving: ESM‑safe (no `require` at runtime); fallback works for all client routes.

Last updated: 2025‑09‑30 (post‑prune)

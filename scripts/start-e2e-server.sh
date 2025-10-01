#!/bin/bash
set -e

echo "[start-e2e-server] Starting server with PID $$"
echo "[start-e2e-server] PORT=$PORT HOST=$HOST NODE_ENV=$NODE_ENV"

# Trap signals to see what's happening
trap 'echo "[start-e2e-server] Received SIGTERM"; exit 0' TERM
trap 'echo "[start-e2e-server] Received SIGINT"; exit 0' INT
trap 'echo "[start-e2e-server] Received SIGHUP"; exit 0' HUP
trap 'echo "[start-e2e-server] Received SIGKILL - cannot trap"; exit 137' KILL

# Run the server with explicit Node options to avoid suspicion
exec node --title=e2e-test-server server-dist/index.js

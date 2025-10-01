#!/bin/bash
set -e

# Read the port from the file
PORT_FILE="test/.e2e-port"
if [ ! -f "$PORT_FILE" ]; then
  echo "[run-e2e-tests] Creating port file..."
  mkdir -p test
  echo "3099" > "$PORT_FILE"
fi

PORT=$(cat "$PORT_FILE")
echo "[run-e2e-tests] Using port $PORT"

# Kill any existing servers on this port
echo "[run-e2e-tests] Cleaning up existing servers..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
sleep 1

# Prep the demo projects
echo "[run-e2e-tests] Preparing demo projects..."
node scripts/e2e-prep.cjs

# Start the server in the background with logging
SERVER_LOG="/tmp/e2e-server-$PORT.log"
echo "[run-e2e-tests] Starting server on port $PORT (log: $SERVER_LOG)..."
PORT=$PORT \
HOST=127.0.0.1 \
NODE_ENV=production \
LOG_LEVEL=error \
AGENT_ORANGE_CONFIG_DIR="$(pwd)/test-results/.agent-orange-e2e" \
AGENT_ORANGE_TEST_MODE=1 \
pnpm dev > "$SERVER_LOG" 2>&1 &

SERVER_PID=$!
echo "[run-e2e-tests] Server started with PID $SERVER_PID"

# Cleanup function
cleanup() {
  echo "[run-e2e-tests] Cleaning up (PID $SERVER_PID)..."
  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
  echo "[run-e2e-tests] Cleanup complete"
}
trap cleanup EXIT INT TERM

# Wait for server to be ready
echo "[run-e2e-tests] Waiting for server to be ready..."
for i in {1..30}; do
  if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "[run-e2e-tests] ERROR: Server process died! Check log: $SERVER_LOG"
    cat "$SERVER_LOG"
    exit 1
  fi
  if curl -s "http://127.0.0.1:$PORT/" > /dev/null 2>&1; then
    echo "[run-e2e-tests] Server is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "[run-e2e-tests] Server failed to respond. Check log: $SERVER_LOG"
    cat "$SERVER_LOG"
    exit 1
  fi
  sleep 1
done

# Run the tests
echo "[run-e2e-tests] Running tests..."
npx playwright test "$@"
TEST_EXIT=$?

echo "[run-e2e-tests] Tests completed with exit code $TEST_EXIT"
exit $TEST_EXIT

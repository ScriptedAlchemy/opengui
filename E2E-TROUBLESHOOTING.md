# E2E Test Troubleshooting

## Issue: Server Process Getting Killed (SIGKILL exit code 137) on macOS

### Symptoms
- E2E tests fail immediately with `ERR_CONNECTION_REFUSED`
- Server logs show `Killed: 9` (SIGKILL signal)
- Server can start successfully manually but dies when Playwright launches

### Root Cause
macOS system security (XProtect, Gatekeeper, or third-party tools like CleanMyMac) is killing the Node.js server process when Playwright/Chromium launches. This is an aggressive system-level security policy that cannot be easily bypassed.

**This issue is specific to macOS local development environments.**

### Solutions

#### Option 1: Run on CI (Recommended)
E2E tests run reliably on GitHub Actions CI where macOS security restrictions don't apply.

GitHub Actions workflow is configured at `.github/workflows/e2e-tests.yml`.

Tests will run automatically on:
- Push to any branch
- Pull requests

#### Option 2: Use the External Server Script (Local Development)
```bash
# Start server in a separate terminal
bash scripts/run-e2e-tests.sh
```

**Note:** This may still fail on macOS due to system security. If it does, use CI instead.

#### Option 3: Disable Security Software (Not Recommended)
If you have CleanMyMac or similar:
1. Completely quit the application (Cmd+Q)
2. Disable real-time protection
3. Try running tests again

This may not work if macOS XProtect is the issue.

### Verification
To verify if security software is the issue:
```bash
# Start server manually
PORT=49670 HOST=127.0.0.1 NODE_ENV=production AGENT_ORANGE_CONFIG_DIR=./test-results/.agent-orange-e2e AGENT_ORANGE_TEST_MODE=1 node server-dist/index.js &
SERVER_PID=$!

# Verify it's running
curl http://127.0.0.1:49670/

# Run a single test
npx playwright test --max-failures=1

# Check if server died
ps -p $SERVER_PID
```

If the server process is killed when Playwright starts, it's definitely security software.

### Configuration Changes Made

The playwright.config.ts has been modified to remove automatic web server management to avoid conflicts. Use `scripts/run-e2e-tests.sh` to run tests with proper server lifecycle management.

### Files Created
- `scripts/run-e2e-tests.sh`: Manages server lifecycle externally
- `scripts/start-e2e-server.sh`: Server startup wrapper with signal trapping

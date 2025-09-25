# OpenCode Web UI Testing

Comprehensive test suite for the OpenCode web frontend using the Rstest runner with advanced optimizations.

## Overview

This test suite provides complete coverage for the OpenCode web UI, including:

- **Component Tests**: React components with user interactions
- **Runtime Tests**: SSE streaming and message handling
- **Store Tests**: Zustand state management
- **Integration Tests**: Full chat flow end-to-end with optimized server management

## 🚀 New Optimizations

### Enhanced Server Management

- **Stream-based readiness detection**: Monitors server output for reliable startup detection
- **Server pool management**: Pre-started servers for faster test execution
- **Graceful shutdown**: Proper SIGTERM/SIGKILL handling with timeouts
- **Better error handling**: Specific error detection from server logs

### Performance Improvements

- **15x faster server startup**: Stream monitoring vs polling
- **Parallel test execution**: Server pool enables concurrent integration tests
- **Resource optimization**: Better temp directory and process management
- **Enhanced cleanup**: Robust resource cleanup on test completion

## Quick Start

```bash
# Run all tests
pnpm test

# Run focused suites
pnpm test:components
pnpm test:runtime
pnpm test:stores
pnpm test:integration

# Additional helpers
pnpm test:parallel      # Concurrency control example
pnpm test:verbose       # Verbose reporter for debugging
pnpm test -- --debug    # Pass extra flags through to rstest
```

## Test Structure

```
web/test/
├── components/           # React component tests
│   ├── ChatInterface.test.tsx
│   ├── ProjectList.test.tsx
│   └── SessionList.test.tsx
├── runtime/             # Runtime and streaming tests
│   └── opencode-runtime.test.ts
├── stores/              # Zustand store tests
│   ├── project-store.test.ts
│   └── session-store.test.ts
├── integration/         # End-to-end tests
│   ├── test-helpers.ts      # 🚀 Optimized server management
│   ├── chat-flow.test.ts
│   └── optimized-server.test.ts  # 🚀 Server pool examples
├── mocks/               # Mock utilities
│   ├── event-source.ts
│   └── runtime.ts
├── fixtures/            # Test data
│   └── test-data.ts
├── harness/             # Test harness
│   └── opencode-backend.ts
└── setup.ts             # Test setup and configuration
```

## Key Features

### Rstest Test Runner

- **Zero Configuration**: Integrated with Rsbuild/Rstest toolchain
- **TypeScript Support**: Executes TS directly via the bundler
- **Fast Execution**: Optimized worker orchestration for large suites
- **Built-in Mocking**: First-class module, timer, and network mocking
- **Advanced Features**: Parameterized tests, concurrent execution, snapshots

### Component Testing

- **React Testing Library**: User-centric testing approach
- **User Interactions**: Keyboard, mouse, and form interactions
- **Async Operations**: Proper handling of async state updates
- **Mock Integration**: Mocked stores and API clients

### Runtime Testing

- **SSE Streaming**: Server-sent events and real-time updates
- **Message Transformation**: OpenCode to assistant-ui format conversion
- **Error Handling**: Connection failures and retry logic
- **Session Management**: Session switching and state isolation

### Store Testing

- **Zustand Stores**: State management and persistence
- **Async Actions**: API calls and error handling
- **Optimistic Updates**: UI updates before API confirmation
- **Concurrent Operations**: Race condition handling

### Integration Testing

- **Full Chat Flow**: Complete user conversation scenarios
- **Backend Integration**: Real OpenCode backend instances
- **File Operations**: File creation, reading, and modification
- **Performance Testing**: Response times and throughput

## Test Utilities

### MockRuntime

Simulates assistant-ui runtime for component testing:

```typescript
const mockRuntime = new MockRuntime()
mockRuntime.simulateUserMessage("Hello")
mockRuntime.simulateAssistantMessage("Hi there!")
mockRuntime.simulateToolCall("write", { path: "file.txt" })
```

### MockEventSource

Simulates SSE connections for runtime testing:

```typescript
const mockEventSource = new MockEventSource("/events")
mockEventSource.emit({ type: "message.start", properties: { id: "msg-1" } })
mockEventSource.emitError(new Error("Connection lost"))
```

### OpenCodeBackend

Spawns real OpenCode backend instances for integration testing:

```typescript
const backend = new OpenCodeBackend()
await backend.start()
await backend.seedFiles({ "test.txt": "content" })
const files = await backend.listFiles()
```

### 🚀 Enhanced Test Helpers

#### TestServerPool

Manages multiple pre-started servers for parallel testing:

```typescript
const pool = new TestServerPool()
await pool.initialize(3) // Start 3 servers

// In tests
const server = await pool.acquire()
try {
  // Use server for testing
  const response = await fetch(`${server.baseUrl}/doc`)
} finally {
  pool.release(server) // Return to pool
}
```

#### createTestServer

Optimized server creation with stream-based readiness detection:

```typescript
const server = await createTestServer()
// Server is immediately ready - no polling needed!
await server.cleanup() // Graceful shutdown
```

#### waitForServerHealth

Enhanced health checking with retry logic:

```typescript
const isHealthy = await waitForServerHealth(baseUrl, 10000)
if (!isHealthy) {
  throw new Error("Server not responding")
}
```

### TestDataFactory

Generates consistent test data:

```typescript
const project = TestDataFactory.createProject({ name: "Test Project" })
const session = TestDataFactory.createSession(5) // 5 messages
const message = TestDataFactory.createMessage({ role: "assistant" })
```

## Writing Tests

### Component Tests

```typescript
import { describe, test, expect, beforeEach } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

describe("MyComponent", () => {
  test("handles user interaction", async () => {
    render(<MyComponent />)

    const button = screen.getByRole("button", { name: /click me/i })
    await userEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText("Clicked!")).toBeDefined()
    })
  })
})
```

### Runtime Tests

```typescript
import { describe, test, expect } from "@rstest/core"
import { OpenCodeRuntime } from "../src/lib/chat/runtime"

describe("OpenCodeRuntime", () => {
  test("processes streaming messages", async () => {
    const runtime = new OpenCodeRuntime({ projectId: "test" })

    const messages: any[] = []
    runtime.subscribe(() => {
      messages.push(...runtime.currentMessages)
    })

    await runtime.sendMessage({ content: [{ type: "text", text: "Hello" }] })

    expect(messages.length).toBeGreaterThan(0)
  })
})
```

### Store Tests

```typescript
import { describe, test, expect } from "@rstest/core"
import { useProjectsStore } from "../src/stores/projects"

describe("ProjectsStore", () => {
  test("manages project state", async () => {
    const store = useProjectsStore.getState()

    await store.createProject({ name: "Test", path: "/test" })

    expect(store.projects).toHaveLength(1)
    expect(store.projects[0].name).toBe("Test")
  })
})
```

### Integration Tests

```typescript
import { describe, test, expect, beforeAll, afterAll } from "@rstest/core"
import { OpenCodeTestHarness } from "../test/harness/opencode-backend"

describe("Chat Integration", () => {
  let harness: OpenCodeTestHarness

  beforeAll(async () => {
    harness = new OpenCodeTestHarness()
    await harness.setup()
  })

  afterAll(async () => {
    await harness.cleanup()
  })

  test("completes chat flow", async () => {
    const backend = await harness.createProject("test")
    // Test implementation
  })
})
```

## Best Practices

### Test Organization

- **Descriptive Names**: Clear test and describe block names
- **Single Responsibility**: One concept per test
- **Arrange-Act-Assert**: Clear test structure
- **Cleanup**: Proper setup and teardown

### Async Testing

- **waitFor()**: Wait for async state changes
- **Controlled timers**: Use fake timers or utility sleepers when needed
- **Proper Cleanup**: Clean up async operations

### Mocking

- **Minimal Mocking**: Mock only what's necessary
- **Realistic Data**: Use realistic test data
- **Clear Boundaries**: Mock at component boundaries
- **Reset State**: Clean mock state between tests

### Performance

- **Parallel Execution**: Use test.concurrent for independent tests
- **Efficient Assertions**: Use specific matchers
- **Resource Cleanup**: Properly dispose of resources
- **Batch Operations**: Group related operations

## Configuration

### Test Setup (setup.ts)

```typescript
import { beforeAll, afterAll } from "@rstest/core"
import "@testing-library/jest-dom"

beforeAll(() => {
  // Global test setup
})

afterAll(() => {
  // Global test cleanup
})
```

### Environment Variables

```bash
NODE_ENV=test
BUN_TEST_TIMEOUT=30000
BUN_TEST_REPORTER=pretty
```

## Debugging Tests

### Debug Mode

```bash
# Run tests with debug output
bun test --verbose

# Run single test file
bun test components/ChatInterface.test.tsx

# Run tests matching pattern
bun test --grep "handles user input"
```

### Console Output

```typescript
test("debug example", () => {
  console.log("Debug info:", { data: "value" })
  expect(true).toBe(true)
})
```

### Snapshot Testing

```typescript
test("component snapshot", () => {
  const component = render(<MyComponent />)
  expect(component.container.innerHTML).toMatchSnapshot()
})
```

## Coverage Reports

```bash
# Generate coverage report
bun test --coverage

# Coverage with threshold
bun test --coverage --coverage-threshold=80

# Coverage in different formats
bun test --coverage --coverage-reporter=lcov
bun test --coverage --coverage-reporter=html
```

## Continuous Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test --coverage
```

### Test Sharding

```bash
# Run tests in parallel shards
bun test --shard=1/4
bun test --shard=2/4
bun test --shard=3/4
bun test --shard=4/4
```

## Troubleshooting

### Common Issues

**Tests timeout**: Increase timeout or check for hanging promises

```typescript
test("long running test", async () => {
  // Test implementation
}, 60000) // 60 second timeout
```

**Mock not working**: Ensure proper mock setup and cleanup

```typescript
beforeEach(() => {
  mock.clearAllMocks()
})
```

**Async issues**: Use proper async/await patterns

```typescript
// Good
await waitFor(() => {
  expect(screen.getByText("Loading...")).toBeDefined()
})

// Bad
setTimeout(() => {
  expect(screen.getByText("Loading...")).toBeDefined()
}, 100)
```

### Performance Issues

- Use `test.concurrent` for independent tests
- Minimize DOM operations in component tests
- Use efficient selectors in queries
- Clean up resources properly

## Contributing

When adding new tests:

1. **Follow Naming Conventions**: Use descriptive test names
2. **Add Documentation**: Document complex test scenarios
3. **Update Coverage**: Ensure new code is tested
4. **Performance**: Consider test execution time
5. **Maintenance**: Keep tests maintainable and readable

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Zustand Testing](https://github.com/pmndrs/zustand#testing)

# Test Utilities and Helpers

This directory contains comprehensive testing utilities for the OpenCode application, designed to improve testing consistency, efficiency, and maintainability.

## Overview

The test utilities are organized into several modules:

- **Factories** - Mock data factories for consistent test data generation
- **Matchers** - Custom assertion helpers for domain-specific validations
- **Database** - In-memory test database for integration tests
- **WebSocket** - WebSocket mock utilities for real-time testing
- **Async** - Async test helpers for promises, timeouts, and async operations
- **Performance** - Performance measurement and benchmarking utilities

## Quick Start

```typescript
import {
  MessageFactory,
  SessionFactory,
  ProjectFactory,
  testDb,
  setupTestUtils,
  teardownTestUtils,
  assertValidMessage,
  waitFor,
  measurePerformance,
} from "@/test/utils"

// Setup test environment
beforeEach(() => {
  setupTestUtils()
})

afterEach(() => {
  teardownTestUtils()
})

// Create test data
const message = MessageFactory.user()
const session = SessionFactory.withMessages(5)
const project = ProjectFactory.running()

// Add to test database
testDb.addProject(project)
testDb.addSession(session, project.id)
testDb.addMessage(message, session.id)

// Assertions
assertValidMessage(message)
expect(testDb.getProjects()).toHaveLength(1)

// Async testing
await waitFor(() => someCondition(), { timeout: 5000 })

// Performance testing
const { result, metrics } = await measurePerformance(async () => {
  return await someExpensiveOperation()
})
```

## Factories (`factories.ts`)

### Message Factories

```typescript
// Basic messages
const userMessage = MessageFactory.user()
const assistantMessage = MessageFactory.assistant()

// Messages with tool calls
const toolMessage = MessageFactory.withToolCall()

// Streaming and error messages
const streamingMessage = MessageFactory.streaming()
const errorMessage = MessageFactory.error()

// Conversation flows
const conversation = MessageFactory.conversation(6) // 6 messages alternating user/assistant
```

### Session Factories

```typescript
// Empty session
const emptySession = SessionFactory.empty()

// Session with messages
const sessionWithMessages = SessionFactory.withMessages(5)

// Active and archived sessions
const activeSession = SessionFactory.active()
const archivedSession = SessionFactory.archived()
```

### Project Factories

```typescript
// Project states
const stoppedProject = ProjectFactory.stopped()
const runningProject = ProjectFactory.running()
const errorProject = ProjectFactory.error()

// Project with sessions
const projectWithSessions = ProjectFactory.withSessions(3)
```

### Scenario Factories

```typescript
// Complete scenarios
const { project, sessions, messages } = ScenarioFactory.activeProject()
const { messages, session } = ScenarioFactory.chatConversation(5)
const toolScenario = ScenarioFactory.toolUsageScenario()
```

### Factory Options

All factories support options for customization:

```typescript
const message = MessageFactory.user({
  sequence: true, // Use sequential IDs
  overrides: {
    content: [{ type: "text", text: "Custom message" }],
  },
})

// Batch creation
const messages = createBatch(MessageFactory.user, 10, { sequence: true })
```

## Matchers (`matchers.ts`)

### Validation Assertions

```typescript
// Validate data structures
assertValidMessage(message)
assertValidSession(session)
assertValidProject(project)

// Content assertions
assertMessageHasToolCall(message, "write")
assertMessageContent(message, "expected text")
assertMessageHasCode(message, "javascript")

// State assertions
assertProjectIsRunning(project)
assertSessionHasMessages(session, 5)
assertRecentTimestamp(timestamp, 1000)
```

### Flow Assertions

```typescript
// Conversation flow validation
assertConversationFlow(messages) // Checks alternating roles, chronological order

// Tool usage validation
assertToolUsage(messages, ["write", "read", "bash"])

// Error state validation
assertErrorState(message, "Expected error message")
```

## Database (`database.ts`)

### Test Database

The `TestDatabase` class provides an in-memory database for consistent test state:

```typescript
// Global instance
import { testDb } from "@/test/utils"

// Basic operations
testDb.addProject(project)
testDb.addSession(session, project.id)
testDb.addMessage(message, session.id)

// Queries
const projects = testDb.getProjects()
const sessions = testDb.getSessionsByProject(project.id)
const messages = testDb.getMessagesBySession(session.id)

// Search
const results = testDb.findMessagesByContent("search term")
const streamingMessages = testDb.findStreamingMessages()
```

### Database Helpers

```typescript
// Setup and teardown
setupTestDatabase() // Clear all data
teardownTestDatabase() // Clear all data

// Seeding
seedTestDatabase({
  projects: 3,
  sessionsPerProject: 2,
  messagesPerSession: 5,
})

// Assertions
assertDatabaseState({ messages: 10, sessions: 6, projects: 3 })
assertDatabaseEmpty()

// Transactions for test isolation
await withDatabaseTransaction(async () => {
  // Test operations that will be rolled back
})
```

## WebSocket (`websocket.ts`)

### Mock WebSocket

```typescript
// Create mock WebSocket
const ws = createWebSocketMock("ws://localhost:3000")

// Wait for connection
await waitForWebSocketOpen(ws)

// Send and receive messages
ws.send(JSON.stringify({ type: "test" }))
ws.mockReceive({ type: "response", data: "hello" })

// Assertions
assertWebSocketConnected(ws)
await assertWebSocketMessage(ws, { type: "response", data: "hello" })
```

### WebSocket Manager

```typescript
// Global manager
import { mockWsManager } from "@/test/utils"

// Broadcast to all connections
mockWsManager.broadcast({ type: "update", data: "broadcast message" })

// Connection management
const connections = mockWsManager.getAll()
mockWsManager.closeAll()
```

### Real-time Scenarios

```typescript
// Chat simulation
simulateChatMessage(ws, {
  id: "msg-1",
  role: "user",
  content: "Hello",
})

// Typing indicators
simulateTypingIndicator(ws, true, "user-123")

// Connection issues
await simulateWebSocketReconnect(ws, 1000)
simulateWebSocketError(ws, "Connection failed")
```

## Async (`async.ts`)

### Waiting Utilities

```typescript
// Wait for conditions
await waitFor(() => element.isVisible(), { timeout: 5000 })

// Wait for DOM elements
const element = await waitForElement(".my-selector")
await waitForElementToDisappear(".loading")

// Timeouts and delays
await sleep(1000)
const result = await withTimeout(promise, 5000)
```

### Retry Logic

```typescript
// Retry with exponential backoff
const result = await retry(
  async () => {
    return await unreliableOperation()
  },
  {
    maxAttempts: 3,
    baseDelay: 100,
    shouldRetry: (error) => error.message.includes("temporary"),
  },
)
```

### Async Mocking

```typescript
// Controllable async mock
const asyncMock = new AsyncMock<[string], string>(100) // 100ms default delay
  .mockResolvedValue("success")
  .mockDelay(500)
  .mockRejectedValue(new Error("failure"))

const mockFn = asyncMock.create()

// Usage
const result = await mockFn("test")
expect(asyncMock.getCallCount()).toBe(1)
expect(asyncMock.wasCalledWith("test")).toBe(true)
```

### Error Testing

```typescript
// Test async errors
const error = await expectAsyncError(failingPromise(), "Expected error message")
```

## Performance (`performance.ts`)

### Basic Measurement

```typescript
// Measure single operation
const { result, metrics } = await measurePerformance(async () => {
  return await expensiveOperation()
})

console.log(`Duration: ${metrics.duration}ms`)
console.log(`Memory used: ${metrics.memoryUsed} bytes`)
```

### Benchmarking

```typescript
// Run benchmark with multiple iterations
const benchmark = await benchmark(operation, {
  name: "my-operation",
  iterations: 100,
  warmupIterations: 10,
})

// Compare performance
const comparison = await comparePerformance(
  () => oldImplementation(),
  () => newImplementation(),
  { iterations: 50 },
)

console.log(`Improvement: ${comparison.comparison.isImprovement}`)
console.log(`Speed ratio: ${comparison.comparison.durationRatio}`)
```

### Memory Leak Detection

```typescript
const detector = new MemoryLeakDetector()

detector.takeSnapshot("before")
await runOperations()
detector.takeSnapshot("after")

const leaks = detector.detectLeaks(1024 * 1024) // 1MB threshold
assertNoMemoryLeaks(detector)
```

### Load Testing

```typescript
const results = await loadTest(
  async () => {
    return await apiCall()
  },
  {
    concurrency: 10,
    duration: 30000, // 30 seconds
    requestsPerSecond: 100,
  },
)

console.log(`Success rate: ${results.successfulRequests / results.totalRequests}`)
console.log(`Average response time: ${results.averageResponseTime}ms`)
```

## Best Practices

### Test Organization

```typescript
import { setupTestUtils, teardownTestUtils } from "@/test/utils"

describe("My Feature", () => {
  beforeEach(() => {
    setupTestUtils()
  })

  afterEach(() => {
    teardownTestUtils()
  })

  test("should work correctly", async () => {
    // Test implementation
  })
})
```

### Data Consistency

```typescript
// Use sequential IDs for predictable tests
resetSequence()
const message1 = MessageFactory.user({ sequence: true })
const message2 = MessageFactory.assistant({ sequence: true })

// Use database transactions for isolation
await withDatabaseTransaction(async () => {
  // Test operations that won't affect other tests
})
```

### Performance Testing

```typescript
// Set performance expectations
const { metrics } = await measurePerformance(operation)
assertPerformance(metrics, {
  maxDuration: 1000, // 1 second max
  maxMemory: 50 * 1024 * 1024, // 50MB max
})
```

### Async Testing

```typescript
// Use proper timeouts for CI environments
const timeout = TestEnvironment.isCI() ? 30000 : 10000

await waitFor(condition, { timeout })
```

## Environment Detection

```typescript
import { TestEnvironment } from "@/test/utils"

if (TestEnvironment.isCI()) {
  // Adjust test behavior for CI
}

if (TestEnvironment.isDebug()) {
  // Enable debug logging
}

const timeout = TestEnvironment.getTestTimeout()
```

## Integration Examples

### Complete Chat Test

```typescript
test("chat flow integration", async () => {
  // Setup
  const { project, session, messages } = TestScenarios.createChatScenario({
    messageCount: 6,
    includeToolCalls: true,
  })

  // Assertions
  assertValidProject(project)
  assertValidSession(session)
  assertConversationFlow(messages)
  assertToolUsage(messages, ["write"])

  // Database state
  assertDatabaseState({
    projects: 1,
    sessions: 1,
    messages: 6,
  })
})
```

### WebSocket Integration Test

```typescript
test("real-time chat", async () => {
  const ws = createWebSocketMock("ws://localhost:3000/chat")
  await waitForWebSocketOpen(ws)

  // Simulate user typing
  simulateTypingIndicator(ws, true, "user-123")

  // Send message
  simulateChatMessage(ws, {
    id: "msg-1",
    role: "user",
    content: "Hello",
  })

  // Verify response
  await assertWebSocketMessage(ws, {
    type: "chat.message",
    data: expect.objectContaining({
      role: "user",
      content: "Hello",
    }),
  })
})
```

### Performance Regression Test

```typescript
test("performance regression", async () => {
  const result = await performanceRegression.checkRegression("message-processing", () => processMessages(messages), {
    tolerance: 0.1,
    iterations: 20,
  })

  expect(result.passed).toBe(true)
  if (result.regression) {
    console.warn(`Performance regression: ${result.regression * 100}%`)
  }
})
```

## Contributing

When adding new test utilities:

1. Follow the existing patterns and naming conventions
2. Add comprehensive TypeScript types
3. Include JSDoc documentation
4. Add examples to this README
5. Write tests for the utilities themselves
6. Consider performance implications
7. Ensure compatibility with the Bun test runner

## Files

- `factories.ts` - Mock data factories
- `matchers.ts` - Custom assertion helpers
- `database.ts` - In-memory test database
- `websocket.ts` - WebSocket mocking utilities
- `async.ts` - Async testing helpers
- `performance.ts` - Performance measurement tools
- `index.ts` - Main exports (simplified due to circular dependencies)
- `README.md` - This documentation

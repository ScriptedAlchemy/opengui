# OpenCode Runtime Tests

This directory contains comprehensive tests for the OpenCode runtime system, focusing on reliability, error handling, and edge cases.

## Test Files Overview

### Core Runtime Tests

- **`opencode-runtime.test.ts`** - Basic runtime functionality and event handling
- **`opencode-runtime-comprehensive.test.ts`** - Comprehensive test suite covering all runtime methods and scenarios
- **`opencode-runtime-reconnect.test.ts`** - Connection recovery and retry logic
- **`opencode-runtime-permissions.test.ts`** - Permission request handling
- **`streaming-error-boundary.test.ts`** - Streaming message handling and error boundaries

### Advanced Features

- **`websocket-fallback.test.ts`** - WebSocket fallback mechanisms (future feature)
- **`use-open-code-runtime.test.tsx`** - React hook integration tests

### API and Integration

- **`api-client.test.ts`** - OpenCode API client tests
- **`project-manager-client.test.ts`** - Project management integration
- **`project-routes-api.test.ts`** - API route testing

## Test Coverage Areas

### 1. Runtime Core Functionality ✅

- [x] Initialization and configuration
- [x] Message sending and receiving
- [x] Session management
- [x] State management and subscriptions
- [x] Resource cleanup and disposal

### 2. Streaming and SSE Handling ✅

- [x] Message lifecycle events (start, update, end)
- [x] Rapid message updates without data loss
- [x] Concurrent message handling
- [x] Tool execution streaming
- [x] Large message content handling
- [x] Malformed event handling

### 3. Error Recovery and Reconnection ✅

- [x] Automatic reconnection on connection loss
- [x] Exponential backoff retry logic
- [x] Maximum retry attempt limits
- [x] Stream error isolation
- [x] Graceful degradation

### 4. Permission System ✅

- [x] Permission request handling
- [x] Custom permission handlers
- [x] Default rejection behavior
- [x] Permission handler error isolation

### 5. Message Retry Logic ✅

- [x] Failed message retry with backoff
- [x] Maximum retry limits
- [x] Abort during retry
- [x] Network error handling

### 6. Error Boundaries ✅

- [x] Subscriber error isolation
- [x] Event handler error containment
- [x] Memory leak prevention
- [x] Resource cleanup on errors
- [x] Malformed data handling

### 7. Edge Cases ✅

- [x] Empty message content
- [x] Unknown message part types
- [x] Very long IDs and content
- [x] Rapid concurrent updates
- [x] Resource exhaustion scenarios

### 8. WebSocket Fallback 🚧

- [x] WebSocket connection lifecycle
- [x] Protocol negotiation
- [x] Error recovery
- [x] Message format compatibility
- [ ] Integration with runtime (future feature)

## Running Tests

### Run All Runtime Tests

```bash
bun test test/runtime/
```

### Run Specific Test Suites

```bash
# Core functionality
bun test test/runtime/opencode-runtime-comprehensive.test.ts

# Error handling and streaming
bun test test/runtime/streaming-error-boundary.test.ts

# Connection recovery
bun test test/runtime/opencode-runtime-reconnect.test.ts

# Permission handling
bun test test/runtime/opencode-runtime-permissions.test.ts

# WebSocket fallback
bun test test/runtime/websocket-fallback.test.ts
```

### Run with Coverage

```bash
bun test --coverage test/runtime/
```

## Test Architecture

### Mock Infrastructure

- **SSE Mock** (`../mocks/sse.ts`) - Comprehensive EventSource simulation
- **API Client Mock** (`../mocks/api-client.ts`) - HTTP request mocking
- **Runtime Mock** (`../mocks/runtime.ts`) - Runtime behavior simulation

### Test Patterns

1. **Isolation** - Each test runs in isolation with fresh mocks
2. **Async Handling** - Proper async/await patterns with timing controls
3. **Error Simulation** - Comprehensive error scenario testing
4. **Resource Cleanup** - Proper cleanup in afterEach hooks
5. **Edge Case Coverage** - Testing boundary conditions and unusual inputs

## Key Test Scenarios

### High-Frequency Updates

Tests handle rapid message updates (100+ per second) without data loss or memory leaks.

### Connection Resilience

Tests verify automatic reconnection with exponential backoff when connections drop.

### Error Isolation

Tests ensure that errors in one component don't crash the entire runtime.

### Memory Management

Tests verify proper cleanup of resources, subscribers, and event listeners.

### Permission Security

Tests ensure proper handling of permission requests with secure defaults.

## Performance Considerations

### Test Timing

- Uses `Bun.sleep()` for controlled async timing
- Minimal delays to keep tests fast
- Proper cleanup to prevent test interference

### Memory Usage

- Tests include memory leak detection
- Resource cleanup verification
- Subscriber management testing

### Concurrency

- Tests handle multiple concurrent operations
- Race condition prevention
- Thread-safe state management

## Future Enhancements

### WebSocket Integration

- Complete WebSocket fallback implementation
- Protocol upgrade handling
- Binary message support

### Advanced Error Recovery

- Circuit breaker patterns
- Health check integration
- Adaptive retry strategies

### Performance Monitoring

- Runtime performance metrics
- Memory usage tracking
- Connection quality monitoring

## Debugging Tests

### Common Issues

1. **Timing Issues** - Increase sleep delays if tests are flaky
2. **Mock Cleanup** - Ensure proper mock reset in beforeEach
3. **Resource Leaks** - Check for proper disposal calls
4. **Event Ordering** - Verify event sequence in complex scenarios

### Debug Helpers

```typescript
// Enable debug logging
process.env.NODE_ENV = "development"

// Inspect runtime state
console.log(runtime.state)

// Check mock call history
console.log(mockFunction.mock.calls)
```

## Contributing

When adding new tests:

1. Follow existing patterns and naming conventions
2. Include both happy path and error scenarios
3. Add proper cleanup in afterEach hooks
4. Document complex test scenarios
5. Update this README with new coverage areas

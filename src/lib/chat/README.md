# Chat runtime

OpenCode runtime integration for assistant-ui components

---

## Overview

Connects OpenCode's SDK event subscription to assistant-ui Thread component. Handles real-time messaging, tool calls, and permissions.

---

## Files

**runtime.ts**  
Core OpenCode runtime implementation using SDK

**useOpenCodeRuntime.ts**  
SDK-based hook for runtime lifecycle

**OpenCodeRuntimeProvider.tsx**  
Context provider for runtime configuration

**index.ts**  
Module exports

---

## Features

### SDK event subscription

Real-time event processing with automatic reconnection

### Message transformation

Seamless conversion between OpenCode and assistant-ui formats

### Tool support

Full tool execution with status indicators and progress

### Permission handling

Configurable permission prompts for tool access

### Session management

Multi-session support with automatic creation

### Error recovery

Comprehensive error handling with retry logic

---

## Event types

### Message events

**message.start**  
Assistant message begins

**message.update**  
Content streaming updates

**message.end**  
Message completion

### Tool events

**tool.start**  
Tool execution begins

**tool.update**  
Execution progress updates

**tool.end**  
Tool completion status

### Permission events

**permission.request**  
User authorization required

### Session events

**session.complete**  
Processing finished

**session.error**  
Error occurred

---

## Configuration

### Required options

**projectId**  
OpenCode project identifier

**providerID**  
AI provider selection

**modelID**  
Model selection

### Optional settings

**sessionId**  
Resume existing session

**baseURL**  
Custom SDK endpoint

**onPermissionRequest**  
Permission handler callback

**onError**  
Error handler callback

**maxRetries**  
Retry attempt limit

**retryDelay**  
Retry interval milliseconds

---

## Message format

### Text parts

Plain text content with streaming support

### Tool parts

Tool call indicators with status badges

### File parts

Attachment display with metadata

### Reasoning parts

Internal reasoning with emoji indicators

---

## Tool indicators

**🔄 Pending**  
Queued for execution

**⚙️ Running**  
Currently executing

**✅ Completed**  
Successfully finished

**❌ Error**  
Execution failed

---

## Error handling

### Network errors

Automatic retry with exponential backoff

### Stream errors

Connection monitoring and reconnection

### SDK errors

Error handling and rate limiting

### Recovery strategy

State preservation during reconnection attempts

---

## Performance

### Memory optimization

Efficient message storage and cleanup

### Network efficiency

Connection reuse and request batching

### Type safety

Full TypeScript support with strict typing

---

## Integration

### With Thread component

Direct integration via runtime prop

### With React Query

Session data synchronization

### With Zustand

State management integration

---

## Dependencies

**@assistant-ui/react**  
Chat UI components

**@assistant-ui/react-ai-sdk**  
AI SDK utilities

**@opencode-ai/sdk**  
SDK client accessed via useProjectSDK hook for backend communication

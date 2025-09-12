# Stores

State management with Zustand for OpenCode web UI

---

## Overview

Centralized state management for projects and sessions. Provides optimistic updates, persistence, and error handling.

---

## Project store

Located in `projects.ts`

### State

**projects**  
Array of all available projects

**currentProject**  
Currently selected project instance

**loading**  
Async operation status indicator

**error**  
Current error message if any

**instanceOperations**  
Track ongoing instance operations

### Actions

**Core operations**  
`loadProjects`, `selectProject`, `createProject`, `updateProject`, `removeProject`

**Instance management**  
`startInstance`, `stopInstance`, `refreshInstanceStatus`

**Utilities**  
`clearError`, `refreshAllInstanceStatuses`, `stopAllInstances`

### Features

**Optimistic updates**  
Immediate UI updates with automatic rollback on failure

**Persistence**  
LocalStorage sync for projects and selection

**Error handling**  
Graceful error recovery with user feedback

---

## Session store

Located in `sessions.ts`

### State

**sessions**  
Map of sessions keyed by project ID

**currentSession**  
Active chat session instance

**loading**  
Session operation status

**error**  
Session error messages

### Actions

**Session operations**  
`loadSessions`, `createSession`, `selectSession`, `updateSession`, `deleteSession`

**Utilities**  
`clearSessions`, `clearError`

### Features

**Multi-project support**  
Separate session lists per project

**Session lifecycle**  
Create, load, update, and delete sessions

**State synchronization**  
Automatic sync with backend via SDK

---

## Hook patterns

### Selector hooks

Prevent unnecessary re-renders with focused selectors

**useProjects**  
Get all projects array

**useCurrentProject**  
Get selected project

**useProjectsLoading**  
Get loading state

**useProjectsError**  
Get error message

**useProjectsActions**  
Get all store actions

### Advanced selectors

**useRunningProjects**  
Filter projects with running instances

**useRecentProjects**  
Get recently accessed projects

**useProjectById**  
Find specific project by ID

---

## Performance

### Optimization strategies

**Immer integration**  
Efficient immutable state updates

**Selector memoization**  
Prevent component re-renders

**Batch operations**  
Group multiple updates together

**Concurrent prevention**  
Avoid duplicate SDK calls

---

## Persistence

### Persisted data

Projects list and current selection saved to localStorage

### Non-persisted data

Loading states, errors, and instance operations remain in memory

---

## Error handling

### Error types

**Network errors**  
SDK connection failures

**Validation errors**  
Invalid project data

**Instance errors**  
Start/stop operation failures

### Recovery

Automatic state rollback on failed operations. Clear error action for user dismissal.

---

## Dependencies

**zustand**  
State management library

**immer**  
Immutable update patterns

**@opencode-ai/sdk**  
SDK client accessed via useProjectSDK hook

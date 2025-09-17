# Testing Patterns for Worktree-Aware Routes

This document describes the updated testing patterns for OpenCode's worktree-aware routing system.

## Overview

OpenCode now uses a worktree-aware routing pattern: `/projects/:projectId/:worktreeId/...`. This requires special consideration when writing tests for components that interact with routing.

## Key Changes

### 1. Router-Aware Render Helper

Instead of manually mocking `useNavigate` and `useParams`, use the `renderWithRouter` helper:

```typescript
import { renderWithRouter } from "../utils/test-router"

// Basic usage
const { getByText } = renderWithRouter(<MyComponent />, {
  projectId: "test-project",
  worktreeId: "default"
})

// With custom initial path
const { getByText } = renderWithRouter(<MyComponent />, {
  initialPath: "/projects/test-project/feature/settings"
})
```

### 2. Session Store Mocking

The sessions store now expects worktree-aware signatures:

```typescript
// Mock createSession with worktree path
const mockCreateSession = rstest.fn((projectId: string, worktreePath: string, title: string) => 
  Promise.resolve({ 
    id: "session-1", 
    title, 
    projectID: projectId, 
    directory: worktreePath,
    version: "1",
    time: { created: Date.now() / 1000, updated: Date.now() / 1000 }
  })
)

// Mock the store
rstest.mock("@/stores/sessions", () => ({
  useSessionsStore: () => ({
    createSession: mockCreateSession,
  }),
  useSessionsForProject: () => [],
}))
```

### 3. Worktrees Store Mocking

When mocking the worktrees store, ensure selectors work properly:

```typescript
const mockLoadWorktrees = rstest.fn(() => Promise.resolve())
const mockWorktrees = [
  { id: "default", path: "/project", title: "Main" },
  { id: "feature", path: "/project-feature", title: "Feature Branch" }
]

rstest.mock("@/stores/worktrees", () => ({
  useWorktreesStore: (selector?: any) => {
    const state = {
      loadWorktrees: mockLoadWorktrees,
    }
    return selector ? selector(state) : state
  },
  useWorktreesForProject: () => mockWorktrees,
}))
```

### 4. SDK Context Wrapper

For components that use the SDK context:

```typescript
import { OpencodeSDKProvider } from "@/contexts/OpencodeSDKContext"

const renderWithSDK = (ui: React.ReactElement, routerOptions: any = {}) => {
  return renderWithRouter(
    <OpencodeSDKProvider>{ui}</OpencodeSDKProvider>,
    routerOptions
  )
}
```

## Common Testing Scenarios

### Testing Default Worktree Behavior

```typescript
test("uses default worktree when not specified", async () => {
  const { getByText } = renderWithRouter(<MyComponent />, {
    projectId: "test-project",
    worktreeId: "default"
  })
  
  // Assert component behaves correctly with default worktree
})
```

### Testing Worktree Redirection

```typescript
test("redirects to default worktree when invalid worktree provided", async () => {
  const mockNavigate = rstest.fn()
  rstest.mock("react-router-dom", () => ({
    ...require("react-router-dom"),
    useNavigate: () => mockNavigate,
  }))

  renderWithRouter(<MyComponent />, {
    projectId: "test-project",
    worktreeId: "invalid-worktree"
  })

  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith(
      "/projects/test-project/default/my-page",
      { replace: true }
    )
  })
})
```

### Testing Session Creation with Worktree

```typescript
test("creates session with correct worktree path", async () => {
  const { getByRole } = renderWithRouter(<MyComponent />, {
    projectId: "test-project",
    worktreeId: "feature"
  })

  const createButton = getByRole("button", { name: /create/i })
  fireEvent.click(createButton)

  await waitFor(() => {
    expect(mockCreateSession).toHaveBeenCalledWith(
      "test-project",
      "/project-feature", // Feature worktree path
      expect.any(String)
    )
  })
})
```

## Migration Guide

When updating existing tests:

1. **Replace manual router mocks** with `renderWithRouter`
2. **Update session store mocks** to include worktree path parameter
3. **Add worktree store mocks** for components that need them
4. **Test worktree-specific behavior** including redirects and path handling
5. **Ensure navigation calls** include the worktree segment

## Best Practices

1. **Always specify worktreeId** in test scenarios, even if it's "default"
2. **Mock worktree stores properly** with selector support
3. **Test edge cases** like invalid worktrees and missing worktree paths
4. **Use consistent mock data** across related tests
5. **Avoid brittle useNavigate mocks** - use the router helper instead

## Debugging Tips

- If you see "useNavigate is not a function" errors, ensure you're using `renderWithRouter`
- If you see "loadWorktrees is not a function", check your worktree store mock includes selector support
- Use `initialPath` option to test specific route configurations
- Check that all navigation paths include the worktree segment
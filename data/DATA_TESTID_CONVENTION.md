# Data TestID Naming Convention

This document defines the consistent naming convention for `data-testid` attributes across the OpenCode application to facilitate robust test selector targeting.

## Naming Convention Rules

### 1. Format Structure
```
data-testid="{component-type}-{specific-identifier}-{action?}"
```

### 2. Component Type Prefixes
- `button-` - All button elements
- `input-` - Input fields, textareas, selects
- `dialog-` - Modal dialogs and overlays
- `sidebar-` - Sidebar components and navigation
- `card-` - Card components and containers
- `list-` - Lists and list items
- `form-` - Form containers and form-related elements
- `nav-` - Navigation elements
- `badge-` - Status badges and indicators
- `menu-` - Dropdown menus and context menus
- `tab-` - Tab components
- `toast-` - Toast notifications
- `loading-` - Loading states and spinners

### 3. Specific Identifier Guidelines
- Use kebab-case (lowercase with hyphens)
- Be descriptive but concise
- Include context when necessary (e.g., `project-`, `session-`, `chat-`)
- Use semantic meaning over visual appearance

### 4. Action Suffixes (Optional)
- `-create` - Creation actions
- `-edit` - Edit/modify actions
- `-delete` - Delete/remove actions
- `-save` - Save actions
- `-cancel` - Cancel actions
- `-submit` - Form submission
- `-open` - Open/expand actions
- `-close` - Close/collapse actions
- `-start` - Start/begin actions
- `-stop` - Stop/end actions

## Component-Specific Conventions

### Chat Interface
- `chat-sidebar` - Main chat sidebar container
- `chat-input` - Message input area
- `chat-input-textarea` - Message textarea
- `button-send-message` - Send message button
- `button-attach-file` - File attachment button
- `button-new-session` - New chat session button
- `list-sessions` - Sessions list container
- `session-item-{sessionId}` - Individual session items
- `button-session-edit` - Session edit button
- `button-session-delete` - Session delete button
- `input-session-rename` - Session rename input
- `button-session-rename-confirm` - Confirm rename button
- `button-session-rename-cancel` - Cancel rename button

### Project Management
- `project-dashboard` - Main project dashboard
- `project-item-{projectId}` - Individual project items
- `button-project-open` - Open project button
- `button-project-start` - Start project instance
- `button-project-stop` - Stop project instance
- `badge-project-status` - Project status indicator
- `button-add-project` - Add new project button
- `dialog-add-project` - Add project dialog
- `input-project-name` - Project name input
- `input-project-path` - Project path input
- `button-create-project` - Create project button
- `form-project-creation` - Project creation form

### Navigation & Layout
- `nav-main` - Main navigation
- `sidebar-project` - Project sidebar
- `button-sidebar-toggle` - Sidebar toggle button
- `nav-breadcrumb` - Breadcrumb navigation
- `button-back` - Back navigation button

### UI Components
- `button-primary` - Primary action buttons
- `button-secondary` - Secondary action buttons
- `button-danger` - Destructive action buttons
- `input-search` - Search input fields
- `select-{purpose}` - Select dropdowns
- `dialog-confirm` - Confirmation dialogs
- `toast-success` - Success toast notifications
- `toast-error` - Error toast notifications
- `loading-spinner` - Loading indicators

### Forms
- `form-{formName}` - Form containers
- `input-{fieldName}` - Form input fields
- `button-form-submit` - Form submit buttons
- `button-form-cancel` - Form cancel buttons
- `error-{fieldName}` - Field error messages

## Examples

### Good Examples
```jsx
// Chat interface
<div data-testid="chat-sidebar">
  <button data-testid="button-new-session">New Session</button>
  <div data-testid="list-sessions">
    <div data-testid="session-item-abc123">
      <button data-testid="button-session-edit">Edit</button>
      <button data-testid="button-session-delete">Delete</button>
    </div>
  </div>
</div>

// Project management
<div data-testid="project-dashboard">
  <div data-testid="project-item-xyz789">
    <button data-testid="button-project-open">Open</button>
    <button data-testid="button-project-start">Start</button>
  </div>
</div>

// Forms
<form data-testid="form-project-creation">
  <input data-testid="input-project-name" />
  <input data-testid="input-project-path" />
  <button data-testid="button-form-submit">Create</button>
</form>
```

### Bad Examples
```jsx
// Too generic
<button data-testid="btn">Click me</button>

// Visual-based naming
<button data-testid="red-button">Delete</button>

// Inconsistent casing
<div data-testid="ChatSidebar">...</div>

// Missing context
<button data-testid="edit">Edit Session</button>
```

## Implementation Guidelines

1. **Prioritize Interactive Elements**: Focus on buttons, inputs, links, and other interactive elements first
2. **Container Context**: Add testids to important containers that group related functionality
3. **Dynamic IDs**: For lists and dynamic content, include unique identifiers when possible
4. **Avoid Over-Testing**: Don't add testids to every element; focus on user-facing interactions
5. **Consistency**: Follow the convention consistently across all components
6. **Documentation**: Update this document when adding new patterns or component types

## Testing Benefits

- **Reliability**: Semantic selectors are more stable than CSS class-based selectors
- **Readability**: Clear naming makes tests self-documenting
- **Maintainability**: Consistent patterns make test updates easier
- **Performance**: Direct attribute selectors are faster than complex CSS selectors
- **Isolation**: Tests are isolated from styling changes
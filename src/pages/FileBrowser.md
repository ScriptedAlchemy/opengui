# FileBrowser Component

A comprehensive file browser component that integrates with the sandbox component for code editing, providing a VS Code-like experience for browsing and editing project files.

## Features

### Left Panel - File Tree Navigation

- **Hierarchical file tree** with folder expand/collapse functionality
- **File type icons** based on file extensions using Lucide React icons
- **Right-click context menu** for file operations (new file, rename, delete)
- **Search functionality** to filter files by name
- **Loading states** for directory expansion
- **Selected file highlighting**

### Right Panel - Code Editor

- **Sandbox integration** using SandboxCodeEditor for syntax highlighting
- **Multiple tabs** for open files with close buttons
- **Unsaved changes indicators** (yellow dot on tabs)
- **Full-screen mode** toggle
- **Breadcrumb navigation** showing current file path
- **Language detection** based on file extensions

### File Operations

- **File selection** and opening in editor tabs
- **Directory expansion** with lazy loading
- **Context menu actions** (create, rename, delete)
- **File content loading** via SDK API methods
- **Save functionality** (placeholder for API integration)

## Component Structure

```tsx
interface FileTreeNode extends FileNode {
  children?: FileTreeNode[]
  isExpanded?: boolean
  isLoading?: boolean
}

interface OpenFile {
  path: string
  name: string
  content: string
  isDirty: boolean
  language: string
}
```

## Key Components

### FileTreeItem

Recursive component for rendering the file tree with:

- Expand/collapse buttons for directories
- File type icons
- Context menu support
- Selection highlighting

### Breadcrumb

Navigation component showing the current file path with clickable segments.

### SandboxCodeEditor Integration

Uses the sandbox component system for:

- Syntax highlighting
- Multiple file tabs
- Code editing capabilities

## API Integration

Uses the OpenCode SDK through the `useProjectSDK` hook:

```tsx
const sdk = useProjectSDK(projectId)

// File operations
await sdk.files.list({ path }) // Load directory contents
await sdk.files.read({ path }) // Load file content
await sdk.files.create({ path, content }) // Create new file with content
await sdk.files.rename({ oldPath, newPath }) // Rename or move file
await sdk.files.delete({ path }) // Delete file or directory
```

## Styling

Follows the dark theme design system:

- Background: `#0a0a0a`
- Sidebar: `#111111`
- Borders: `#262626`
- Accent: `#3b82f6`
- Text colors: white, gray variants

## Usage

```tsx
import FileBrowser from "@/pages/FileBrowser"

// Used in routing with projectId parameter
;<Route path="/project/:projectId/files" element={<FileBrowser />} />
```

## Dependencies

- React Router (`useParams` for projectId)
- `useProjectSDK` hook for SDK client access
- `OpencodeSDKContext` for SDK provider
- Sandbox components for code editing
- Lucide React for icons
- shadcn/ui components (Button, Input, Dialog, etc.)

## File Type Support

Supports syntax highlighting and appropriate icons for:

- JavaScript/TypeScript (js, jsx, ts, tsx)
- Python (py)
- Java (java)
- C/C++ (c, cpp, cc, cxx)
- C# (cs)
- PHP (php)
- Ruby (rb)
- Go (go)
- Rust (rs)
- Swift (swift)
- Kotlin (kt)
- HTML/CSS (html, css, scss, sass)
- JSON/XML/YAML
- Markdown (md)
- Shell scripts (sh, bash)
- And more...

## Future Enhancements

1. **File Operations API Integration**

   - Implement actual file create/rename/delete via API
   - File save functionality
   - File upload/download

2. **Advanced Features**

   - File search across content (not just names)
   - Git integration (file status indicators)
   - File preview for images/media
   - Drag and drop file operations
   - Keyboard shortcuts

3. **Performance Optimizations**

   - Virtual scrolling for large file trees
   - File content caching
   - Lazy loading of file tree nodes

4. **User Experience**
   - File tree state persistence
   - Recent files list
   - Bookmarks/favorites
   - Split view editing

## Error Handling

- Loading states for async operations
- Error boundaries for component failures
- Graceful fallbacks for API failures
- User feedback for file operations

The FileBrowser component provides a solid foundation for file management and code editing within the OpenCode web interface, with room for future enhancements and optimizations.

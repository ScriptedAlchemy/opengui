import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "react-router-dom"
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Search,
  Plus,
  X,
  Maximize2,
  Minimize2,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileArchive,
  Loader2,
  AlertCircle,
  Home,
  Save,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useProjectSDK } from "@/contexts/OpencodeSDKContext"
import { useCurrentProject } from "@/stores/projects"
import {
  SandboxProvider,
  SandboxLayout,
  SandboxCodeEditor,
  SandboxTabs,
  SandboxTabsList,
  SandboxTabsTrigger,
  SandboxTabsContent,
} from "@/components/ui/shadcn-io/sandbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  size?: number
  modified?: string
}

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

interface BreadcrumbItem {
  name: string
  path: string
}

const getFileIcon = (name: string, type: "file" | "directory", isOpen = false) => {
  if (type === "directory") {
    return isOpen ? FolderOpen : Folder
  }

  const ext = name.split(".").pop()?.toLowerCase()

  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "py":
    case "java":
    case "cpp":
    case "c":
    case "cs":
    case "php":
    case "rb":
    case "go":
    case "rs":
    case "swift":
    case "kt":
      return FileCode
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return FileImage
    case "mp4":
    case "avi":
    case "mov":
    case "wmv":
    case "flv":
      return FileVideo
    case "zip":
    case "rar":
    case "tar":
    case "gz":
    case "7z":
      return FileArchive
    case "md":
    case "txt":
    case "json":
    case "xml":
    case "yaml":
    case "yml":
      return FileText
    default:
      return File
  }
}

const getLanguageFromPath = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase()

  switch (ext) {
    case "js":
    case "jsx":
      return "javascript"
    case "ts":
    case "tsx":
      return "typescript"
    case "py":
      return "python"
    case "java":
      return "java"
    case "cpp":
    case "cc":
    case "cxx":
      return "cpp"
    case "c":
      return "c"
    case "cs":
      return "csharp"
    case "php":
      return "php"
    case "rb":
      return "ruby"
    case "go":
      return "go"
    case "rs":
      return "rust"
    case "swift":
      return "swift"
    case "kt":
      return "kotlin"
    case "html":
      return "html"
    case "css":
      return "css"
    case "scss":
    case "sass":
      return "scss"
    case "json":
      return "json"
    case "xml":
      return "xml"
    case "yaml":
    case "yml":
      return "yaml"
    case "md":
      return "markdown"
    case "sql":
      return "sql"
    case "sh":
    case "bash":
      return "bash"
    default:
      return "plaintext"
  }
}

const buildFileTree = (files: FileNode[]): FileTreeNode[] => {
  const tree: FileTreeNode[] = []
  const pathMap = new Map<string, FileTreeNode>()

  // Sort files: directories first, then by name
  const sortedFiles = [...files].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1
    }
    // Handle undefined names
    const nameA = a.name || ""
    const nameB = b.name || ""
    return nameA.localeCompare(nameB)
  })

  for (const file of sortedFiles) {
    const node: FileTreeNode = {
      ...file,
      children: file.type === "directory" ? [] : undefined,
      isExpanded: false,
      isLoading: false,
    }

    pathMap.set(file.path, node)

    const parentPath = file.path.split("/").slice(0, -1).join("/")
    const parent = pathMap.get(parentPath)

    if (parent && parent.children) {
      parent.children.push(node)
    } else {
      tree.push(node)
    }
  }

  return tree
}

const FileTreeItem: React.FC<{
  node: FileTreeNode
  level: number
  onSelect: (node: FileTreeNode) => void
  onToggle: (node: FileTreeNode) => void
  onContextMenu: (node: FileTreeNode, event: React.MouseEvent) => void
  selectedPath?: string
}> = ({ node, level, onSelect, onToggle, onContextMenu, selectedPath }) => {
  const Icon = getFileIcon(node.name, node.type, node.isExpanded)
  const isSelected = selectedPath === node.path

  return (
    <div>
      <div
        data-testid={node.type === "directory" ? "folder-item" : "file-item"}
        className={cn(
          "flex cursor-pointer items-center gap-1 px-2 py-1 text-sm transition-colors hover:bg-accent/30",
          isSelected && "bg-accent/20 text-accent",
          "group"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(node)}
        onContextMenu={(e) => onContextMenu(node, e)}
      >
        {node.type === "directory" && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node)
            }}
            aria-label={node.isExpanded ? "Collapse folder" : "Expand folder"}
            className="rounded p-0.5 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {node.isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : node.isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </div>
      {node.isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const Breadcrumb: React.FC<{
  items: BreadcrumbItem[]
  onNavigate: (path: string) => void
}> = ({ items, onNavigate }) => (
  <div data-testid="breadcrumb-navigation" className="border-border flex items-center gap-1 border-b px-4 py-2 text-sm">
    <Home className="h-4 w-4" />
    {items.map((item) => (
      <React.Fragment key={item.path}>
        <ChevronRight className="text-muted-foreground h-3 w-3" />
        <button
          onClick={() => onNavigate(item.path)}
          className="hover:text-accent transition-colors"
        >
          {item.name}
        </button>
      </React.Fragment>
    ))}
  </div>
)

export default function FileBrowser() {
  const { projectId } = useParams<{ projectId: string }>()
  const currentProject = useCurrentProject()
  const { client } = useProjectSDK(projectId, currentProject?.path)

  // File tree state
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string>()
  const [searchQuery, setSearchQuery] = useState("")

  // Editor state
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeTab, setActiveTab] = useState<string>()
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    node: FileTreeNode
    x: number
    y: number
  } | null>(null)

  // Dialog state
  const [showNewFileDialog, setShowNewFileDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [targetNode, setTargetNode] = useState<FileTreeNode | null>(null)

  // Resolve project path from store or API
  const [resolvedPath, setResolvedPath] = useState<string | undefined>(currentProject?.path)
  useEffect(() => {
    if (currentProject?.path) setResolvedPath(currentProject.path)
  }, [currentProject?.path])
  useEffect(() => {
    if (resolvedPath || !projectId) return
    ;(async () => {
      try {
        const res = await fetch('/api/projects')
        if (!res.ok) return
        const list = await res.json()
        const p = Array.isArray(list) ? list.find((x: any) => x.id === projectId) : null
        if (p?.path) setResolvedPath(p.path)
      } catch {}
    })()
  }, [projectId, resolvedPath])

  // Load initial file tree
  useEffect(() => {
    if (!client || !resolvedPath) return

    const loadFiles = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await client.file.list({
          query: {
            path: "",
            directory: resolvedPath,
          },
        })
        const data = response.data as any
        const files: FileNode[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.files)
            ? data.files
            : Array.isArray(data?.entries)
              ? data.entries
              : []
        if (!Array.isArray(files)) {
          throw new Error("Invalid file list response")
        }
        const tree = buildFileTree(files)
        setFileTree(tree)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load files")
      } finally {
        setIsLoading(false)
      }
    }

    loadFiles()
  }, [client, resolvedPath])

  // Load directory contents
  const loadDirectory = useCallback(
    async (node: FileTreeNode) => {
      if (node.type !== "directory" || node.isLoading || !client || !resolvedPath) return

      try {
        setFileTree((prev) => updateNodeInTree(prev, node.path, { isLoading: true }))

        const response = await client.file.list({
          query: {
            path: node.path,
            directory: resolvedPath,
          },
        })
        const data = response.data as any
        const files: FileNode[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.files)
            ? data.files
            : Array.isArray(data?.entries)
              ? data.entries
              : []
        if (!Array.isArray(files)) {
          throw new Error("Invalid file list response")
        }
        const children = buildFileTree(files)

        setFileTree((prev) =>
          updateNodeInTree(prev, node.path, {
            children,
            isExpanded: true,
            isLoading: false,
          })
        )
      } catch (_err) {
        setFileTree((prev) => updateNodeInTree(prev, node.path, { isLoading: false }))
      }
    },
    [client, resolvedPath]
  )

  // Update node in tree
  const updateNodeInTree = (
    tree: FileTreeNode[],
    path: string,
    updates: Partial<FileTreeNode>
  ): FileTreeNode[] => {
    return tree.map((node) => {
      if (node.path === path) {
        return { ...node, ...updates }
      }
      if (node.children) {
        return {
          ...node,
          children: updateNodeInTree(node.children, path, updates),
        }
      }
      return node
    })
  }

  // Handle file selection
  const handleFileSelect = useCallback(
    async (node: FileTreeNode) => {
      if (node.type === "directory") {
        if (node.isExpanded) {
          setFileTree((prev) => updateNodeInTree(prev, node.path, { isExpanded: false }))
        } else {
          await loadDirectory(node)
        }
      } else {
        setSelectedPath(node.path)

        // Check if file is already open
        const existingFile = openFiles.find((f) => f.path === node.path)
        if (existingFile) {
          setActiveTab(node.path)
          return
        }

        // Load file content
        try {
          if (!client) return
          const response = await client.file.read({
            query: {
              path: node.path,
              directory: resolvedPath,
            },
          })
          const content = response.data?.content || ""
          const newFile: OpenFile = {
            path: node.path,
            name: node.name,
            content,
            isDirty: false,
            language: getLanguageFromPath(node.path),
          }

          setOpenFiles((prev) => [...prev, newFile])
          setActiveTab(node.path)
        } catch (_err) {
          // Silent fail - error already handled in UI
        }
      }
    },
    [loadDirectory, openFiles, client, resolvedPath]
  )

  // Handle directory toggle
  const handleToggle = useCallback(
    async (node: FileTreeNode) => {
      if (node.type !== "directory") return

      if (node.isExpanded) {
        setFileTree((prev) => updateNodeInTree(prev, node.path, { isExpanded: false }))
      } else {
        await loadDirectory(node)
      }
    },
    [loadDirectory]
  )

  // Handle context menu
  const handleContextMenu = useCallback((node: FileTreeNode, event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({
      node,
      x: event.clientX,
      y: event.clientY,
    })
  }, [])

  // Close context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [])

  // Handle file operations
  const handleNewFile = useCallback(async () => {
    if (!targetNode || !newFileName.trim() || !client) return

    try {
      const filePath =
        targetNode.type === "directory"
          ? `${targetNode.path}/${newFileName}`
          : `${targetNode.path.split("/").slice(0, -1).join("/")}/${newFileName}`

      // Create a session and use prompt to create the file
      const session = await client.session.create()
      if (!session.data) throw new Error("Failed to create session")
      await client.session.prompt({
        path: { id: session.data.id },
        body: {
          parts: [
            {
              type: "text",
              text: `Create a new empty file at ${filePath}`,
            },
          ],
        },
        query: { directory: currentProject?.path },
      })

      // Refresh the file tree
      const refreshPath =
        targetNode.type === "directory"
          ? targetNode.path
          : targetNode.path.split("/").slice(0, -1).join("/")
      const response = await client.file.list({
        query: {
          path: refreshPath || "",
          directory: currentProject?.path,
        },
      })
      const data = response.data as any
      const files: FileNode[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.files)
          ? data.files
          : Array.isArray(data?.entries)
            ? data.entries
            : []
      if (!Array.isArray(files)) {
        throw new Error("Invalid file list response")
      }
      const newTree = buildFileTree(files)

      if (refreshPath === "") {
        setFileTree(newTree)
      } else {
        // Update specific directory in tree
        setFileTree((prev) =>
          updateNodeInTree(prev, refreshPath, { children: newTree, isExpanded: true })
        )
      }
    } catch (err) {
      setError(`Failed to create file: ${err instanceof Error ? err.message : err}`)
    } finally {
      setShowNewFileDialog(false)
      setNewFileName("")
      setTargetNode(null)
    }
  }, [targetNode, newFileName, client, currentProject?.path])

  const handleRename = useCallback(async () => {
    if (!targetNode || !newFileName.trim() || !client) return

    try {
      const oldPath = targetNode.path
      const newPath = targetNode.path.split("/").slice(0, -1).concat(newFileName).join("/")

      // Create a session and use prompt to rename the file
      const session = await client.session.create()
      if (!session.data) throw new Error("Failed to create session")
      await client.session.prompt({
        path: { id: session.data.id },
        body: {
          parts: [
            {
              type: "text",
              text: `Rename file from ${oldPath} to ${newPath}`,
            },
          ],
        },
        query: { directory: currentProject?.path },
      })

      // Refresh the file tree
      const parentPath = targetNode.path.split("/").slice(0, -1).join("/")
      const response = await client.file.list({
        query: {
          path: parentPath || "",
          directory: currentProject?.path,
        },
      })
      const data = response.data as any
      const files: FileNode[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.files)
          ? data.files
          : Array.isArray(data?.entries)
            ? data.entries
            : []
      if (!Array.isArray(files)) {
        throw new Error("Invalid file list response")
      }
      const newTree = buildFileTree(files)

      if (parentPath === "") {
        setFileTree(newTree)
      } else {
        setFileTree((prev) =>
          updateNodeInTree(prev, parentPath, { children: newTree, isExpanded: true })
        )
      }

      // Update open files if the renamed file is open
      setOpenFiles((prev) =>
        prev.map((file) =>
          file.path === oldPath ? { ...file, path: newPath, name: newFileName } : file
        )
      )

      if (activeTab === oldPath) {
        setActiveTab(newPath)
      }
    } catch (err) {
      setError(`Failed to rename file: ${err instanceof Error ? err.message : err}`)
    } finally {
      setShowRenameDialog(false)
      setNewFileName("")
      setTargetNode(null)
    }
  }, [targetNode, newFileName, client, activeTab, currentProject?.path])

  const handleDelete = useCallback(
    async (node: FileTreeNode) => {
      if (!client || !resolvedPath || !confirm(`Are you sure you want to delete ${node.name}?`)) return

      try {
        // Create a session and use prompt to delete the file
        const session = await client.session.create()
        if (!session.data) throw new Error("Failed to create session")
        await client.session.prompt({
          path: { id: session.data.id },
          body: {
            parts: [
              {
                type: "text",
                text: `Delete the file at ${node.path}`,
              },
            ],
          },
          query: { directory: resolvedPath },
        })

        // Close the file if it's open
        setOpenFiles((prev) => prev.filter((f) => f.path !== node.path))
        if (activeTab === node.path) {
          const remainingFiles = openFiles.filter((f) => f.path !== node.path)
          setActiveTab(remainingFiles.length > 0 ? remainingFiles[0].path : undefined)
        }

        // Refresh the file tree
        const parentPath = node.path.split("/").slice(0, -1).join("/")
        const response = await client.file.list({
          query: {
            path: parentPath || "",
            directory: resolvedPath,
          },
        })
        const data = response.data as any
        const files: FileNode[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.files)
            ? data.files
            : Array.isArray(data?.entries)
              ? data.entries
              : []
        if (!Array.isArray(files)) {
          throw new Error("Invalid file list response")
        }
        const newTree = buildFileTree(files)

        if (parentPath === "") {
          setFileTree(newTree)
        } else {
          setFileTree((prev) =>
            updateNodeInTree(prev, parentPath, { children: newTree, isExpanded: true })
          )
        }
      } catch (err) {
        setError(`Failed to delete file: ${err instanceof Error ? err.message : err}`)
      }
    },
    [activeTab, openFiles, client, resolvedPath]
  )

  // Save all dirty files
  const handleSaveAll = useCallback(async () => {
    const dirtyFiles = openFiles.filter((f) => f.isDirty)
    if (dirtyFiles.length === 0 || !client || !resolvedPath) return

    try {
      // Create a session and save all files
      const session = await client.session.create()
      if (!session.data) throw new Error("Failed to create session")
      await Promise.all(
        dirtyFiles.map((file) =>
          client.session.prompt({
            path: { id: session.data.id },
            body: {
              parts: [
                {
                  type: "text",
                  text: `Write the following content to ${file.path}:\n\n${file.content}`,
                },
              ],
            },
            query: { directory: resolvedPath },
          })
        )
      )
      setOpenFiles((prev) => prev.map((f) => ({ ...f, isDirty: false })))
    } catch (err) {
      setError(`Failed to save files: ${err instanceof Error ? err.message : err}`)
    }
  }, [openFiles, client, currentProject?.path])
  const handleTabClose = useCallback(
    (path: string) => {
      setOpenFiles((prev) => prev.filter((f) => f.path !== path))
      if (activeTab === path) {
        const remainingFiles = openFiles.filter((f) => f.path !== path)
        setActiveTab(remainingFiles.length > 0 ? remainingFiles[0].path : undefined)
      }
    },
    [openFiles, activeTab]
  )

  // Filter files based on search
  const filteredTree = useMemo(() => {
    if (!searchQuery) return fileTree

    const filterTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.reduce<FileTreeNode[]>((acc, node) => {
        const matches = node.name.toLowerCase().includes(searchQuery.toLowerCase())
        const filteredChildren = node.children ? filterTree(node.children) : undefined

        if (matches || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({
            ...node,
            children: filteredChildren,
            isExpanded: filteredChildren && filteredChildren.length > 0,
          })
        }

        return acc
      }, [])
    }

    return filterTree(fileTree)
  }, [fileTree, searchQuery])

  // Generate breadcrumb items
  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    if (!selectedPath) return []

    const parts = selectedPath.split("/").filter(Boolean)
    const items: BreadcrumbItem[] = []

    for (let i = 0; i < parts.length; i++) {
      const path = parts.slice(0, i + 1).join("/")
      items.push({
        name: parts[i],
        path,
      })
    }

    return items
  }, [selectedPath])

  // Prepare sandbox files for code editor
  const sandboxFiles = useMemo(() => {
    const files: Record<string, string> = {}

    openFiles.forEach((file) => {
      files[file.path] = file.content
    })

    return files
  }, [openFiles])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="mb-2 text-xl font-semibold">Failed to load files</h2>
          <p className="mb-4 text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="file-browser-page"
      className={cn("flex h-full bg-background text-foreground", isFullscreen && "fixed inset-0 z-50")}
    >
      {/* Left Panel - File Tree */}
      <div className="flex w-80 flex-col border-r border-border bg-card">
        {/* Search */}
        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              data-testid="file-search-input"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-input bg-background pl-10 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* File Tree */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div data-testid="file-tree" className="py-2">
              {filteredTree.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  level={0}
                  onSelect={handleFileSelect}
                  onToggle={handleToggle}
                  onContextMenu={handleContextMenu}
                  selectedPath={selectedPath}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Code Editor */}
      <div className="flex flex-1 flex-col">
        {/* Breadcrumb */}
        {breadcrumbItems.length > 0 && (
          <Breadcrumb
            items={breadcrumbItems}
            onNavigate={(path) => {
              // Navigate to the selected path in the breadcrumb
              const fileAtPath = openFiles.find((f) => f.path === path)
              if (fileAtPath) {
                // If it's an open file, switch to that tab
                setActiveTab(path)
              }
              // TODO: Implement directory navigation in breadcrumb
            }}
          />
        )}

        {/* Editor Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Code Editor</h2>
            {openFiles.some((f) => f.isDirty) && (
              <span className="text-xs text-yellow-500">• Unsaved changes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {openFiles.some((f) => f.isDirty) && (
              <Button
                data-testid="save-button"
                variant="ghost"
                size="sm"
                onClick={handleSaveAll}
                className="text-green-400 hover:text-green-300"
              >
                <Save className="mr-1 h-4 w-4" />
                Save All
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1">
          {openFiles.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-medium">No files open</h3>
                <p className="text-muted-foreground">Select a file from the tree to start editing</p>
              </div>
            </div>
          ) : (
            <SandboxProvider
              files={sandboxFiles}
              template="vanilla"
              options={{
                visibleFiles: openFiles.map((f) => f.path),
                activeFile: activeTab,
              }}
            >
              <SandboxTabs value={activeTab} onValueChange={setActiveTab}>
                <SandboxTabsList>
                  {openFiles.map((file) => (
                    <SandboxTabsTrigger key={file.path} value={file.path}>
                      <div className="flex items-center gap-2">
                        {React.createElement(getFileIcon(file.name, "file"), {
                          className: "w-4 h-4",
                        })}
                        <span>{file.name}</span>
                        {file.isDirty && <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTabClose(file.path)
                          }}
                          aria-label="Close tab"
                          className="ml-1 rounded p-0.5 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </SandboxTabsTrigger>
                  ))}
                </SandboxTabsList>

                {openFiles.map((file) => (
                  <SandboxTabsContent key={file.path} value={file.path}>
                    <SandboxLayout>
                      <div data-testid="file-editor">
                        <div data-testid="file-content">
                          <SandboxCodeEditor
                          data-testid="file-editor-inner"
                          showTabs={false}
                          showLineNumbers
                          showInlineErrors
                          wrapContent
                          closableTabs
                          initMode="lazy"
                          />
                        </div>
                      </div>
                    </SandboxLayout>
                  </SandboxTabsContent>
                ))}
              </SandboxTabs>
            </SandboxProvider>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            onClick={() => {
              setTargetNode(contextMenu.node)
              setShowNewFileDialog(true)
              setContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-white/5"
          >
            <Plus className="h-4 w-4" />
            New File
          </button>
          <button
            onClick={() => {
              setTargetNode(contextMenu.node)
              setNewFileName(contextMenu.node.name)
              setShowRenameDialog(true)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-white/5"
          >
            Rename
          </button>
          <button
            onClick={() => {
              handleDelete(contextMenu.node)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-white/5"
          >
            Delete
          </button>
        </div>
      )}

      {/* New File Dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent className="border-border bg-background">
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter file name..."
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="border-input bg-background"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowNewFileDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleNewFile}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="border-border bg-background">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter new name..."
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="border-input bg-background"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowRenameDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleRename}>Rename</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

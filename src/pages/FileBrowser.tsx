import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  ChevronRight,
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
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useProjectSDK } from "@/contexts/OpencodeSDKContext"
import { useCurrentProject } from "@/stores/projects"
import { useWorktreesStore, useWorktreesForProject } from "@/stores/worktrees"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { MonacoEditor } from "@/components/code/MonacoEditor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileExplorer, type FileTreeNode as ExplorerNode } from "@/components/code/FileExplorer"
import type { OpencodeClient } from "@opencode-ai/sdk/client"
import { Checkbox } from "@/components/ui/checkbox"
import { useSessionsStore } from "../stores/sessions"

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

type FileApi = NonNullable<OpencodeClient["file"]>
type FileApiWithExtensions = FileApi & {
  write?: (options: {
    body: { path: string; content: string }
    query: { directory: string }
  }) => Promise<unknown>
  rename?: (options: {
    body: { oldPath: string; newPath: string }
    query: { directory: string }
  }) => Promise<unknown>
  delete?: (options: { query: { path: string; directory: string } }) => Promise<unknown>
}

type FileListQuery = {
  path: string
  directory?: string
  showHidden?: boolean
}

const mapToFileNode = (entry: unknown): FileNode | null => {
  if (!entry || typeof entry !== "object") {
    return null
  }

  const candidate = entry as {
    name?: unknown
    path?: unknown
    type?: unknown
    size?: unknown
    modified?: unknown
  }

  const name = typeof candidate.name === "string" ? candidate.name : undefined
  const path = typeof candidate.path === "string" ? candidate.path : undefined
  const type =
    candidate.type === "file" || candidate.type === "directory"
      ? (candidate.type as "file" | "directory")
      : undefined

  if (!name || !path || !type) {
    return null
  }

  const node: FileNode = {
    name,
    path,
    type,
  }

  if (typeof candidate.size === "number") {
    node.size = candidate.size
  }

  if (typeof candidate.modified === "string") {
    node.modified = candidate.modified
  }

  return node
}

const normalizeFileList = (payload: unknown): FileNode[] => {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => mapToFileNode(item))
      .filter((item): item is FileNode => item !== null)
  }

  if (payload && typeof payload === "object") {
    const collection = payload as { files?: unknown; entries?: unknown }
    if (collection.files) {
      return normalizeFileList(collection.files)
    }
    if (collection.entries) {
      return normalizeFileList(collection.entries)
    }
  }

  return []
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
      // Process directories first to ensure parent directories exist in pathMap
      // before their children are processed
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

const Breadcrumb: React.FC<{
  items: BreadcrumbItem[]
  onNavigate: (path: string) => void
}> = ({ items, onNavigate }) => (
  <div
    data-testid="breadcrumb-navigation"
    data-ui="breadcrumb"
    className="border-border flex items-center gap-1 border-b px-4 py-2 text-sm"
  >
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
  const { projectId, worktreeId } = useParams<{ projectId: string; worktreeId: string }>()
  const navigate = useNavigate()
  const currentProject = useCurrentProject()
  const loadWorktrees = useWorktreesStore((state) => state.loadWorktrees)
  const worktrees = useWorktreesForProject(projectId || "")
  const activeWorktreeId = worktreeId || "default"

  // File tree state
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string>()
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [showHidden, setShowHidden] = useState(false)

  // Editor state
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeTab, setActiveTab] = useState<string>()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isAskAiLoading, setIsAskAiLoading] = useState(false)

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

  const createSession = useSessionsStore((state) => state.createSession)

  // Resolve project path from store or API
  const [resolvedPath, setResolvedPath] = useState<string | undefined>(currentProject?.path)

  useEffect(() => {
    if (projectId) {
      void loadWorktrees(projectId)
    }
  }, [projectId, loadWorktrees])

  useEffect(() => {
    if (currentProject?.path && activeWorktreeId === "default") {
      setResolvedPath(currentProject.path)
    }
  }, [currentProject?.path, activeWorktreeId])

  useEffect(() => {
    if (!projectId) return
    if (activeWorktreeId === "default") {
      if (currentProject?.path) {
        setResolvedPath(currentProject.path)
      }
      return
    }

    const target = worktrees.find((worktree) => worktree.id === activeWorktreeId)
    if (target?.path) {
      setResolvedPath(target.path)
    } else if (worktrees.length > 0 && activeWorktreeId !== "default") {
      // Invalid worktree, redirect to default file view
      setResolvedPath(currentProject?.path)
      navigate(`/projects/${projectId}/default/files`, { replace: true })
    }
  }, [projectId, activeWorktreeId, worktrees, currentProject?.path, navigate])

  const { client } = useProjectSDK(projectId, resolvedPath)
  const activeFile = useMemo(
    () => openFiles.find((file) => file.path === activeTab) ?? null,
    [openFiles, activeTab]
  )
  const makeListQuery = useCallback(
    (path: string): FileListQuery => ({
      path,
      directory: resolvedPath,
      showHidden,
    }),
    [resolvedPath, showHidden]
  )

  // Load initial file tree
  useEffect(() => {
    if (!client || !resolvedPath) return

    const loadFiles = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await client.file.list({
          query: makeListQuery(""),
        })
        const tree = buildFileTree(normalizeFileList(response.data))
        setFileTree(tree)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load files")
      } finally {
        setIsLoading(false)
      }
    }

    loadFiles()
  }, [client, resolvedPath, showHidden, makeListQuery])

  const updateNodeInTree = useCallback(
    (tree: FileTreeNode[], path: string, updates: Partial<FileTreeNode>): FileTreeNode[] => {
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
    },
    []
  )

  // Load directory contents
  const loadDirectory = useCallback(
    async (node: FileTreeNode) => {
      if (node.type !== "directory" || node.isLoading || !client || !resolvedPath) return
      if (node.isExpanded && node.children && node.children.length > 0) return

      try {
        setFileTree((prev) => updateNodeInTree(prev, node.path, { isLoading: true }))

        const response = await client.file.list({
          query: makeListQuery(node.path),
        })
        const children = buildFileTree(normalizeFileList(response.data))

        setFileTree((prev) =>
          updateNodeInTree(prev, node.path, {
            children,
            isExpanded: true,
            isLoading: false,
          })
        )
      } catch (error) {
        console.error("Failed to load directory:", error)
        setFileTree((prev) => updateNodeInTree(prev, node.path, { isLoading: false }))
      }
    },
    [client, resolvedPath, updateNodeInTree, makeListQuery]
  )

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
        } catch (error) {
          console.error("Failed to load file content:", error)
          // Silent fail - error already handled in UI
        }
      }
    },
    [loadDirectory, openFiles, client, resolvedPath, updateNodeInTree]
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
    [loadDirectory, updateNodeInTree]
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

  // Direct file operations with fallback to session prompts
  const performWrite = useCallback(
    async (path: string, content: string) => {
      if (!client || !resolvedPath) return
      const fileApi = client.file as FileApiWithExtensions
      if (fileApi?.write) {
        await fileApi.write({ body: { path, content }, query: { directory: resolvedPath } })
        return
      }
      const session = await client.session.create()
      if (!session.data) throw new Error("Failed to create session")
      await client.session.prompt({
        path: { id: session.data.id },
        body: {
          parts: [
            { type: "text", text: `Write file ${path} with the following content:\n\n${content}` },
          ],
        },
        query: { directory: resolvedPath },
      })
    },
    [client, resolvedPath]
  )

  const performRename = useCallback(
    async (oldPath: string, newPath: string) => {
      if (!client || !resolvedPath) return
      const fileApi = client.file as FileApiWithExtensions
      if (fileApi?.rename) {
        await fileApi.rename({ body: { oldPath, newPath }, query: { directory: resolvedPath } })
        return
      }
      const session = await client.session.create()
      if (!session.data) throw new Error("Failed to create session")
      await client.session.prompt({
        path: { id: session.data.id },
        body: { parts: [{ type: "text", text: `Rename file from ${oldPath} to ${newPath}` }] },
        query: { directory: resolvedPath },
      })
    },
    [client, resolvedPath]
  )

  const performDelete = useCallback(
    async (path: string) => {
      if (!client || !resolvedPath) return
      const fileApi = client.file as FileApiWithExtensions
      if (fileApi?.delete) {
        await fileApi.delete({ query: { path, directory: resolvedPath } })
        return
      }
      const session = await client.session.create()
      if (!session.data) throw new Error("Failed to create session")
      await client.session.prompt({
        path: { id: session.data.id },
        body: { parts: [{ type: "text", text: `Delete the file at ${path}` }] },
        query: { directory: resolvedPath },
      })
    },
    [client, resolvedPath]
  )

  const sanitizeFileName = (name: string) => {
    const trimmed = name.trim()
    const bad = /(^\/)|(\\)|(\.\.)/
    if (!trimmed || bad.test(trimmed)) throw new Error("Invalid name")
    return trimmed
  }

  // Handle file operations
  const handleNewFile = useCallback(async () => {
    if (!targetNode || !newFileName.trim() || !client || !resolvedPath) return

    try {
      const safeName = sanitizeFileName(newFileName)
      const filePath =
        targetNode.type === "directory"
          ? `${targetNode.path}/${safeName}`
          : `${targetNode.path.split("/").slice(0, -1).join("/")}/${safeName}`

      await performWrite(filePath, "")

      // Refresh the file tree
      const refreshPath =
        targetNode.type === "directory"
          ? targetNode.path
          : targetNode.path.split("/").slice(0, -1).join("/")
      const response = await client.file.list({
        query: makeListQuery(refreshPath || ""),
      })
      const newTree = buildFileTree(normalizeFileList(response.data))

      if (refreshPath === "") {
        setFileTree(newTree)
      } else {
        // Update specific directory in tree
        setFileTree((prev) =>
          updateNodeInTree(prev, refreshPath, { children: newTree, isExpanded: true })
        )
      }
    } catch (error) {
      setError(`Failed to create file: ${error instanceof Error ? error.message : error}`)
    } finally {
      setShowNewFileDialog(false)
      setNewFileName("")
      setTargetNode(null)
    }
  }, [targetNode, newFileName, client, resolvedPath, performWrite, updateNodeInTree, makeListQuery])

  const handleRename = useCallback(async () => {
    if (!targetNode || !newFileName.trim() || !client || !resolvedPath) return

    try {
      const oldPath = targetNode.path
      const safeName = sanitizeFileName(newFileName)
      const newPath = targetNode.path.split("/").slice(0, -1).concat(safeName).join("/")
      await performRename(oldPath, newPath)

      // Refresh the file tree
      const parentPath = targetNode.path.split("/").slice(0, -1).join("/")
      const response = await client.file.list({
        query: makeListQuery(parentPath || ""),
      })
      const newTree = buildFileTree(normalizeFileList(response.data))

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
    } catch (error) {
      setError(`Failed to rename file: ${error instanceof Error ? error.message : error}`)
    } finally {
      setShowRenameDialog(false)
      setNewFileName("")
      setTargetNode(null)
    }
  }, [
    targetNode,
    newFileName,
    client,
    activeTab,
    resolvedPath,
    performRename,
    updateNodeInTree,
    makeListQuery,
  ])

  const handleDelete = useCallback(
    async (node: FileTreeNode) => {
      if (!client || !resolvedPath || !confirm(`Are you sure you want to delete ${node.name}?`))
        return

      try {
        await performDelete(node.path)

        // Close the file if it's open
        setOpenFiles((prev) => prev.filter((f) => f.path !== node.path))
        if (activeTab === node.path) {
          const remainingFiles = openFiles.filter((f) => f.path !== node.path)
          setActiveTab(remainingFiles.length > 0 ? remainingFiles[0].path : undefined)
        }

        // Refresh the file tree
        const parentPath = node.path.split("/").slice(0, -1).join("/")
        const response = await client.file.list({
          query: makeListQuery(parentPath || ""),
        })
        const newTree = buildFileTree(normalizeFileList(response.data))

        if (parentPath === "") {
          setFileTree(newTree)
        } else {
          setFileTree((prev) =>
            updateNodeInTree(prev, parentPath, { children: newTree, isExpanded: true })
          )
        }
      } catch (error) {
        setError(`Failed to delete file: ${error instanceof Error ? error.message : error}`)
      }
    },
    [activeTab, openFiles, client, resolvedPath, performDelete, updateNodeInTree, makeListQuery]
  )

  // Save all dirty files
  const handleSaveAll = useCallback(async () => {
    const dirtyFiles = openFiles.filter((f) => f.isDirty)
    if (dirtyFiles.length === 0 || !client || !resolvedPath) return

    try {
      await Promise.all(dirtyFiles.map((file) => performWrite(file.path, file.content)))
      setOpenFiles((prev) => prev.map((f) => ({ ...f, isDirty: false })))
    } catch (err) {
      setError(`Failed to save files: ${err instanceof Error ? err.message : err}`)
    }
  }, [openFiles, client, resolvedPath, performWrite])

  const handleAskAI = useCallback(async () => {
    if (!projectId || !resolvedPath || !activeFile || !client?.session?.prompt) return
    try {
      setIsAskAiLoading(true)
      const session = await createSession(
        projectId,
        resolvedPath,
        `Insights for ${activeFile.name}`
      )

      const sessionId = session?.id
      if (!sessionId) {
        return
      }

      await client.session.prompt({
        path: { id: sessionId },
        query: { directory: resolvedPath },
        body: {
          parts: [
            {
              type: "text",
              text: `Provide an analysis and summary for the file ${activeFile.path}. Highlight key responsibilities, important exports, and any potential issues to review.`,
            },
          ],
        },
      })

      navigate(`/projects/${projectId}/${activeWorktreeId}/sessions/${sessionId}/chat`)
    } catch (error) {
      console.error("Failed to ask AI about file:", error)
    } finally {
      setIsAskAiLoading(false)
    }
  }, [projectId, resolvedPath, activeFile, client, createSession, navigate, activeWorktreeId])

  // Handle code edits in Monaco
  const handleCodeChange = useCallback((path: string, newContent: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content: newContent, isDirty: true } : f))
    )
  }, [])

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
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 150)
    return () => clearTimeout(t)
  }, [searchQuery])

  const filteredTree = useMemo(() => {
    if (!debouncedSearch) return fileTree

    const filterTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.reduce<FileTreeNode[]>((acc, node) => {
        const matches = node.name.toLowerCase().includes(debouncedSearch.toLowerCase())
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
  }, [fileTree, debouncedSearch])

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

  // Monaco-only editor: no preview sandbox

  if (error) {
    return (
      <div className="bg-background text-foreground flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="mb-2 text-xl font-semibold">Failed to load files</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="file-browser-page"
      className={cn(
        "bg-background text-foreground flex h-full",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      {/* Left Panel - File Tree */}
      <div className="border-border bg-card flex w-80 flex-col border-r">
        {/* Controls */}
        <div data-testid="file-browser-controls" className="border-border space-y-3 border-b p-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              data-testid="file-search-input"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-input bg-background placeholder:text-muted-foreground pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="View mode" className="flex items-center gap-2">
              <Button
                size="sm"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
              >
                List View
              </Button>
              <Button
                size="sm"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
              >
                Grid View
              </Button>
            </div>
            <label className="text-muted-foreground flex items-center gap-2 text-sm">
              <Checkbox
                checked={showHidden}
                onCheckedChange={(value) => setShowHidden(value === true)}
                aria-label="Show hidden files"
              />
              <span>Show hidden files</span>
            </label>
          </div>
        </div>

        {/* File Tree */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="py-2">
              <FileExplorer
                nodes={filteredTree as unknown as ExplorerNode[]}
                selectedPath={selectedPath}
                onSelect={handleFileSelect}
                onToggle={handleToggle}
                onContextMenu={handleContextMenu}
                className={viewMode === "grid" ? "grid grid-cols-2 gap-2" : "space-y-1"}
              />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Code Editor */}
      <div className="flex flex-1 flex-col">
        {/* Breadcrumb */}
        <Breadcrumb
          items={breadcrumbItems}
          onNavigate={(path) => {
            const fileAtPath = openFiles.find((f) => f.path === path)
            if (fileAtPath) setActiveTab(path)
          }}
        />
        <div data-testid="breadcrumb-navigation" className="px-4 py-2" />

        {/* Editor Header */}
        <div
          data-testid="breadcrumb-navigation"
          className="border-border flex items-center justify-between border-b px-4 py-2"
        >
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Code Editor</h2>
            {openFiles.some((f) => f.isDirty) && (
              <span className="text-xs text-yellow-500">• Unsaved changes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFile && (
              <Button
                data-testid="ask-ai-button"
                variant="ghost"
                size="sm"
                onClick={handleAskAI}
                disabled={isAskAiLoading}
                className="text-purple-400 hover:text-purple-300"
              >
                <Sparkles className="mr-1 h-4 w-4" />
                {isAskAiLoading ? "Asking..." : "Ask AI"}
              </Button>
            )}
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
                <p className="text-muted-foreground">
                  Select a file from the tree to start editing
                </p>
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
              <TabsList className="mx-4 mt-2">
                {openFiles.map((file) => (
                  <TabsTrigger
                    key={file.path}
                    value={file.path}
                    asChild
                    className="flex items-center gap-2"
                  >
                    <div className="flex items-center gap-2">
                      {React.createElement(getFileIcon(file.name, "file"), {
                        className: "w-4 h-4",
                      })}
                      <span>{file.name}</span>
                      {file.isDirty && <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTabClose(file.path)
                        }}
                        aria-label="Close tab"
                        className="hover:bg-accent/30 focus-visible:ring-ring ml-1 rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>

              {openFiles.map((file) => (
                <TabsContent key={file.path} value={file.path} className="flex-1">
                  <div data-testid="file-editor" className="h-full min-h-0">
                    <div data-testid="file-editor-inner" className="h-full">
                      <div data-testid="editor-container" className="h-full">
                        <MonacoEditor
                          filePath={file.path}
                          content={file.content}
                          language={file.language}
                          onChange={(val) => handleCodeChange(file.path, val)}
                          onMount={(editor, monaco) => {
                            editor.addCommand(
                              monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                              async () => {
                                // Save active file via direct write
                                const f = openFiles.find((of) => of.path === file.path)
                                if (!f || !f.isDirty) return
                                try {
                                  await performWrite(f.path, f.content)
                                  setOpenFiles((prev) =>
                                    prev.map((x) =>
                                      x.path === f.path ? { ...x, isDirty: false } : x
                                    )
                                  )
                                } catch (e) {
                                  console.error("Save failed", e)
                                }
                              }
                            )
                          }}
                          className="h-full"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="border-border bg-popover text-popover-foreground fixed z-50 rounded-md border py-1 shadow-lg"
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

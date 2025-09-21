import type { MouseEvent as ReactMouseEvent } from "react"
import { ChevronDown, ChevronRight, FileCode, FileText, Folder, FolderOpen, Loader2 } from "lucide-react"

export interface FileTreeNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileTreeNode[]
  isExpanded?: boolean
  isLoading?: boolean
}

export interface FileExplorerProps {
  nodes: FileTreeNode[]
  selectedPath?: string
  onSelect: (node: FileTreeNode) => void
  onToggle: (node: FileTreeNode) => void
  onContextMenu: (node: FileTreeNode, e: ReactMouseEvent) => void
  className?: string
}

export function FileExplorer({ nodes, selectedPath, onSelect, onToggle, onContextMenu, className }: FileExplorerProps) {
  const renderNode = (node: FileTreeNode, level = 0) => {
    const isDir = node.type === "directory"
    const isOpen = !!node.isExpanded
    const isSelected = selectedPath === node.path
    const indentPx = level * 12 + 8

    const ext = node.name.split(".").pop()?.toLowerCase()
    const codeExts = ["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "cs", "php", "rb", "go", "rs", "swift", "kt"]
    const Icon = isDir ? (isOpen ? FolderOpen : Folder) : codeExts.includes(ext || "") ? FileCode : FileText

    return (
      <div key={node.path}>
        <div
          role="treeitem"
          aria-expanded={isDir ? isOpen : undefined}
          data-testid={isDir ? "folder-item" : "file-item"}
          className={`group flex cursor-pointer items-center gap-1 px-2 py-1 text-sm transition-colors hover:bg-accent/30 ${
            isSelected ? "bg-accent/20 text-accent" : ""
          }`}
          style={{ paddingLeft: `${indentPx}px` }}
          onClick={() => onSelect(node)}
          onContextMenu={(e) => onContextMenu(node, e)}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onSelect(node)
            } else if (event.key === "ArrowRight" && isDir && !isOpen) {
              event.preventDefault()
              onToggle(node)
            } else if (event.key === "ArrowLeft" && isDir && isOpen) {
              event.preventDefault()
              onToggle(node)
            }
          }}
        >
          {isDir && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle(node)
              }}
              aria-label={isOpen ? "Collapse folder" : "Expand folder"}
              className="rounded p-0.5 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {node.isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{node.name}</span>
        </div>
        {isDir && isOpen && node.children && (
          <div>{node.children.map((child) => renderNode(child, level + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div role="tree" aria-label="Project files" data-testid="file-tree" className={className}>
      {nodes.map((n) => renderNode(n, 0))}
    </div>
  )
}

export default FileExplorer

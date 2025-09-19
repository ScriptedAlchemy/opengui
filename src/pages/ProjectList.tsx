import React, { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import {
  Plus,
  Search,
  Folder,
  FolderOpen,
  Play,
  Square,
  Trash2,
  ExternalLink,
  AlertCircle,
  Loader2,
  GitBranch,
  Clock,
  Filter,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { DynamicDirectoryCombobox } from "@/components/ui/dynamic-directory-combobox"

import {
  useProjects,
  useProjectsLoading,
  useProjectsError,
  useInstanceOperations,
  useProjectsActions,
} from "../stores/projects"
import type { Project } from "../lib/api/project-manager"

type DirectoryPickerResult = {
  name: string
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<DirectoryPickerResult>
}

const isAbsolutePath = (value: string) => {
  if (!value) return false
  const trimmed = value.trim()
  return (
    trimmed.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith("\\\\")
  )
}

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: true
}

interface DirectoryListingResponse {
  path: string
  parent: string | null
  entries: DirectoryEntry[]
}

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddProjectDialog({ open, onOpenChange }: AddProjectDialogProps) {
  const [projectPath, setProjectPath] = useState("")
  const [projectName, setProjectName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [pathEdited, setPathEdited] = useState(false)
  const [nameEdited, setNameEdited] = useState(false)

  const [homeDirectory, setHomeDirectory] = useState<string | null>(null)
  const [currentDirectory, setCurrentDirectory] = useState<string | null>(null)
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [directoryError, setDirectoryError] = useState<string | null>(null)

  const projects = useProjects()
  const { createProject } = useProjectsActions()

  // Function to fetch directories for the dynamic combobox
  const fetchDirectoriesForPath = async (path: string): Promise<DirectoryEntry[]> => {
    try {
      const response = await fetch(
        `/api/system/list-directory?path=${encodeURIComponent(path)}`
      )
      if (!response.ok) {
        throw new Error(`Failed to list directory (${response.status})`)
      }
      const data = (await response.json()) as DirectoryListingResponse
      return data.entries || []
    } catch (error) {
      console.error("Failed to fetch directories:", error)
      return []
    }
  }

  const fallbackProjectName = useMemo(() => {
    const trimmedPath = projectPath.trim()
    if (!trimmedPath) {
      return ""
    }

    const withoutTrailingSeparators = trimmedPath.replace(/[\\/]+$/, "")
    if (!withoutTrailingSeparators) {
      return ""
    }

    const segments = withoutTrailingSeparators.split(/[/\\]/).filter(Boolean)
    return segments[segments.length - 1] ?? ""
  }, [projectPath])

  // Auto-fill project name using package.json when available
  useEffect(() => {
    if (!open || nameEdited) {
      return
    }

    const trimmedPath = projectPath.trim()
    if (!trimmedPath) {
      setProjectName("")
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const suggestProjectName = async () => {
      let suggestion = fallbackProjectName

      if (isAbsolutePath(trimmedPath)) {
        try {
          const response = await fetch(
            `/api/system/package-json?path=${encodeURIComponent(trimmedPath)}`,
            { signal: controller.signal }
          )

          if (response.ok) {
            const data = (await response.json()) as {
              packageJson?: Record<string, unknown>
            }
            const packageName = data.packageJson?.name
            if (typeof packageName === "string" && packageName.trim()) {
              suggestion = packageName.trim()
            }
          }
        } catch (fetchError) {
          if (!controller.signal.aborted) {
            console.debug(
              "Failed to inspect package.json for project name suggestion:",
              fetchError
            )
          }
        }
      }

      if (!cancelled && suggestion) {
        setProjectName((prev) => (prev === suggestion ? prev : suggestion))
      } else if (!cancelled && !suggestion) {
        setProjectName((prev) => (prev === "" ? prev : ""))
      }
    }

    void suggestProjectName()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [open, projectPath, nameEdited, fallbackProjectName])

  useEffect(() => {
    if (!open) return

    let cancelled = false

    const loadHomeDirectory = async () => {
      try {
        setDirectoryError(null)

        let basePath = homeDirectory
        if (!basePath) {
          const response = await fetch("/api/system/home")
          if (!response.ok) {
            throw new Error(`Failed to load home directory (${response.status})`)
          }
          const data = (await response.json()) as { path: string }
          if (cancelled) return
          basePath = data.path
          setHomeDirectory(basePath)
        }

        if (!pathEdited && !projectPath) {
          setProjectPath(basePath ?? "")
        }

        if (basePath) {
          setCurrentDirectory(basePath)
        }
      } catch (loadError) {
        console.error("Failed to load home directory:", loadError)
        if (!cancelled) {
          setDirectoryError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to determine home directory"
          )
        }
      }
    }

    void loadHomeDirectory()

    return () => {
      cancelled = true
    }
  }, [open, homeDirectory, pathEdited, projectPath])

  useEffect(() => {
    // Directory Explorer removed — no parent directory fetch needed.
  }, [open, currentDirectory])

  // Directory Explorer and browse button removed; selection occurs via combobox.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!projectPath.trim()) {
      setError("Project path is required")
      return
    }

    if (!isAbsolutePath(projectPath)) {
      setError("Project path must be absolute (e.g. /Users/name/project or C:/path/to/project)")
      return
    }

    if (!projectName.trim()) {
      setError("Project name is required")
      return
    }

    // Check for duplicate paths
    const existingProject = projects.find((p: Project) => p.path === projectPath.trim())
    if (existingProject) {
      setError("A project with this path already exists")
      return
    }

    setIsLoading(true)

    try {
      const newProject = await createProject({
        path: projectPath.trim(),
        name: projectName.trim(),
      })

      if (newProject) {
        onOpenChange(false)
        setProjectPath("")
        setProjectName("")
        setNameEdited(false)
        setPathEdited(false)
        setCurrentDirectory(homeDirectory)
        setDirectoryError(null)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create project")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setProjectPath("")
    setProjectName("")
    setError("")
    setPathEdited(false)
    setNameEdited(false)
    setCurrentDirectory(homeDirectory)
    setDirectoryParent(null)
    setDirectoryError(null)
  }

  const handleDirectorySelect = (target: string) => {
    setCurrentDirectory(target)
    setProjectPath(target)
    setPathEdited(true)
    setError("")
  }

  // Parent navigation removed with Directory Explorer.

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        data-testid="add-project-dialog"
        className="border-border bg-card text-foreground"
      >
        <DialogHeader>
          <DialogTitle>Add Project</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add an existing project folder to OpenCode. The project files will not be moved.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Path</label>
            <DynamicDirectoryCombobox
              currentDirectory={currentDirectory || homeDirectory || '/'}
              onSelect={handleDirectorySelect}
              placeholder="Search or select directories..."
              emptyText="No directories found. Start typing to search..."
              searchPlaceholder="Type to search (e.g. 'dev', 'projects')..."
              disabled={directoryLoading}
              fetchDirectories={fetchDirectoriesForPath}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name</label>
            <Input
              data-testid="project-name-input"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value)
                setNameEdited(true)
              }}
              placeholder="My Project"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Directory Explorer section removed; combobox above handles selection and search. */}
        </form>

        <DialogFooter>
          <Button
            data-testid="button-cancel-project"
            type="button"
            variant="outline"
            onClick={handleClose}
            className="border-border bg-background text-foreground hover:bg-accent/50"
          >
            Cancel
          </Button>
          <Button
            data-testid="button-create-project"
            onClick={handleSubmit}
            disabled={isLoading || !projectPath.trim() || !projectName.trim()}
            className="bg-primary text-foreground hover:bg-[#2563eb]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ProjectCardProps extends React.HTMLAttributes<HTMLDivElement> {
  project: Project
  onOpen: (project: Project) => void
  onRemove: (project: Project) => void
  onToggleInstance: (project: Project) => void
  isInstanceLoading: boolean
}

function ProjectCard({
  project,
  onOpen,
  onRemove,
  onToggleInstance,
  isInstanceLoading,
}: ProjectCardProps) {
  const isRunning = project.instance?.status === "running"
  const isStarting = project.instance?.status === "starting"
  const isError = project.instance?.status === "error"

  const getStatusBadge = () => {
    if (isStarting) {
      return (
        <Badge
          variant="secondary"
          className="border-yellow-500/30 bg-yellow-500/20 text-yellow-400"
        >
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Starting
        </Badge>
      )
    }

    if (isRunning) {
      return (
        <Badge variant="secondary" className="border-green-500/30 bg-green-500/20 text-green-400">
          <div className="mr-2 h-2 w-2 rounded-full bg-green-400" />
          Running
        </Badge>
      )
    }

    if (isError) {
      return (
        <Badge variant="destructive" className="border-red-500/30 bg-red-500/20 text-red-400">
          <AlertCircle className="mr-1 h-3 w-3" />
          Error
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="border-border text-muted-foreground">
        <Square className="mr-1 h-3 w-3" />
        Stopped
      </Badge>
    )
  }

  return (
    <div
      data-testid="project-item"
      className="group rounded-lg border border-border bg-card p-6 transition-colors hover:border-[#3b82f6]/50"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            {project.type === "git" ? (
              <GitBranch className="h-5 w-5 text-[#3b82f6]" />
            ) : (
              <FolderOpen className="h-5 w-5 text-[#3b82f6]" />
            )}
          </div>
          <div>
            <h3 data-testid="project-name" className="font-semibold text-foreground transition-colors group-hover:text-[#3b82f6]">
              {project.name}
            </h3>
            <p className="max-w-[200px] truncate text-sm text-muted-foreground">{project.path}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-testid="button-project-menu"
              variant="ghost"
              size="icon"
              className="opacity-0 transition-opacity group-hover:opacity-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zM12 13a1 1 0 110-2 1 1 0 010 2zM12 20a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-border bg-card">
            <DropdownMenuItem
              data-testid="button-remove-project"
              onClick={() => onRemove(project)}
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div data-testid="badge-project-status">{getStatusBadge()}</div>
        {project.lastOpened && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(project.lastOpened), { addSuffix: true })}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          data-testid="button-open-project"
          onClick={() => onOpen(project)}
          className="flex-1 bg-primary text-foreground hover:bg-[#2563eb]"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open
        </Button>

        <Button
          data-testid="button-toggle-instance"
          onClick={() => onToggleInstance(project)}
          disabled={isInstanceLoading}
          variant="outline"
          className="border-border bg-background text-foreground hover:bg-accent/50"
        >
          {isInstanceLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isRunning ? (
            <Square className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

function EmptyState({ onAddProject }: { onAddProject: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
        <Folder className="h-8 w-8 text-[#3b82f6]" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-foreground">No projects yet</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        Get started by adding your first project. You can add existing folders or import from Git
        repositories.
      </p>
      <Button
        data-testid="button-add-first-project"
        onClick={onAddProject}
        className="bg-primary text-foreground hover:bg-[#2563eb]"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Your First Project
      </Button>
    </div>
  )
}

export default function ProjectList({ navigateOverride }: { navigateOverride?: (path: string) => void } = {}) {
  let navigate: (path: string) => void
  try {
    const hook = useNavigate()
    navigate = navigateOverride ?? hook
  } catch {
    navigate = navigateOverride ?? (() => {})
  }
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [filterStatus, setFilterStatus] = useState<"all" | "running" | "stopped">("all")

  const projects = useProjects()
  const loading = useProjectsLoading()
  const error = useProjectsError()
  const instanceOperations = useInstanceOperations()
  const { loadProjects, selectProject, removeProject, startInstance, stopInstance, clearError } =
    useProjectsActions()

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Filter and search projects
  const filteredProjects = useMemo(() => {
    let filtered = projects

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (project: Project) =>
          project.name.toLowerCase().includes(query) || project.path.toLowerCase().includes(query)
      )
    }

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((project: Project) => {
        const isRunning = project.instance?.status === "running"
        return filterStatus === "running" ? isRunning : !isRunning
      })
    }

    // Sort by last opened (most recent first), then by name
    // Create a copy to avoid mutating the original array
    return [...filtered].sort((a: Project, b: Project) => {
      if (a.lastOpened && b.lastOpened) {
        return new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
      }
      if (a.lastOpened && !b.lastOpened) return -1
      if (!a.lastOpened && b.lastOpened) return 1
      return a.name.localeCompare(b.name)
    })
  }, [projects, searchQuery, filterStatus])

  const handleOpenProject = async (project: Project) => {
    try {
      await selectProject(project.id)
    } catch (error) {
      console.error("Failed to select project:", error)
      // Continue with navigation even if selection fails
    }
    navigate(`/projects/${project.id}/default`)
  }

  const handleRemoveProject = async (project: Project) => {
    if (
      confirm(`Are you sure you want to remove "${project.name}"? This will not delete the files.`)
    ) {
      await removeProject(project.id)
    }
  }

  const handleToggleInstance = async (project: Project) => {
    const isRunning = project.instance?.status === "running"
    if (isRunning) {
      await stopInstance(project.id)
    } else {
      await startInstance(project.id)
    }
  }

  const runningCount = projects.filter((p: Project) => p.instance?.status === "running").length

  if (loading && projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#3b82f6]" />
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Projects</h1>
              <p className="mt-1 text-muted-foreground">
                {projects.length} project{projects.length !== 1 ? "s" : ""}
                {runningCount > 0 && (
                  <span className="ml-2 text-green-400">• {runningCount} running</span>
                )}
              </p>
            </div>

            <Button
              data-testid="add-project-button"
              onClick={() => setShowAddDialog(true)}
              className="bg-primary text-foreground hover:bg-[#2563eb]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-3">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
            <Button
              data-testid="button-dismiss-error"
              onClick={clearError}
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {projects.length === 0 ? (
          <EmptyState onAddProject={() => setShowAddDialog(true)} />
        ) : (
          <>
            {/* Search and Filters */}
            <div className="mb-8 flex items-center gap-4">
              <div className="relative max-w-md flex-1">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                <Input
                  data-testid="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="border-border bg-card pl-10 text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    data-testid="button-filter-projects"
                    variant="outline"
                    className="border-border bg-card text-foreground hover:bg-accent/50"
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    {filterStatus === "all"
                      ? "All"
                      : filterStatus === "running"
                        ? "Running"
                        : "Stopped"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-border bg-card">
                  <DropdownMenuItem
                    data-testid="filter-all-projects"
                    onClick={() => setFilterStatus("all")}
                    className={cn(filterStatus === "all" && "bg-primary/20")}
                  >
                    All Projects
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="filter-running-projects"
                    onClick={() => setFilterStatus("running")}
                    className={cn(filterStatus === "running" && "bg-primary/20")}
                  >
                    Running Only
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="filter-stopped-projects"
                    onClick={() => setFilterStatus("stopped")}
                    className={cn(filterStatus === "stopped" && "bg-primary/20")}
                  >
                    Stopped Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
              <div className="py-12 text-center">
                <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium text-foreground">No projects found</h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? `No projects match "${searchQuery}"`
                    : `No ${filterStatus} projects found`}
                </p>
              </div>
            ) : (
              <div
                className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                data-testid="project-list"
              >
                {filteredProjects.map((project: Project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={handleOpenProject}
                    onRemove={handleRemoveProject}
                    onToggleInstance={handleToggleInstance}
                    isInstanceLoading={!!instanceOperations[project.id]}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Project Dialog */}
      <AddProjectDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  )
}

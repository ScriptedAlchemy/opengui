import { useState, useEffect, useMemo, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { DirectoryPathCombobox } from "./DirectoryPathCombobox"

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddProject: (params: { path: string; name?: string }) => Promise<unknown>
}

const isAbsolutePath = (value: string) => {
  if (!value) return false
  const trimmed = value.trim()
  return trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith("\\\\")
}

export function AddProjectDialog({
  open,
  onOpenChange,
  onAddProject,
}: AddProjectDialogProps) {
  const [path, setPath] = useState("")
  const [name, setName] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState("")
  const [nameEdited, setNameEdited] = useState(false)
  // Track if user manually edited the path (used for UX; not gating submit)
  const pathEdited = useRef<boolean>(false)
  // Backwards compatibility setter for previous code paths
  const setPathEdited = (v: boolean) => {
    pathEdited.current = v
  }
  const pathEditedRef = useRef(false)

  // Fallback project name from path
  const fallbackProjectName = useMemo(() => {
    if (!path) return ""
    const trimmedPath = path.trim()
    if (!trimmedPath) return ""
    const withoutTrailing = trimmedPath.replace(/[\\/]+$/, "")
    if (!withoutTrailing) return ""
    const segments = withoutTrailing.split(/[/\\]/).filter(Boolean)
    return segments[segments.length - 1] ?? ""
  }, [path])

  // Auto-fill project name from package.json or directory name
  useEffect(() => {
    if (!open || nameEdited) return

    const trimmedPath = path.trim()
    if (!trimmedPath) {
      setName("")
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
            const data = await response.json()
            const packageName = data.packageJson?.name
            if (typeof packageName === "string" && packageName.trim()) {
              suggestion = packageName.trim()
            }
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            console.debug("Failed to inspect package.json:", err)
          }
        }
      }

      if (!cancelled && suggestion) {
        setName((prev) => (prev === suggestion ? prev : suggestion))
      } else if (!cancelled && !suggestion) {
        setName((prev) => (prev === "" ? prev : ""))
      }
    }

    void suggestProjectName()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [open, path, nameEdited, fallbackProjectName])

  // No default path; user must choose/enter a directory

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setPath("")
      setName("")
      setError("")
      setNameEdited(false)
      setPathEdited(false)
      pathEditedRef.current = false
      setIsAdding(false)
    }
  }, [open])

  const handleAdd = async () => {
    const trimmedPath = path.trim()
    const trimmedName = name.trim()

    if (!trimmedPath) {
      setError("Please select a directory")
      return
    }

    if (!trimmedName) {
      setError("Please provide a project name")
      return
    }

    setIsAdding(true)
    setError("")

    try {
      const result = await onAddProject({
        path: trimmedPath,
        name: trimmedName,
      })
      if (result) {
        onOpenChange(false)
      } else {
        const message = "Project was not created. Please verify the path and try again."
        setError(message)
        toast.error("Failed to add project", { description: message })
      }
    } catch (err) {
      console.error("Failed to add project:", err)
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      toast.error("Failed to add project", { description: message })
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add a Project</DialogTitle>
          <DialogDescription>
            Select a directory to add as a project. You can optionally provide a custom name.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="path">Project Directory</Label>
            <DirectoryPathCombobox
              value={path}
              onValueChange={(newPath) => {
                setPath(newPath)
                setPathEdited(true)
                pathEditedRef.current = true
                setError("")
              }}
              placeholder="Select a directory..."
            />
            {path && (
              <p className="text-xs text-muted-foreground">
                Selected: {path}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameEdited(true)
                setError("")
              }}
              placeholder={fallbackProjectName || "Enter project name"}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAdding}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleAdd()}
            disabled={!path.trim() || !name.trim() || isAdding}
          >
            {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isAdding ? "Adding..." : "Add Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

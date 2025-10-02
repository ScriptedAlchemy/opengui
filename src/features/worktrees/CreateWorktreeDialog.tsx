import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GitBranchInfo } from "@/lib/api/project-manager"
import { projectManager } from "@/lib/api/project-manager"
import { toast } from "sonner"

const WORKTREES_PREFIX = "worktrees/"

const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

const sanitizeSegments = (value: string) => {
  const normalized = normalize(value).trim()
  if (!normalized) return ""
  return normalized
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "")
    )
    .filter(Boolean)
    .join("/")
}

const slugifyTitle = (value: string) => sanitizeSegments(value)

const sanitizePathInput = (value: string) => sanitizeSegments(value)

const sanitizeBranchInput = (value: string) => sanitizeSegments(value)

const BRANCH_NAME_REGEX = /^[a-zA-Z0-9._\-\/]+$/
const validateBranchName = (name: string): string | null => {
  if (!name.trim()) return "Branch name is required"
  if (!BRANCH_NAME_REGEX.test(name)) {
    return "Branch name can only contain letters, numbers, dots, dashes, underscores, and slashes"
  }
  if (name.startsWith("/") || name.endsWith("/")) {
    return "Branch name cannot start or end with a slash"
  }
  if (name.includes("//")) {
    return "Branch name cannot contain consecutive slashes"
  }
  if (name.length > 255) {
    return "Branch name is too long (max 255 characters)"
  }
  return null
}

interface CreateWorktreeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onCreate: (params: {
    title: string
    path: string
    branch?: string
    baseRef?: string
    createBranch?: boolean
    force?: boolean
  }) => Promise<void>
}

export function CreateWorktreeDialog({ open, onOpenChange, projectId, onCreate }: CreateWorktreeDialogProps) {
  const [branches, setBranches] = useState<GitBranchInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [title, setTitle] = useState("")
  const [path, setPath] = useState("")
  const [pathManuallyEdited, setPathManuallyEdited] = useState(false)
  const [branch, setBranch] = useState("")
  const [branchManuallyEdited, setBranchManuallyEdited] = useState(false)
  const [baseRef, setBaseRef] = useState("HEAD")
  const [error, setError] = useState("")
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await projectManager.getBranches(projectId)
        if (!cancelled) setBranches(data)
      } catch (e) {
        if (!cancelled) {
          setBranches([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  useEffect(() => {
    if (!open) {
      setTitle("")
      setPath("")
      setPathManuallyEdited(false)
      setBranch("")
      setBranchManuallyEdited(false)
      setBaseRef("HEAD")
      setMode("new")
      setError("")
      setLoading(false)
    }
  }, [open])

  useEffect(() => {
    const slug = slugifyTitle(title)
    if (!pathManuallyEdited) {
      const nextPath = slug ? `${WORKTREES_PREFIX}${slug}` : ""
      setPath((current) => (current === nextPath ? current : nextPath))
    }
    if (mode === "new" && !branchManuallyEdited) {
      setBranch((current) => (current === slug ? current : slug))
    }
  }, [title, mode, pathManuallyEdited, branchManuallyEdited])

  const existingBranchNames = useMemo(() => branches.map((b) => b.name), [branches])
  const disabledExisting = useMemo(() => new Set(branches.filter((b) => b.checkedOut).map((b) => b.name)), [branches])

  const canSubmit = useMemo(() => {
    if (!title.trim() || !path.trim()) return false
    if (mode === "new") return !!branch.trim()
    if (mode === "existing") return !!branch.trim()
    return false
  }, [title, path, mode, branch])

  const handleSubmit = async () => {
    setError("")

    // Validate branch name for new branches
    if (mode === "new") {
      const branchError = validateBranchName(branch)
      if (branchError) {
        setError(branchError)
        toast.error(branchError)
        return
      }
    }

    setLoading(true)
    try {
      if (mode === "new") {
        await onCreate({ title: title.trim(), path: path.trim(), branch: branch.trim(), createBranch: true, baseRef: baseRef.trim() || "HEAD" })
      } else {
        const selected = branch.trim()
        await onCreate({ title: title.trim(), path: path.trim(), branch: selected })
      }
      onOpenChange(false)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create worktree"
      setError(message)
      toast.error("Create worktree failed", { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]" data-testid="create-worktree-dialog">
        <DialogHeader>
          <DialogTitle>New Worktree</DialogTitle>
          <DialogDescription>Create a git worktree from a new or existing branch.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Feature ABC" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="path">Relative Path</Label>
            <Input
              id="path"
              value={path}
              onChange={(e) => {
                const sanitized = sanitizePathInput(e.target.value)
                setPath(sanitized)
                setPathManuallyEdited(sanitized.length > 0)
              }}
              placeholder="worktrees/feature-abc"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>New branch</Button>
            <Button type="button" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>Existing branch</Button>
          </div>

          {mode === "new" ? (
            <div className="grid gap-2">
              <Label htmlFor="branch">New Branch Name</Label>
              <Input
                id="branch"
                value={branch}
                onChange={(e) => {
                  const sanitized = sanitizeBranchInput(e.target.value)
                  setBranch(sanitized)
                  setBranchManuallyEdited(sanitized.length > 0)
                }}
                placeholder="feature/abc"
              />
              <Label htmlFor="base">Base Ref</Label>
              <Input id="base" value={baseRef} onChange={(e) => setBaseRef(e.target.value)} placeholder="HEAD or main" />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>Existing Branch</Label>
              <Popover open={branchPopoverOpen} onOpenChange={setBranchPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={branchPopoverOpen} className="w-full justify-between">
                    {branch ? branch : "Select branch..."}
                    <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[480px] p-0">
                  <Command>
                    <CommandInput placeholder="Search branches..." />
                    <CommandList>
                      <CommandEmpty>No branches found.</CommandEmpty>
                      <CommandGroup>
                        {existingBranchNames.map((name) => (
                          <CommandItem
                            key={name}
                            value={name}
                            onSelect={(current) => {
                              setBranch(current)
                              setBranchPopoverOpen(false)
                            }}
                            disabled={disabledExisting.has(name)}
                          >
                            <CheckIcon className={cn("mr-2 h-4 w-4", branch === name ? "opacity-100" : "opacity-0")} />
                            <span className={cn(disabledExisting.has(name) && "opacity-60")}>{name}{disabledExisting.has(name) ? " (in use)" : ""}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit || loading}>{loading ? "Creating..." : "Create Worktree"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

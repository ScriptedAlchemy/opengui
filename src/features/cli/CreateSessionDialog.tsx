import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CreateSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  worktrees: Array<{ id: string; title: string; branch?: string }>
  tools: Array<{ id: string; name: string; available?: boolean }>
  defaultWorktreeId?: string
  onCreateSession: (params: {
    projectId: string
    worktreeId: string
    tool: string
    title?: string
  }) => Promise<unknown>
}

export function CreateSessionDialog({
  open,
  onOpenChange,
  projectId,
  worktrees,
  tools,
  defaultWorktreeId,
  onCreateSession,
}: CreateSessionDialogProps) {
  const [worktreeId, setWorktreeId] = useState(
    defaultWorktreeId || worktrees.find((w) => w.id === "default")?.id || worktrees[0]?.id || ""
  )
  const [tool, setTool] = useState(tools.find((t) => t.available !== false)?.id || "codex")
  const [title, setTitle] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // Update defaults when dialog opens
  useEffect(() => {
    if (open) {
      const defaultWorktree = defaultWorktreeId || worktrees.find((w) => w.id === "default")?.id || worktrees[0]?.id || ""
      const defaultTool = tools.find((t) => t.available !== false)?.id || "codex"
      setWorktreeId(defaultWorktree)
      setTool(defaultTool)
      setTitle(`${defaultTool}:${defaultWorktree}`)
    }
  }, [open, defaultWorktreeId, worktrees, tools])

  const handleCreate = async () => {
    if (!worktreeId || !tool) return

    setIsCreating(true)
    try {
      const result = await onCreateSession({
        projectId,
        worktreeId,
        tool,
        title: title || undefined,
      })
      if (result) {
        onOpenChange(false)
      } else {
        toast.error("Failed to create session", {
          description: "The server did not create a session. Check logs and try again.",
        })
      }
    } catch (error) {
      console.error("Failed to create session:", error)
      toast.error("Failed to create session", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const availableTools = tools.filter((t) => t.available !== false)
  const selectedWorktree = worktrees.find((w) => w.id === worktreeId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Launch CLI Session</DialogTitle>
          <DialogDescription>
            Choose a worktree and tool preset to launch a new terminal session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="worktree">Worktree</Label>
            <Select value={worktreeId} onValueChange={setWorktreeId}>
              <SelectTrigger id="worktree">
                <SelectValue placeholder="Select worktree" />
              </SelectTrigger>
              <SelectContent>
                {worktrees.map((wt) => (
                  <SelectItem key={wt.id} value={wt.id}>
                    {wt.title || wt.id}
                    {wt.branch && ` (${wt.branch})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWorktree && (
              <p className="text-xs text-muted-foreground">
                {selectedWorktree.branch || "No branch"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tool">Tool Preset</Label>
            <Select value={tool} onValueChange={setTool}>
              <SelectTrigger id="tool">
                <SelectValue placeholder="Select tool" />
              </SelectTrigger>
              <SelectContent>
                {availableTools.map((t) => (
                  <SelectItem key={t.id} value={t.id} data-testid={`tool-option-${t.id}`}>
                    {t.name || t.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableTools.length === 0 && (
              <p className="text-xs text-destructive">
                No tools available. Install codex, claude, or opencode CLI.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Session Title (optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${tool}:${worktreeId}`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!worktreeId || !tool || availableTools.length === 0 || isCreating}
          >
            {isCreating ? "Launching..." : "Launch Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

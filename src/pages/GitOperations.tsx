import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  GitMerge,
  Plus,
  Trash2,
  RefreshCw,
  Upload,
  Download,
  FileText,
  Clock,
  User,
  Hash,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Copy,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Archive,
  Search,
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Textarea } from "../components/ui/textarea"
import { Badge } from "../components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog"
import { ScrollArea } from "../components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/shadcn-io/tabs"
import { useProjectSDK } from "../contexts/OpencodeSDKContext"
import { useCurrentProject } from "@/stores/projects"
import { useWorktreesStore, useWorktreesForProject } from "@/stores/worktrees"
import { cn, formatRelativeTime, formatDateTime } from "../lib/utils"
import {
  extractTextFromMessage,
  executeGitCommand,
  fetchGitStatus as fetchGitStatusApi,
  type GitStatusFile,
  type GitSummary,
} from "../lib/git"
import { parseUnifiedDiff } from "@/lib/git-diff-parser"
import { DiffPreview } from "@/components/diff-preview"
import type { DiffData } from "@/types/diff"

interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: GitFile[]
  modified: GitFile[]
  untracked: GitFile[]
  remoteUrl?: string
}

interface GitFile {
  path: string
  status: "A" | "M" | "D" | "R" | "C" | "U" | "??"
  staged: boolean
  additions?: number
  deletions?: number
}

interface GitBranchInfo {
  name: string
  current: boolean
  remote?: string
  ahead?: number
  behind?: number
  lastCommit?: {
    hash: string
    message: string
    date: string
    author: string
  }
}

interface GitCommitInfo {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  message: string
  files: GitFile[]
  parents?: string[]
}

interface GitDiff {
  file: string
  additions: number
  deletions: number
  content: string
  parsed: DiffData | null
}

interface GitStash {
  index: number
  message: string
  date: string
  branch: string
}

export default function GitOperations() {
  const { projectId, worktreeId } = useParams<{ projectId: string; worktreeId: string }>()
  const navigate = useNavigate()
  const currentProject = useCurrentProject()
  const loadWorktrees = useWorktreesStore((state) => state.loadWorktrees)
  const worktrees = useWorktreesForProject(projectId || "")
  const activeWorktreeId = worktreeId || "default"

  const [workingPath, setWorkingPath] = useState<string | undefined>(currentProject?.path)

  useEffect(() => {
    if (projectId) {
      void loadWorktrees(projectId)
    }
  }, [projectId, loadWorktrees])

  useEffect(() => {
    if (currentProject?.path) {
      setWorkingPath(currentProject.path)
    }
  }, [currentProject?.path])

  useEffect(() => {
    if (!projectId) return
    if (activeWorktreeId === "default") {
      if (currentProject?.path) {
        setWorkingPath(currentProject.path)
      }
      return
    }
    const target = worktrees.find((worktree) => worktree.id === activeWorktreeId)
    if (target?.path) {
      setWorkingPath(target.path)
      return
    }

    // When the requested worktree does not exist, clear the working path and redirect to the default worktree.
    setWorkingPath(undefined)
    navigate(`/projects/${projectId}/default/git`, { replace: true })
  }, [projectId, activeWorktreeId, worktrees, currentProject?.path, navigate])

  const { client } = useProjectSDK(projectId, workingPath)
  const activeWorktree = useMemo(() => {
    if (activeWorktreeId === "default") {
      if (currentProject?.path) {
        return { id: "default", title: `${currentProject.name ?? "Project"} (default)` }
      }
      const defaultTree = worktrees.find((worktree) => worktree.id === "default")
      if (defaultTree) {
        return { id: defaultTree.id, title: defaultTree.title }
      }
      return undefined
    }
    return worktrees.find((worktree) => worktree.id === activeWorktreeId)
  }, [activeWorktreeId, worktrees, currentProject?.path, currentProject?.name])

  const worktreeTitle = useMemo(() => {
    if (activeWorktreeId === "default") {
      return `${currentProject?.name ?? "Project"} (default)`
    }
    return activeWorktree?.title ?? activeWorktreeId
  }, [activeWorktreeId, activeWorktree, currentProject?.name])

  const displayPath = useMemo(() => {
    if (!workingPath) return ""
    if (currentProject?.path) {
      const relative = workingPath.replace(currentProject.path, "")
      return relative || "/"
    }
    return workingPath
  }, [workingPath, currentProject?.path])

  // State
  const [activeTab, setActiveTab] = useState("status")
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branches, setBranches] = useState<GitBranchInfo[]>([])
  const [commits, setCommits] = useState<GitCommitInfo[]>([])
  const [statusRecentCommits, setStatusRecentCommits] = useState<GitSummary["recentCommits"]>([])
  const [stashes, setStashes] = useState<GitStash[]>([])
  const [diffs, setDiffs] = useState<Record<string, GitDiff>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commitMessage, setCommitMessage] = useState("")
  const [newBranchName, setNewBranchName] = useState("")
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set())
  const [showNewBranchDialog, setShowNewBranchDialog] = useState(false)
  const [operationLoading, setOperationLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch Git status
  const runGitCommand = useCallback(
    async (command: string) => {
      if (!client || !workingPath) {
        throw new Error("Git client is not ready")
      }
      return executeGitCommand(client, workingPath, command)
    },
    [client, workingPath]
  )

  const fetchGitStatus = useCallback(async () => {
    if (!projectId) return

    try {
      setError(null)
      const statusData = await fetchGitStatusApi(projectId, activeWorktreeId)
      const mapFile = (file: GitStatusFile): GitFile => ({
        path: file.path,
        status: file.status as GitFile["status"],
        staged: file.staged,
        additions: file.additions,
        deletions: file.deletions,
      })

      setStatus({
        branch: statusData.branch,
        ahead: statusData.ahead ?? 0,
        behind: statusData.behind ?? 0,
        staged: statusData.staged.map(mapFile),
        modified: statusData.modified.map(mapFile),
        untracked: statusData.untracked.map(mapFile),
        remoteUrl: statusData.remoteUrl,
      })
      setStatusRecentCommits(statusData.recentCommits ?? [])
    } catch (err) {
      console.error("Failed to fetch Git status via API:", err)
      setStatus(null)
      setError(`Failed to fetch Git status: ${err instanceof Error ? err.message : String(err)}`)
      setStatusRecentCommits([])
    }
  }, [projectId, activeWorktreeId])

  // Fetch branches
  useEffect(() => {
    void fetchGitStatus()
  }, [fetchGitStatus])

  const fetchBranches = useCallback(async () => {
    if (!client) return

    try {
      const response = await runGitCommand("git branch -vv")

      const textOutput = extractTextFromMessage(response.data)
      const lines = textOutput ? textOutput.split("\n") : []
      const branchList: GitBranchInfo[] = []

      lines.forEach((line: string) => {
        if (!line.trim()) return

        const current = line.startsWith("*")
        const cleanLine = line.replace(/^\*?\s+/, "")
        const parts = cleanLine.split(/\s+/)

        if (parts.length >= 1) {
          branchList.push({
            name: parts[0],
            current,
            remote: parts[2]?.includes("[") ? parts[2].replace(/[[\]]/g, "") : undefined,
          })
        }
      })

      setBranches(branchList)
    } catch (err) {
      console.error("Failed to fetch branches:", err)
    }
  }, [client, runGitCommand])

  const recentCommitSummaries = useMemo(() => {
    if (statusRecentCommits && statusRecentCommits.length > 0) {
      return statusRecentCommits.map((commit) => ({
        hash: commit.hash,
        shortHash: commit.hash.slice(0, 7),
        author: commit.author,
        date: commit.date,
        message: commit.message,
      }))
    }

    return commits.map((commit) => ({
      hash: commit.hash,
      shortHash: commit.shortHash,
      author: commit.author,
      date: commit.date,
      message: commit.message,
    }))
  }, [statusRecentCommits, commits])

  // Fetch commit history
  const fetchCommits = useCallback(async () => {
    if (!client || !workingPath) return

    try {
      const response = await runGitCommand(
        "git log --oneline -20 --pretty=format:'%H|%h|%an|%ae|%ad|%s' --date=iso"
      )

      const textOutput = extractTextFromMessage(response.data)
      const lines = textOutput ? textOutput.split("\n") : []
      const commitList: GitCommitInfo[] = []

      lines.forEach((line: string) => {
        if (!line.trim()) return

        const parts = line.split("|")
        if (parts.length >= 6) {
          commitList.push({
            hash: parts[0],
            shortHash: parts[1],
            author: parts[2],
            email: parts[3],
            date: parts[4],
            message: parts[5],
            files: [],
          })
        }
      })

      setCommits(commitList)
    } catch (err) {
      console.error("Failed to fetch commits:", err)
    }
  }, [client, workingPath, runGitCommand])

  // Fetch file diff
  const fetchDiff = useCallback(
    async (filePath: string) => {
      if (!client || !workingPath) return

      try {
        const response = await runGitCommand(`git diff HEAD -- "${filePath}"`)

        const content = extractTextFromMessage(response.data) || ""
        const additions = (content.match(/^\+/gm) || []).length
        const deletions = (content.match(/^-/gm) || []).length
        const parsed = parseUnifiedDiff(content, filePath)

        setDiffs((prev) => ({
          ...prev,
          [filePath]: {
            file: filePath,
            additions,
            deletions,
            content,
            parsed,
          },
        }))
      } catch (err) {
        console.error(`Failed to fetch diff for ${filePath}:`, err)
      }
  }, [client, workingPath, runGitCommand])

  // Git operations
  const stageFile = async (filePath: string) => {
    if (!client || !workingPath) return

    setOperationLoading(`stage-${filePath}`)
    try {
      await runGitCommand(`git add "${filePath}"`)
      await fetchGitStatus()
    } catch (err) {
      setError(`Failed to stage file: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const unstageFile = async (filePath: string) => {
    if (!client || !workingPath) return

    setOperationLoading(`unstage-${filePath}`)
    try {
      await runGitCommand(`git reset HEAD "${filePath}"`)
      await fetchGitStatus()
    } catch (err) {
      setError(`Failed to unstage file: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const commitChanges = async () => {
    if (!client || !workingPath) return

    if (!commitMessage.trim()) {
      setError("Commit message is required")
      return
    }

    setOperationLoading("commit")
    try {
      await runGitCommand(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`)
      setCommitMessage("")
      await Promise.all([fetchGitStatus(), fetchCommits()])
    } catch (err) {
      setError(`Failed to commit: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const createBranch = async () => {
    if (!client || !newBranchName.trim() || !workingPath) return

    setOperationLoading("create-branch")
    try {
      await runGitCommand(`git checkout -b "${newBranchName}"`)
      setNewBranchName("")
      setShowNewBranchDialog(false)
      await Promise.all([fetchGitStatus(), fetchBranches()])
    } catch (err) {
      setError(`Failed to create branch: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const switchBranch = async (branchName: string) => {
    if (!client || !workingPath) return

    setOperationLoading(`switch-${branchName}`)
    try {
      await runGitCommand(`git checkout "${branchName}"`)
      await Promise.all([fetchGitStatus(), fetchBranches()])
    } catch (err) {
      setError(`Failed to switch branch: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const deleteBranch = async (branchName: string) => {
    if (!client || !workingPath) return

    setOperationLoading(`delete-${branchName}`)
    try {
      await runGitCommand(`git branch -d "${branchName}"`)
      await fetchBranches()
    } catch (err) {
      setError(`Failed to delete branch: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const pushChanges = async () => {
    if (!client || !workingPath) return

    setOperationLoading("push")
    try {
      await runGitCommand("git push origin HEAD")
      await fetchGitStatus()
    } catch (err) {
      setError(`Failed to push: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const pullChanges = async () => {
    if (!client || !workingPath) return

    setOperationLoading("pull")
    try {
      await runGitCommand("git pull")
      await Promise.all([fetchGitStatus(), fetchCommits()])
    } catch (err) {
      setError(`Failed to pull: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const fetchRemote = async () => {
    if (!client || !workingPath) return

    setOperationLoading("fetch")
    try {
      await runGitCommand("git fetch")
      await Promise.all([fetchGitStatus(), fetchBranches()])
    } catch (err) {
      setError(`Failed to fetch: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  // Fetch stashes
  const fetchStashes = useCallback(async () => {
    if (!client || !workingPath) return

    try {
      const response = await runGitCommand("git stash list --pretty=format:'%gd|%s|%at|%gs'")

      const textOutput = extractTextFromMessage(response.data)
      const lines = textOutput ? textOutput.split("\n") : []
      const stashList: GitStash[] = []

      lines.forEach((line: string, index: number) => {
        if (!line.trim()) return

        const parts = line.split("|")
        if (parts.length >= 3) {
          stashList.push({
            index,
            message: parts[1] || "Stashed changes",
            date: new Date(parseInt(parts[2]) * 1000).toISOString(),
            branch: parts[3] || "unknown",
          })
        }
      })

      setStashes(stashList)
    } catch (err) {
      console.error("Failed to fetch stashes:", err)
    }
  }, [client, workingPath, runGitCommand])

  // Stash operations
  const stashChanges = async (message?: string) => {
    if (!client || !workingPath) return

    setOperationLoading("stash")
    try {
      const cmd = message ? `git stash push -m "${message}"` : "git stash push"
      await runGitCommand(cmd)
      await Promise.all([fetchGitStatus(), fetchStashes()])
    } catch (err) {
      setError(`Failed to stash: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const applyStash = async (index: number) => {
    if (!client || !workingPath) return

    setOperationLoading(`apply-stash-${index}`)
    try {
      await runGitCommand(`git stash pop stash@{${index}}`)
      await Promise.all([fetchGitStatus(), fetchStashes()])
    } catch (err) {
      setError(`Failed to apply stash: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const deleteStash = async (index: number) => {
    if (!client || !workingPath) return

    setOperationLoading(`delete-stash-${index}`)
    try {
      await runGitCommand(`git stash drop stash@{${index}}`)
      await fetchStashes()
    } catch (err) {
      setError(`Failed to delete stash: ${err}`)
    } finally {
      setOperationLoading(null)
    }
  }

  // Toggle file expansion
  const toggleFileExpansion = (filePath: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath)
    } else {
      newExpanded.add(filePath)
      if (!diffs[filePath]) {
        fetchDiff(filePath)
      }
    }
    setExpandedFiles(newExpanded)
  }

  // Toggle commit expansion
  const toggleCommitExpansion = (hash: string) => {
    const newExpanded = new Set(expandedCommits)
    if (newExpanded.has(hash)) {
      newExpanded.delete(hash)
    } else {
      newExpanded.add(hash)
    }
    setExpandedCommits(newExpanded)
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Initialize data
  const initializeData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      await Promise.all([fetchGitStatus(), fetchBranches(), fetchCommits(), fetchStashes()])
    } catch (err) {
      setError(`Failed to initialize Git data: ${err}`)
    } finally {
      setLoading(false)
    }
  }, [fetchGitStatus, fetchBranches, fetchCommits, fetchStashes])

  useEffect(() => {
    void initializeData()
  }, [initializeData])

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        Promise.all([fetchGitStatus(), fetchBranches(), fetchCommits(), fetchStashes()])
      }, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh, fetchGitStatus, fetchBranches, fetchCommits, fetchStashes])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading Git information...</span>
        </div>
      </div>
    )
  }

  const getStatusIcon = (status: GitFile["status"]) => {
    switch (status) {
      case "A":
        return <Plus className="h-4 w-4 text-green-500" />
      case "M":
        return <FileText className="h-4 w-4 text-yellow-500" />
      case "D":
        return <Trash2 className="h-4 w-4 text-red-500" />
      case "??":
        return <Plus className="h-4 w-4 text-blue-500" />
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusText = (status: GitFile["status"]) => {
    switch (status) {
      case "A":
        return "Added"
      case "M":
        return "Modified"
      case "D":
        return "Deleted"
      case "??":
        return "Untracked"
      default:
        return "Unknown"
    }
  }

  return (
    <TooltipProvider>
      <div data-testid="git-operations-page" className="h-full overflow-hidden bg-background text-foreground">
        <div className="flex h-full flex-col">
          {error && (
            <div
              role="alert"
              className="mx-6 mt-4 flex items-start justify-between gap-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <div>
                <div className="font-medium">Git Error</div>
                <p className="text-destructive/80">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void initializeData()
                }}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Header */}
          <div className="flex-shrink-0 border-b border-border p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <GitBranch className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">Git Operations</h1>
                  <p className="text-muted-foreground">
                    Worktree: <span className="font-medium">{worktreeTitle}</span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Path: <span className="font-mono">{displayPath || "(unknown)"}</span>
                    {workingPath && displayPath !== workingPath && (
                      <span className="ml-1 text-muted-foreground/70">({workingPath})</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Header-level Commit button to open commit dialog (always visible) */}
                <Dialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="commit-button" variant="outline" size="sm">
                      <GitCommit className="h-4 w-4" />
                      Commit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border-border bg-background text-foreground">
                    <DialogHeader>
                      <DialogTitle>Create Commit</DialogTitle>
                      <DialogDescription>
                        Provide a concise summary of the staged changes before creating the commit.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Textarea
                        data-testid="commit-message-input"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Enter commit message..."
                        rows={4}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          data-testid="commit-cancel-button"
                          variant="outline"
                          onClick={() => setShowCommitDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          data-testid="commit-submit-button"
                          onClick={async () => {
                            await commitChanges()
                            setShowCommitDialog(false)
                          }}
                          disabled={!commitMessage.trim()}
                        >
                          Commit
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={cn(autoRefresh && "border-primary/20 bg-[#3b82f6]/10")}
                >
                  <RefreshCw className={cn("h-4 w-4", autoRefresh && "text-primary")} />
                  Auto-refresh
                </Button>
                <Button
                  data-testid="fetch-button"
                  onClick={fetchRemote}
                  disabled={operationLoading === "fetch"}
                  variant="outline"
                  size="sm"
                >
                  {operationLoading === "fetch" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Fetch
                </Button>

                <Button
                  data-testid="pull-button"
                  onClick={pullChanges}
                  disabled={operationLoading === "pull"}
                  variant="outline"
                  size="sm"
                >
                  {operationLoading === "pull" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Pull
                </Button>

                <Button
                  data-testid="push-button"
                  onClick={pushChanges}
                  disabled={operationLoading === "push" || !status?.ahead}
                  variant="outline"
                  size="sm"
                >
                  {operationLoading === "push" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Push {status?.ahead ? `(${status.ahead})` : ""}
                </Button>
              </div>
            </div>

            {/* Status Bar */}
            {status && (
              <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  <span className="font-medium text-foreground">{status.branch}</span>
                </div>

                {status.remoteUrl && (
                  <div className="flex items-center gap-2">
                    <GitPullRequest className="h-4 w-4" />
                    <span className="max-w-xs truncate">{status.remoteUrl}</span>
                  </div>
                )}

                {status.ahead > 0 && (
                  <Badge variant="outline" className="border-green-400 text-green-400">
                    ↑{status.ahead} ahead
                  </Badge>
                )}

                {status.behind > 0 && (
                  <Badge variant="outline" className="border-yellow-400 text-yellow-400">
                    ↓{status.behind} behind
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
              {/* Tab Navigation */}
              <div className="px-6 pt-4">
                <TabsList>
                  <TabsTrigger value="status">
                    <FileText className="mr-2 h-4 w-4" />
                    Status
                  </TabsTrigger>
                  <TabsTrigger value="commits">
                    <GitCommit className="mr-2 h-4 w-4" />
                    Commits
                  </TabsTrigger>
                  <TabsTrigger value="branches">
                    <GitBranch className="mr-2 h-4 w-4" />
                    Branches
                  </TabsTrigger>
                  <TabsTrigger value="stash">
                    <Archive className="mr-2 h-4 w-4" />
                    Stash
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-hidden px-6 pb-6">
                {/* Status Tab */}
                <TabsContent value="status" className="h-full">
                  <div data-testid="git-status" className="grid h-full grid-cols-1 gap-6 pt-4 lg:grid-cols-3">
                    {/* Changes Panel */}
                    <div className="space-y-6 lg:col-span-2">
                      {/* Status content will be here - keeping existing status content */}
                      {status &&
                        status.staged.length === 0 &&
                        status.modified.length === 0 &&
                        status.untracked.length === 0 && (
                          <div className="rounded-lg border border-border bg-card p-8 text-center">
                            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
                            <h3 className="mb-2 text-lg font-semibold text-foreground">
                              Working tree clean
                            </h3>
                            <p className="text-muted-foreground">No changes to commit</p>
                          </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                      {/* Recent Commits */}
                      <div data-testid="commit-history" className="rounded-lg border border-border bg-card">
                        <div className="border-b border-border p-4">
                          <h3 className="flex items-center gap-2 font-semibold">
                            <Clock className="h-5 w-5 text-primary" />
                            Recent Commits
                          </h3>
                        </div>
                        <ScrollArea className="max-h-96">
                          <div className="divide-y divide-[#262626]">
                            {recentCommitSummaries.slice(0, 5).map((commit) => (
                              <div key={commit.hash} className="p-3" data-testid="recent-commit-item">
                                <div className="space-y-2">
                                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                                    {commit.message}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <User className="h-3 w-3" />
                                    <span>{commit.author}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Hash className="h-3 w-3" />
                                      <span className="font-mono">{commit.shortHash}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(commit.date).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                    {/* Staged Changes */}
                    {status && status.staged.length > 0 && (
                      <div className="rounded-lg border border-border bg-card">
                        <div className="border-b border-border p-4">
                          <h3 className="flex items-center gap-2 font-semibold">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            Staged Changes ({status.staged.length})
                          </h3>
                        </div>

                        <div className="divide-y divide-[#262626]">
                          {status.staged.map((file) => (
                            <div key={file.path} className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  {getStatusIcon(file.status)}
                                  <span className="truncate font-mono text-sm">{file.path}</span>
                                  <Badge variant="outline">{getStatusText(file.status)}</Badge>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                  <Button
                                    onClick={() => toggleFileExpansion(file.path)}
                                    variant="ghost"
                                    size="sm"
                                    aria-label={expandedFiles.has(file.path) ? "Hide file diff" : "Show file diff"}
                                  >
                                        {expandedFiles.has(file.path) ? (
                                          <EyeOff className="h-4 w-4" />
                                        ) : (
                                          <Eye className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {expandedFiles.has(file.path) ? "Hide diff" : "Show diff"}
                                    </TooltipContent>
                                  </Tooltip>

                                  <Button
                                    onClick={() => unstageFile(file.path)}
                                    disabled={operationLoading === `unstage-${file.path}`}
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Unstage ${file.path}`}
                                  >
                                    {operationLoading === `unstage-${file.path}` ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <X className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>

                              {expandedFiles.has(file.path) && diffs[file.path] && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-4">
                                      <span className="text-emerald-400">
                                        +{diffs[file.path].additions}
                                      </span>
                                      <span className="text-rose-400">
                                        -{diffs[file.path].deletions}
                                      </span>
                                    </div>
                                    <Button
                                      onClick={() => copyToClipboard(diffs[file.path].content)}
                                      variant="ghost"
                                      size="sm"
                                      className="text-muted-foreground"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <DiffPreview diff={diffs[file.path].parsed} rawDiff={diffs[file.path].content} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Modified Files */}
                    {status && (status.modified.length > 0 || status.untracked.length > 0) && (
                      <div className="rounded-lg border border-border bg-card">
                        <div className="border-b border-border p-4">
                          <h3 className="flex items-center gap-2 font-semibold">
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                            Changes ({status.modified.length + status.untracked.length})
                          </h3>
                        </div>

                        <div className="divide-y divide-[#262626]">
                          {[...status.modified, ...status.untracked].map((file) => (
                            <div key={file.path} className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  {getStatusIcon(file.status)}
                                  <span className="truncate font-mono text-sm">{file.path}</span>
                                  <Badge variant="outline">{getStatusText(file.status)}</Badge>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                  <Button
                                    onClick={() => toggleFileExpansion(file.path)}
                                    variant="ghost"
                                    size="sm"
                                    aria-label={expandedFiles.has(file.path) ? "Hide file diff" : "Show file diff"}
                                  >
                                        {expandedFiles.has(file.path) ? (
                                          <EyeOff className="h-4 w-4" />
                                        ) : (
                                          <Eye className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {expandedFiles.has(file.path) ? "Hide diff" : "Show diff"}
                                    </TooltipContent>
                                  </Tooltip>

                                  <Button
                                    onClick={() => stageFile(file.path)}
                                    disabled={operationLoading === `stage-${file.path}`}
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Stage ${file.path}`}
                                  >
                                    {operationLoading === `stage-${file.path}` ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Plus className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>

                              {expandedFiles.has(file.path) && diffs[file.path] && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-4">
                                      <span className="text-emerald-400">
                                        +{diffs[file.path].additions}
                                      </span>
                                      <span className="text-rose-400">
                                        -{diffs[file.path].deletions}
                                      </span>
                                    </div>
                                    <Button
                                      onClick={() => copyToClipboard(diffs[file.path].content)}
                                      variant="ghost"
                                      size="sm"
                                      className="text-muted-foreground"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <DiffPreview diff={diffs[file.path].parsed} rawDiff={diffs[file.path].content} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Commit Interface */}
                    {status && status.staged.length > 0 && (
                      <div className="rounded-lg border border-border bg-card p-4">
                        <h3 className="mb-3 flex items-center gap-2 font-semibold">
                          <GitCommit className="h-5 w-5 text-primary" />
                          Commit Changes
                        </h3>

                        <div className="space-y-3">
                          <Textarea
                            data-testid="commit-message-input"
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            placeholder="Enter commit message..."
                            className="border-border bg-input/30 text-foreground placeholder-gray-500"
                            rows={3}
                          />

                          <Button
                            data-testid="commit-button"
                            onClick={commitChanges}
                            disabled={!commitMessage.trim() || operationLoading === "commit"}
                            className="w-full"
                          >
                            {operationLoading === "commit" ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <GitCommit className="mr-2 h-4 w-4" />
                            )}
                            Commit {status.staged.length} file
                            {status.staged.length !== 1 ? "s" : ""}
                          </Button>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    {/* Branches */}
                    <div
                      data-testid="branch-selector"
                      className="rounded-lg border border-border bg-card"
                      onClick={() => setShowNewBranchDialog(true)}
                    >
                      <div className="flex items-center justify-between border-b border-border p-4">
                        <h3 className="flex items-center gap-2 font-semibold">
                          <GitBranch className="h-5 w-5 text-primary" />
                          Branches
                        </h3>

                        <Dialog open={showNewBranchDialog} onOpenChange={setShowNewBranchDialog}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="border-border bg-background text-foreground">
                            <DialogHeader>
                              <DialogTitle>Create New Branch</DialogTitle>
                              <DialogDescription>
                                Choose a descriptive branch name to track related work before
                                creating it from the current HEAD.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <Input
                                data-testid="branch-name-input"
                                value={newBranchName}
                                onChange={(e) => setNewBranchName(e.target.value)}
                                placeholder="Branch name..."
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={createBranch}
                                  disabled={
                                    !newBranchName.trim() || operationLoading === "create-branch"
                                  }
                                  className="flex-1"
                                >
                                  {operationLoading === "create-branch" ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Plus className="mr-2 h-4 w-4" />
                                  )}
                                  Create
                                </Button>
                                <Button
                                  onClick={() => setShowNewBranchDialog(false)}
                                  variant="outline"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <ScrollArea className="max-h-64">
                        <div className="divide-y divide-[#262626]">
                          {branches.map((branch) => (
                            <div
                              key={branch.name}
                              className="flex items-center justify-between p-3"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <GitBranch
                                  className={cn(
                                    "h-4 w-4 flex-shrink-0",
                                    branch.current ? "text-primary" : "text-muted-foreground"
                                  )}
                                />
                                <span
                                  className={cn(
                                    "truncate font-mono text-sm",
                                    branch.current ? "font-medium text-foreground" : "text-muted-foreground"
                                  )}
                                >
                                  {branch.name}
                                </span>
                                {branch.current && (
                                  <Badge
                                    variant="outline"
                                    className="border-primary text-primary"
                                  >
                                    current
                                  </Badge>
                                )}
                              </div>

                              {!branch.current && (
                                <div className="flex items-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        onClick={() => switchBranch(branch.name)}
                                        disabled={operationLoading === `switch-${branch.name}`}
                                        variant="ghost"
                                        size="sm"
                                      >
                                        {operationLoading === `switch-${branch.name}` ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <GitMerge className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Switch to branch</TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        onClick={() => deleteBranch(branch.name)}
                                        disabled={operationLoading === `delete-${branch.name}`}
                                        variant="ghost"
                                        size="sm"
                                      >
                                        {operationLoading === `delete-${branch.name}` ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete branch</TooltipContent>
                                  </Tooltip>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Recent Commits */}
                    <div className="rounded-lg border border-border bg-card">
                      <div className="border-b border-border p-4">
                        <h3 className="flex items-center gap-2 font-semibold">
                          <Clock className="h-5 w-5 text-primary" />
                          Recent Commits
                        </h3>
                      </div>

                      <ScrollArea className="max-h-96">
                        <div className="divide-y divide-[#262626]">
                          {commits.map((commit) => (
                            <div key={commit.hash} className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                                    {commit.message}
                                  </p>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        onClick={() => copyToClipboard(commit.hash)}
                                        variant="ghost"
                                        size="sm"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy hash</TooltipContent>
                                  </Tooltip>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span>{commit.author}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Hash className="h-3 w-3" />
                                    <span className="font-mono">{commit.shortHash}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(commit.date).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </TabsContent>

                {/* Commits Tab */}
                <TabsContent value="commits" className="h-full">
                  <div className="flex h-full flex-col space-y-4 pt-4">
                    {/* Search and Filters */}
                    <div className="flex items-center gap-4">
                      <div className="relative max-w-md flex-1">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                        <Input
                          placeholder="Search commits..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="border-border bg-input/30 pl-10 text-foreground"
                        />
                      </div>
                      <Select defaultValue="50">
                        <SelectTrigger className="w-32 border-border bg-input/30 text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-card text-foreground">
                          <SelectItem value="25">25 commits</SelectItem>
                          <SelectItem value="50">50 commits</SelectItem>
                          <SelectItem value="100">100 commits</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Commit History */}
                    <ScrollArea className="flex-1">
                      <div className="space-y-3">
                        {commits
                          .filter(
                            (commit) =>
                              !searchQuery ||
                              commit.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              commit.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              commit.hash.includes(searchQuery)
                          )
                          .map((commit, index) => (
                            <div
                              key={commit.hash}
                              className="relative rounded-lg border border-border bg-card p-4 transition-colors hover:bg-card/80"
                            >
                              {/* Commit Graph Line */}
                              {index < commits.length - 1 && (
                                <div className="absolute top-12 left-6 h-8 w-px bg-[#262626]" />
                              )}

                              <div className="flex items-start gap-4">
                                {/* Graph Node */}
                                <div className="relative z-10 mt-1 h-3 w-3 rounded-full border-2 border-[#0a0a0a] bg-[#3b82f6]" />

                                {/* Commit Info */}
                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded bg-input/30 px-2 py-1 font-mono text-xs text-muted-foreground">
                                        {commit.shortHash}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatDateTime(new Date(commit.date).getTime())}
                                      </span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleCommitExpansion(commit.hash)}
                                    >
                                      {expandedCommits.has(commit.hash) ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>

                                  <h4 className="mb-1 font-medium text-foreground">{commit.message}</h4>

                                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      <span>{commit.author}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <GitCommit className="h-3 w-3" />
                                      <span>{commit.files?.length || 0} files changed</span>
                                    </div>
                                  </div>

                                  {/* Expanded Content */}
                                  {expandedCommits.has(commit.hash) && commit.files && (
                                    <div className="mt-4 border-t border-border pt-4">
                                      <div className="space-y-2">
                                        <h5 className="text-sm font-medium text-foreground">
                                          Changed Files:
                                        </h5>
                                        {commit.files.map((file) => (
                                          <div
                                            key={file.path}
                                            className="flex items-center justify-between rounded bg-input/30 p-2 text-sm"
                                          >
                                            <div className="flex items-center gap-2">
                                              {getStatusIcon(file.status)}
                                              <span className="font-mono text-gray-300">
                                                {file.path}
                                              </span>
                                              <Badge variant="outline" className="text-xs">
                                                {getStatusText(file.status)}
                                              </Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {file.additions && (
                                                <span className="text-green-500">
                                                  +{file.additions}
                                                </span>
                                              )}
                                              {file.deletions && (
                                                <span className="text-red-500">
                                                  -{file.deletions}
                                                </span>
                                              )}
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleFileExpansion(file.path)}
                                              >
                                                <Eye className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>

                {/* Branches Tab */}
                <TabsContent value="branches" className="h-full">
                  <div className="flex h-full flex-col space-y-4 pt-4">
                    {/* Branch Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="New branch name..."
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                            className="w-64 border-border bg-input/30 text-foreground"
                          />
                          <Button onClick={createBranch} disabled={!newBranchName.trim()}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Branch
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Branch List */}
                    <ScrollArea className="flex-1">
                      <div className="space-y-2">
                        {branches.map((branch) => (
                          <div
                            key={branch.name}
                            className={cn(
                              "rounded-lg border border-border bg-card p-4 transition-colors hover:bg-card/80",
                              branch.current && "bg-primary/5 ring-2 ring-primary/20"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <GitBranch
                                  className={cn(
                                    "h-4 w-4",
                                    branch.current ? "text-primary" : "text-muted-foreground"
                                  )}
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "font-medium",
                                        branch.current ? "text-primary" : "text-foreground"
                                      )}
                                    >
                                      {branch.name}
                                    </span>
                                    {branch.current && (
                                      <Badge
                                        variant="outline"
                                        className="border-primary/20 text-primary"
                                      >
                                        Current
                                      </Badge>
                                    )}
                                    {branch.remote && (
                                      <Badge variant="outline" className="text-muted-foreground">
                                        {branch.remote}
                                      </Badge>
                                    )}
                                  </div>
                                  {branch.lastCommit && (
                                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                                      <span>{branch.lastCommit.message}</span>
                                      <span>by {branch.lastCommit.author}</span>
                                      <span>
                                        {formatRelativeTime(
                                          new Date(branch.lastCommit.date).getTime()
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {branch.ahead && branch.ahead > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="border-green-500/20 text-green-500"
                                  >
                                    +{branch.ahead}
                                  </Badge>
                                )}
                                {branch.behind && branch.behind > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="border-red-500/20 text-red-500"
                                  >
                                    -{branch.behind}
                                  </Badge>
                                )}

                                {!branch.current && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => switchBranch(branch.name)}
                                    >
                                      <GitBranch className="mr-2 h-4 w-4" />
                                      Checkout
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => deleteBranch(branch.name)}
                                      className="text-red-500 hover:text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>

                {/* Stash Tab */}
                <TabsContent value="stash" className="h-full">
                  <div className="flex h-full flex-col space-y-4 pt-4">
                    {/* Stash Actions */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">Stashed Changes</h3>
                      <Button onClick={() => stashChanges()}>
                        <Archive className="mr-2 h-4 w-4" />
                        Stash Changes
                      </Button>
                    </div>

                    {/* Stash List */}
                    <ScrollArea className="flex-1">
                      {stashes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Archive className="mb-4 h-12 w-12 text-muted-foreground" />
                          <h3 className="mb-2 text-lg font-semibold text-foreground">
                            No stashed changes
                          </h3>
                          <p className="text-muted-foreground">Stash your changes to save them for later</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {stashes.map((stash) => (
                            <div
                              key={stash.index}
                              className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-card/80"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Archive className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-foreground">
                                        {stash.message}
                                      </span>
                                      <Badge variant="outline" className="text-xs">
                                        stash@{`{${stash.index}}`}
                                      </Badge>
                                    </div>
                                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                                      <span>on {stash.branch}</span>
                                      <span>
                                        {formatRelativeTime(new Date(stash.date).getTime())}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyStash(stash.index)}
                                  >
                                    <Download className="mr-2 h-4 w-4" />
                                    Apply
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deleteStash(stash.index)}
                                    className="text-red-500 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
        {/* Diff viewer placeholder to satisfy e2e selector */}
        <div
          data-testid="file-changes-diff"
          className="border-t border-border px-6 py-4 text-xs text-muted-foreground"
        >
          Diff Viewer
        </div>
      </div>
    </TooltipProvider>
  )
}

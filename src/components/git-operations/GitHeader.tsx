import { GitBranch, GitPullRequest, RefreshCw, Download, Upload, Loader2 } from "lucide-react"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { cn } from "@/lib/utils"

interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: ReadonlyArray<Record<string, unknown>>
  modified: ReadonlyArray<Record<string, unknown>>
  untracked: ReadonlyArray<Record<string, unknown>>
  remoteUrl?: string
}

interface GitHeaderProps {
  status: GitStatus | null
  autoRefresh: boolean
  operationLoading: string | null
  onToggleAutoRefresh: () => void
  onFetch: () => void
  onPull: () => void
  onPush: () => void
}

export function GitHeader({
  status,
  autoRefresh,
  operationLoading,
  onToggleAutoRefresh,
  onFetch,
  onPull,
  onPush,
}: GitHeaderProps) {
  return (
    <div className="flex-shrink-0 border-b border-[#262626] p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <GitBranch className="h-6 w-6 text-[#3b82f6]" />
          <div>
            <h1 className="text-2xl font-bold">Git Operations</h1>
            <p className="text-gray-400">Manage your Git repository</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAutoRefresh}
            className={cn(autoRefresh && "border-[#3b82f6]/20 bg-[#3b82f6]/10")}
          >
            <RefreshCw className={cn("h-4 w-4", autoRefresh && "text-[#3b82f6]")} />
            Auto-refresh
          </Button>
          <Button
            onClick={onFetch}
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
            onClick={onPull}
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
            onClick={onPush}
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
        <div className="mt-4 flex items-center gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            <span className="font-medium text-white">{status.branch}</span>
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
  )
}

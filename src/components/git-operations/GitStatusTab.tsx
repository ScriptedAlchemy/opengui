import {
  CheckCircle,
  Clock,
  User,
  Hash,
  Eye,
  EyeOff,
  Loader2,
  X,
  Plus,
  FileText,
} from "lucide-react"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { ScrollArea } from "../ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"

interface GitFile {
  path: string
  status: "A" | "M" | "D" | "R" | "C" | "U" | "??"
  staged: boolean
  additions?: number
  deletions?: number
}

interface GitCommit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  message: string
  files: GitFile[]
  parents?: string[]
}

interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: GitFile[]
  modified: GitFile[]
  untracked: GitFile[]
  remoteUrl?: string
}

interface GitStatusTabProps {
  status: GitStatus | null
  commits: GitCommit[]
  expandedFiles: Set<string>
  operationLoading: string | null
  onToggleFileExpansion: (path: string) => void
  onStageFile: (path: string) => void
  onUnstageFile: (path: string) => void
  onDiscardFile: (path: string) => void
  getStatusIcon: (status: string) => JSX.Element
  getStatusText: (status: string) => string
}

export function GitStatusTab({
  status,
  commits,
  expandedFiles,
  operationLoading,
  onToggleFileExpansion,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  getStatusIcon,
  getStatusText,
}: GitStatusTabProps) {
  return (
    <div className="grid h-full grid-cols-1 gap-6 pt-4 lg:grid-cols-3">
      {/* Changes Panel */}
      <div className="space-y-6 lg:col-span-2">
        {/* Clean working tree message */}
        {status &&
          status.staged.length === 0 &&
          status.modified.length === 0 &&
          status.untracked.length === 0 && (
            <div className="rounded-lg border border-[#262626] bg-[#1a1a1a] p-8 text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h3 className="mb-2 text-lg font-semibold text-white">Working tree clean</h3>
              <p className="text-gray-400">No changes to commit</p>
            </div>
          )}

        {/* Staged Changes */}
        {status && status.staged.length > 0 && (
          <div className="rounded-lg border border-[#262626] bg-[#1a1a1a]">
            <div className="border-b border-[#262626] p-4">
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
                            onClick={() => onToggleFileExpansion(file.path)}
                            variant="ghost"
                            size="sm"
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
                        onClick={() => onUnstageFile(file.path)}
                        disabled={operationLoading === `unstage-${file.path}`}
                        variant="ghost"
                        size="sm"
                      >
                        {operationLoading === `unstage-${file.path}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modified Files */}
        {status && status.modified.length > 0 && (
          <div className="rounded-lg border border-[#262626] bg-[#1a1a1a]">
            <div className="border-b border-[#262626] p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <FileText className="h-5 w-5 text-yellow-500" />
                Modified Files ({status.modified.length})
              </h3>
            </div>

            <div className="divide-y divide-[#262626]">
              {status.modified.map((file) => (
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
                            onClick={() => onToggleFileExpansion(file.path)}
                            variant="ghost"
                            size="sm"
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
                        onClick={() => onStageFile(file.path)}
                        disabled={operationLoading === `stage-${file.path}`}
                        variant="ghost"
                        size="sm"
                      >
                        {operationLoading === `stage-${file.path}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        onClick={() => onDiscardFile(file.path)}
                        disabled={operationLoading === `discard-${file.path}`}
                        variant="ghost"
                        size="sm"
                      >
                        {operationLoading === `discard-${file.path}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Untracked Files */}
        {status && status.untracked.length > 0 && (
          <div className="rounded-lg border border-[#262626] bg-[#1a1a1a]">
            <div className="border-b border-[#262626] p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <Plus className="h-5 w-5 text-blue-500" />
                Untracked Files ({status.untracked.length})
              </h3>
            </div>

            <div className="divide-y divide-[#262626]">
              {status.untracked.map((file) => (
                <div key={file.path} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {getStatusIcon(file.status)}
                      <span className="truncate font-mono text-sm">{file.path}</span>
                      <Badge variant="outline">{getStatusText(file.status)}</Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => onStageFile(file.path)}
                        disabled={operationLoading === `stage-${file.path}`}
                        variant="ghost"
                        size="sm"
                      >
                        {operationLoading === `stage-${file.path}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Recent Commits */}
        <div className="rounded-lg border border-[#262626] bg-[#1a1a1a]">
          <div className="border-b border-[#262626] p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Clock className="h-5 w-5 text-[#3b82f6]" />
              Recent Commits
            </h3>
          </div>
          <ScrollArea className="max-h-96">
            <div className="divide-y divide-[#262626]">
              {commits.slice(0, 5).map((commit) => (
                <div key={commit.hash} className="p-3">
                  <div className="space-y-2">
                    <p className="line-clamp-2 text-sm font-medium text-white">{commit.message}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <User className="h-3 w-3" />
                      <span>{commit.author}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Hash className="h-3 w-3" />
                        <span className="font-mono">{commit.shortHash}</span>
                      </div>
                      <span className="text-xs text-gray-500">
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
    </div>
  )
}

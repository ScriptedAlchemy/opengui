import {
  Edit,
  Trash2,
  Play,
  Copy,
  MoreHorizontal,
  Eye,
  Clock,
  Activity,
  Cpu,
  Code,
  Terminal,
  FileText,
  Search,
  Globe,
  Download,
  Bot,
  type LucideIcon,
} from "lucide-react"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import type { AgentInfo } from "@/lib/api/types"
import { formatAgentModelLabel } from "@/util/agents"

const toolIcons: Record<string, LucideIcon> = {
  bash: Terminal,
  edit: Edit,
  read: FileText,
  write: FileText,
  glob: Search,
  grep: Search,
  list: FileText,
  webfetch: Globe,
}

interface AgentCardProps {
  name: string
  agent: AgentInfo
  onEdit: (name: string) => void
  onDelete: (name: string) => void
  onTest: (name: string) => void
  onDuplicate: (name: string) => void
  onExportMarkdown?: (name: string) => void
}

export function AgentCard({
  name,
  agent,
  onEdit,
  onDelete,
  onTest,
  onDuplicate,
  onExportMarkdown,
}: AgentCardProps) {
  const modelLabel = formatAgentModelLabel(agent)
  return (
    <div
      className="bg-card text-card-foreground rounded-lg border border-border p-6 transition-colors hover:border-primary/30 bg-[#1a1a1a] border-[#262626]"
      data-testid="agent-item"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-lg font-semibold">{name}</h3>
              {agent.builtIn ? (
                <Badge variant="outline" className="border-primary text-xs text-primary">
                  Built-in
                </Badge>
              ) : null}
              <Badge variant="outline" className="border-border text-xs capitalize">
                {(agent.mode as string) || "unknown"}
              </Badge>
            </div>
            {agent.description && (
              <p className="mb-1 line-clamp-2 text-sm text-muted-foreground">{agent.description}</p>
            )}
            {modelLabel ? (
              <div className="mb-3 text-xs text-muted-foreground">{modelLabel}</div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            title="Test agent"
            onClick={() => onTest(name)}
            className="border-border px-2"
          >
            <Play className="mr-2 h-4 w-4" />
            Test
          </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-border bg-popover text-popover-foreground">
            <DropdownMenuItem
              onClick={() => onTest(name)}
              aria-label="Test agent"
              className="hover:bg-accent/10"
            >
              <Play className="mr-2 h-4 w-4" />
              Test Agent
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDuplicate(name)}
              aria-label="Copy config"
              className="hover:bg-accent/10"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Config
            </DropdownMenuItem>
            {onExportMarkdown && (
              <DropdownMenuItem
                onClick={() => onExportMarkdown(name)}
                aria-label="Export as markdown"
                className="hover:bg-accent/10"
              >
                <Download className="mr-2 h-4 w-4" />
                Export as MD
              </DropdownMenuItem>
            )}
            {!agent.builtIn && (
              <>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => onEdit(name)}
                  className="hover:bg-accent/10"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(name)}
                  className="text-red-400 hover:bg-accent/10 hover:text-red-300"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Tools */}
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(agent.tools || {})
          .filter(([_, enabled]) => enabled)
          .slice(0, 4)
          .map(([tool]) => {
            const Icon = toolIcons[tool] || Code
            return (
              <Tooltip key={tool}>
                <TooltipTrigger>
                  <div className="flex items-center gap-1 rounded bg-muted/20 border border-border px-2 py-1 text-xs text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    {tool}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tool} tool enabled</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        {Object.entries(agent.tools || {}).filter(([_, enabled]) => enabled).length > 4 && (
          <div className="rounded bg-muted/20 border border-border px-2 py-1 text-xs text-muted-foreground">
            +{Object.entries(agent.tools || {}).filter(([_, enabled]) => enabled).length - 4} more
          </div>
        )}
      </div>

      {/* System Prompt Preview */}
      {agent.prompt && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 h-auto p-0 text-muted-foreground hover:text-foreground"
            >
              <Eye className="mr-2 h-4 w-4" />
              Show System Prompt
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 max-h-32 overflow-y-auto rounded border border-border bg-input/30 p-3 text-sm text-muted-foreground">
              <pre className="font-mono text-xs whitespace-pre-wrap">{agent.prompt}</pre>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Quick Stats */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded bg-muted/20 border border-border px-2 py-1">
            <Cpu className="h-3 w-3" />
            <span>Temp {agent.temperature || 0.7}</span>
          </div>
          {Object.values(agent.tools || {}).filter(Boolean).length > 0 && (
            <div className="flex items-center gap-1 rounded bg-muted/20 border border-border px-2 py-1">
              <Activity className="h-3 w-3" />
              <span>Tools {Object.values(agent.tools || {}).filter(Boolean).length}</span>
            </div>
          )}
        </div>
        {!agent.builtIn && (
          <div className="flex items-center gap-1 rounded bg-muted/20 border border-border px-2 py-1">
            <Clock className="h-3 w-3" />
            <span>Source Custom</span>
          </div>
        )}
      </div>
    </div>
  )
}

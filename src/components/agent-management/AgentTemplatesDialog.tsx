import { Sparkles, type LucideIcon } from "lucide-react"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog"
import type { Permission } from "@/lib/api/types"

interface AgentFormData {
  name: string
  description: string
  prompt: string
  mode: "subagent" | "primary" | "all"
  temperature?: number
  topP?: number
  tools: Record<string, boolean>
  permissions: {
    edit: Permission
    bash: Record<string, Permission>
    webfetch?: Permission
  }
}

interface AgentTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: LucideIcon
  prompt: string
  tools: Record<string, boolean>
  permissions: AgentFormData["permissions"]
  mode: AgentFormData["mode"]
  temperature?: number
  topP?: number
}

interface AgentTemplatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplyTemplate: (template: AgentTemplate) => void
  templates: AgentTemplate[]
}

export function AgentTemplatesDialog({
  open,
  onOpenChange,
  onApplyTemplate,
  templates,
}: AgentTemplatesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="agent-templates-dialog"
        className="max-h-[80vh] max-w-4xl overflow-y-auto border-[#262626] bg-[#1a1a1a]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#3b82f6]" />
            Agent Templates
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.map((template) => {
            const Icon = template.icon
            return (
              <div
                key={template.id}
                data-testid={`template-${template.id}`}
                className="cursor-pointer rounded-lg border border-[#262626] bg-[#0a0a0a] p-4 transition-colors hover:border-[#3b82f6]/30"
                onClick={() => onApplyTemplate(template)}
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3b82f6]/20">
                    <Icon className="h-4 w-4 text-[#3b82f6]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{template.name}</h3>
                    <Badge variant="outline" className="mt-1 border-[#262626] text-xs">
                      {template.category}
                    </Badge>
                  </div>
                </div>
                <p className="mb-3 text-sm text-gray-400">{template.description}</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(template.tools)
                    .filter(([_, enabled]) => enabled)
                    .slice(0, 3)
                    .map(([tool]) => (
                      <div
                        key={tool}
                        className="rounded bg-[#262626] px-2 py-1 text-xs text-gray-300"
                      >
                        {tool}
                      </div>
                    ))}
                  {Object.entries(template.tools).filter(([_, enabled]) => enabled).length > 3 && (
                    <div className="rounded bg-[#262626] px-2 py-1 text-xs text-gray-300">
                      +{Object.entries(template.tools).filter(([_, enabled]) => enabled).length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#262626] bg-[#1a1a1a] hover:bg-[#2a2a2a]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type { AgentTemplate }

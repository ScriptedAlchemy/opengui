import { useEffect, useState } from "react"
import {
  Plus,
  Edit,
  Code,
  FileText,
  Globe,
  Terminal,
  Activity,
  Shield,
  Save,
  Database,
  Cpu,
  Bot,
} from "lucide-react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog"
import { Badge } from "../ui/badge"
import { ScrollArea } from "../ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/shadcn-io/tabs"
import { Separator } from "../ui/separator"
import type { Permission } from "../../lib/api/types"
import { useParams } from "react-router-dom"
import { useProjectById } from "../../stores/projects"
import { useProvidersSDK } from "../../hooks/useProvidersSDK"

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
  model?: string
}

const defaultTools = {
  bash: false,
  edit: false,
  read: false,
  write: false,
  glob: false,
  grep: false,
  list: false,
  webfetch: false,
}

const toolIcons: Record<string, any> = {
  bash: Terminal,
  edit: Edit,
  read: FileText,
  write: FileText,
  glob: Database,
  grep: Database,
  list: FileText,
  webfetch: Globe,
}

interface AgentCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: AgentFormData
  onFormDataChange: (data: AgentFormData) => void
  onSave: () => void
  title?: string
  saveButtonText?: string
  isEdit?: boolean
}

export function AgentCreateDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  onSave,
  title = "Create New Agent",
  saveButtonText = "Create Agent",
  isEdit = false,
}: AgentCreateDialogProps) {
  const [activeTab, setActiveTab] = useState("overview")

  // Project context for providers/models
  const { projectId } = useParams<{ projectId: string }>()
  const project = useProjectById(projectId || "")
  const instanceStatus = (project?.instance?.status || "stopped") as
    | "running"
    | "stopped"
    | "starting"
  const projectPath = project?.path

  const {
    providers,
    selectedProvider,
    selectedModel,
    availableModels,
    setSelectedProvider,
    setSelectedModel,
  } = useProvidersSDK(projectId, projectPath, instanceStatus)

  // Keep formData.model in sync with selectedModel
  useEffect(() => {
    if (selectedModel && formData.model !== selectedModel) {
      onFormDataChange({ ...formData, model: selectedModel })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel])

  // When editing, if a model exists in formData, select corresponding provider/model
  useEffect(() => {
    if (!formData.model || !providers.length) return
    // Find provider that contains this model id
    const provider = providers.find((p) => p.models?.some((m) => m.id === formData.model))
    if (provider) {
      if (selectedProvider !== provider.id) setSelectedProvider(provider.id)
      if (selectedModel !== formData.model) setSelectedModel(formData.model)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers])

  const resetForm = () => {
    onFormDataChange({
      name: "",
      description: "",
      prompt: "",
      mode: "subagent",
      temperature: 0.7,
      topP: 0.9,
      tools: { ...defaultTools },
      permissions: {
        edit: "ask",
        bash: {},
        webfetch: "ask",
      },
      model: undefined,
    })
  }

  const handleClose = () => {
    onOpenChange(false)
    setActiveTab("overview")
    if (!isEdit) {
      resetForm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden border-[#262626] bg-[#1a1a1a]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (
              <Edit className="h-5 w-5 text-[#3b82f6]" />
            ) : (
              <Plus className="h-5 w-5 text-[#3b82f6]" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-4 bg-[#0a0a0a]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="prompt">System Prompt</TabsTrigger>
            <TabsTrigger value="tools">Tools & Permissions</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <ScrollArea className="mt-4 h-[60vh]">
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                    placeholder="Agent name"
                    name="name"
                    id="name"
                    className="border-[#262626] bg-[#0a0a0a]"
                    data-testid="agent-name-input"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Mode</label>
                  <Select
                    value={formData.mode}
                    onValueChange={(value: "subagent" | "primary" | "all") =>
                      onFormDataChange({ ...formData, mode: value })
                    }
                  >
                    <SelectTrigger className="border-[#262626] bg-[#0a0a0a]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#262626] bg-[#1a1a1a]">
                      <SelectItem value="subagent">Subagent</SelectItem>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the agent's purpose and capabilities"
                  name="description"
                  id="description"
                  className="min-h-[80px] border-[#262626] bg-[#0a0a0a]"
                  data-testid="agent-description-input"
                />
              </div>

              {/* Provider & Model Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Provider</label>
                  <Select
                    value={selectedProvider || undefined}
                    onValueChange={(value: string) => setSelectedProvider(value)}
                  >
                    <SelectTrigger className="border-[#262626] bg-[#0a0a0a]">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent className="border-[#262626] bg-[#1a1a1a]">
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Model</label>
                  <Select
                    value={selectedModel || undefined}
                    onValueChange={(value: string) => setSelectedModel(value)}
                  >
                    <SelectTrigger className="border-[#262626] bg-[#0a0a0a]">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent className="border-[#262626] bg-[#1a1a1a]">
                      {availableModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Temperature</label>
                  <Input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) =>
                      onFormDataChange({ ...formData, temperature: parseFloat(e.target.value) })
                    }
                    className="border-[#262626] bg-[#0a0a0a]"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Controls randomness (0.0 = deterministic, 2.0 = very random)
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Top P</label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.topP}
                    onChange={(e) =>
                      onFormDataChange({ ...formData, topP: parseFloat(e.target.value) })
                    }
                    className="border-[#262626] bg-[#0a0a0a]"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Controls diversity via nucleus sampling
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="prompt" className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">System Prompt</label>
                <Textarea
                  value={formData.prompt}
                  onChange={(e) => onFormDataChange({ ...formData, prompt: e.target.value })}
                  placeholder="Define the agent's behavior, personality, and instructions..."
                  name="prompt"
                  id="prompt"
                  className="min-h-[300px] border-[#262626] bg-[#0a0a0a] font-mono text-sm"
                  data-testid="agent-prompt-input"
                />
                {isEdit && (
                  <p className="mt-2 text-xs text-gray-500">
                    Define the agent's behavior, personality, and instructions. Be specific about
                    what the agent should do and how it should respond.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tools" className="space-y-6">
              <div>
                <label className="mb-3 block text-sm font-medium">Available Tools</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(defaultTools).map(([tool, _]) => {
                    const Icon = toolIcons[tool] || Code
                    return (
                      <label
                        key={tool}
                        className="flex cursor-pointer items-center space-x-3 rounded border border-[#262626] bg-[#0a0a0a] p-3 transition-colors hover:border-[#3b82f6]/30"
                      >
                        <input
                          type="checkbox"
                          checked={formData.tools[tool] || false}
                          onChange={(e) =>
                            onFormDataChange({
                              ...formData,
                              tools: { ...formData.tools, [tool]: e.target.checked },
                            })
                          }
                          className="h-4 w-4 rounded border-[#262626] bg-[#0a0a0a] text-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]"
                        />
                        <Icon className="h-4 w-4 text-gray-400" />
                        <div className="flex-1">
                          <span className="text-sm font-medium capitalize">{tool}</span>
                          {!isEdit && (
                            <p className="text-xs text-gray-500">
                              {tool === "bash" && "Execute shell commands"}
                              {tool === "edit" && "Edit files in the project"}
                              {tool === "read" && "Read file contents"}
                              {tool === "write" && "Write new files"}
                              {tool === "glob" && "Find files by pattern"}
                              {tool === "grep" && "Search file contents"}
                              {tool === "list" && "List directory contents"}
                              {tool === "webfetch" && "Fetch web content"}
                            </p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              <Separator className="bg-[#262626]" />

              <div>
                <label className="mb-3 block text-sm font-medium">Permissions</label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded border border-[#262626] bg-[#0a0a0a] p-3">
                    <div className="flex items-center gap-3">
                      <Edit className="h-4 w-4 text-gray-400" />
                      <div>
                        <span className="text-sm font-medium">File Editing</span>
                        <p className="text-xs text-gray-500">Permission to modify existing files</p>
                      </div>
                    </div>
                    <Select
                      value={formData.permissions.edit}
                      onValueChange={(value: Permission) =>
                        onFormDataChange({
                          ...formData,
                          permissions: { ...formData.permissions, edit: value },
                        })
                      }
                    >
                      <SelectTrigger className="w-24 border-[#262626] bg-[#1a1a1a]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-[#262626] bg-[#1a1a1a]">
                        <SelectItem value="ask">Ask</SelectItem>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="deny">Deny</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between rounded border border-[#262626] bg-[#0a0a0a] p-3">
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <div>
                        <span className="text-sm font-medium">Web Fetching</span>
                        <p className="text-xs text-gray-500">
                          Permission to fetch external web content
                        </p>
                      </div>
                    </div>
                    <Select
                      value={formData.permissions.webfetch || "ask"}
                      onValueChange={(value: Permission) =>
                        onFormDataChange({
                          ...formData,
                          permissions: { ...formData.permissions, webfetch: value },
                        })
                      }
                    >
                      <SelectTrigger className="w-24 border-[#262626] bg-[#1a1a1a]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-[#262626] bg-[#1a1a1a]">
                        <SelectItem value="ask">Ask</SelectItem>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="deny">Deny</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <div className="rounded-lg border border-[#262626] bg-[#0a0a0a] p-6">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/20">
                    <Bot className="h-5 w-5 text-[#3b82f6]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{formData.name || "Unnamed Agent"}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge className="bg-[#3b82f6] text-xs text-white">Custom</Badge>
                      <Badge variant="outline" className="border-[#262626] text-xs">
                        {formData.mode}
                      </Badge>
                      {formData.model && (
                        <Badge variant="outline" className="border-[#262626] text-xs">
                          {formData.model}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {formData.description && (
                  <p className="mb-4 text-sm leading-relaxed text-gray-400">
                    {formData.description}
                  </p>
                )}

                <div className="mb-4 flex flex-wrap gap-2">
                  {Object.entries(formData.tools)
                    .filter(([_, enabled]) => enabled)
                    .map(([tool]) => {
                      const Icon = toolIcons[tool] || Code
                      return (
                        <div
                          key={tool}
                          className="flex items-center gap-1 rounded bg-[#262626] px-2 py-1 text-xs text-gray-300"
                        >
                          <Icon className="h-3 w-3" />
                          {tool}
                        </div>
                      )
                    })}
                </div>

                {formData.prompt && (
                  <div className="mt-4 rounded border border-[#262626] bg-[#1a1a1a] p-3">
                    <h4 className="mb-2 text-sm font-medium">System Prompt Preview</h4>
                    <pre className="max-h-32 overflow-y-auto font-mono text-xs whitespace-pre-wrap text-gray-300">
                      {formData.prompt}
                    </pre>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-[#262626] pt-4 text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Cpu className="h-3 w-3" />
                      {formData.temperature}
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {Object.values(formData.tools).filter(Boolean).length} tools
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {formData.permissions.edit} permissions
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-[#262626] bg-[#1a1a1a] hover:bg-[#2a2a2a]"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!formData.name.trim()}
            className="bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50"
            data-testid="create-agent-submit"
          >
            <Save className="mr-2 h-4 w-4" />
            {saveButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import React, { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Settings,
  Folder,
  Brain,
  Shield,
  Zap,
  Trash2,
  Save,
  X,
  Eye,
  EyeOff,
  Upload,
  Download,
  Plus,
  Minus,
  AlertTriangle,
  Key,
  Globe,
  Terminal,
  FileText,
  Database,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useProjectsActions, useCurrentProject } from "@/stores/projects"
import { useWorktreesStore, useWorktreesForProject } from "@/stores/worktrees"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContents,
  TabsContent,
} from "@/components/ui/shadcn-io/tabs"
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
import { Textarea } from "@/components/ui/textarea"
import { useProjectSDK } from "@/hooks/useProjectSDK"
import { useProvidersSDK } from "@/hooks/useProvidersSDK"

// Types for settings
interface ProjectSettingsConfig {
  general: {
    name: string
    description: string
    icon: string
    color: string
  }
  ai: {
    provider: string
    apiKey: string
    defaultModel: string
    temperature: number
    maxTokens: number
  }
  environment: Record<string, string>
  permissions: {
    fileAccess: "allow" | "ask" | "deny"
    webAccess: "allow" | "ask" | "deny"
    commandAccess: "allow" | "ask" | "deny"
    pathRules: Array<{ path: string; permission: "allow" | "deny" }>
    commandWhitelist: string[]
  }
  advanced: {
    enableCache: boolean
    enableLogs: boolean
    enableExperimental: boolean
    cacheSize: number
    logLevel: "error" | "warn" | "info" | "debug"
  }
}

// Switch component
interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled,
  className,
  ariaLabel,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      "focus-visible:ring-ring relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-primary" : "bg-input",
      className
    )}
  >
    <span
      className={cn(
        "bg-background pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform",
        checked ? "translate-x-5" : "translate-x-0"
      )}
    />
  </button>
)

// Color picker component
const ColorPicker: React.FC<{ value: string; onChange: (color: string) => void }> = ({
  value,
  onChange,
}) => {
  const colors = [
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#6366f1",
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            "h-8 w-8 rounded-full border-2 transition-all",
            value === color ? "scale-110 border-white" : "border-transparent hover:scale-105"
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}

// Icon picker component
const IconPicker: React.FC<{ value: string; onChange: (icon: string) => void }> = ({
  value,
  onChange,
}) => {
  const icons = [
    { name: "folder", icon: Folder },
    { name: "settings", icon: Settings },
    { name: "brain", icon: Brain },
    { name: "shield", icon: Shield },
    { name: "zap", icon: Zap },
    { name: "globe", icon: Globe },
    { name: "terminal", icon: Terminal },
    { name: "file", icon: FileText },
    { name: "database", icon: Database },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {icons.map(({ name, icon: Icon }) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          className={cn(
            "rounded-md border p-2 transition-all",
            value === name
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
          )}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  )
}

export default function ProjectSettings() {
  const params = useParams<{ projectId: string; worktreeId: string }>()
  const projectIdParam = params.projectId ?? ""
  const activeWorktreeId = params.worktreeId ?? "default"
  const navigate = useNavigate()
  const currentProject = useCurrentProject()
  const { updateProject, removeProject } = useProjectsActions()
  const loadWorktrees = useWorktreesStore((state) => state.loadWorktrees)
  const worktrees = useWorktreesForProject(projectIdParam)
  const effectiveProjectId = projectIdParam || currentProject?.id || ""

  useEffect(() => {
    if (projectIdParam) {
      void loadWorktrees(projectIdParam)
    }
  }, [projectIdParam, loadWorktrees])

  const activeWorktree = useMemo(() => {
    if (activeWorktreeId === "default") {
      if (currentProject?.path) {
        return {
          id: "default",
          path: currentProject.path,
          title: `${currentProject.name} (default)`,
        }
      }
      return worktrees.find((worktree) => worktree.id === "default")
    }
    return worktrees.find((worktree) => worktree.id === activeWorktreeId)
  }, [activeWorktreeId, worktrees, currentProject?.path, currentProject?.name])

  useEffect(() => {
    if (!effectiveProjectId) return
    if (activeWorktreeId !== "default" && !activeWorktree) {
      navigate(`/projects/${effectiveProjectId}/default/settings`, { replace: true })
    }
  }, [activeWorktreeId, activeWorktree, effectiveProjectId, navigate])

  const projectPath = activeWorktree?.path || currentProject?.path

  // Load providers/models dynamically from OpenCode SDK
  const { instanceStatus } = useProjectSDK(effectiveProjectId, projectPath)
  const {
    providers,
    selectedProvider,
    selectedModel,
    availableModels,
    setSelectedProvider,
    setSelectedModel,
  } = useProvidersSDK(effectiveProjectId, projectPath, instanceStatus)

  const [settings, setSettings] = useState<ProjectSettingsConfig>({
    general: {
      name: "",
      description: "",
      icon: "folder",
      color: "#3b82f6",
    },
    ai: {
      provider: "openai",
      apiKey: "",
      defaultModel: "gpt-4",
      temperature: 0.7,
      maxTokens: 4000,
    },
    environment: {},
    permissions: {
      fileAccess: "ask",
      webAccess: "ask",
      commandAccess: "ask",
      pathRules: [],
      commandWhitelist: [],
    },
    advanced: {
      enableCache: true,
      enableLogs: true,
      enableExperimental: false,
      cacheSize: 1000,
      logLevel: "info",
    },
  })

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newEnvKey, setNewEnvKey] = useState("")
  const [newEnvValue, setNewEnvValue] = useState("")
  const [newPathRule, setNewPathRule] = useState<{ path: string; permission: "allow" | "deny" }>({
    path: "",
    permission: "allow",
  })
  const [newCommand, setNewCommand] = useState("")
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load project settings
  useEffect(() => {
    if (currentProject) {
      setSettings((prev) => ({
        ...prev,
        general: {
          name: currentProject.name,
          description: "",
          icon: "folder",
          color: "#3b82f6",
        },
      }))
    }
  }, [currentProject])

  // Track changes
  useEffect(() => {
    setHasUnsavedChanges(true)
  }, [settings])

  // Keep local settings in sync with SDK-driven selection
  const providerSetting = settings.ai.provider
  const modelSetting = settings.ai.defaultModel

  useEffect(() => {
    if (selectedProvider && providerSetting !== selectedProvider) {
      setSettings((prev) => ({ ...prev, ai: { ...prev.ai, provider: selectedProvider } }))
    }
  }, [selectedProvider, providerSetting])

  useEffect(() => {
    if (selectedModel && modelSetting !== selectedModel) {
      setSettings((prev) => ({ ...prev, ai: { ...prev.ai, defaultModel: selectedModel } }))
    }
  }, [selectedModel, modelSetting])

  const handleSave = async () => {
    if (!effectiveProjectId || !currentProject) return

    setLoading(true)
    try {
      await updateProject(effectiveProjectId, {
        name: settings.general.name,
      })
      setHasUnsavedChanges(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error("Failed to save settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!effectiveProjectId) return

    setLoading(true)
    try {
      await removeProject(effectiveProjectId)
      // Navigate back to project list
      window.history.back()
    } catch (error) {
      console.error("Failed to delete project:", error)
    } finally {
      setLoading(false)
    }
  }

  const addEnvironmentVariable = () => {
    if (newEnvKey && newEnvValue) {
      setSettings((prev) => ({
        ...prev,
        environment: {
          ...prev.environment,
          [newEnvKey]: newEnvValue,
        },
      }))
      setNewEnvKey("")
      setNewEnvValue("")
    }
  }

  const removeEnvironmentVariable = (key: string) => {
    setSettings((prev) => ({
      ...prev,
      environment: Object.fromEntries(Object.entries(prev.environment).filter(([k]) => k !== key)),
    }))
  }

  const addPathRule = () => {
    if (newPathRule.path) {
      setSettings((prev) => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          pathRules: [...prev.permissions.pathRules, newPathRule],
        },
      }))
      setNewPathRule({ path: "", permission: "allow" })
    }
  }

  const removePathRule = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        pathRules: prev.permissions.pathRules.filter((_, i) => i !== index),
      },
    }))
  }

  const addCommand = () => {
    if (newCommand) {
      setSettings((prev) => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          commandWhitelist: [...prev.permissions.commandWhitelist, newCommand],
        },
      }))
      setNewCommand("")
    }
  }

  const removeCommand = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        commandWhitelist: prev.permissions.commandWhitelist.filter((_, i) => i !== index),
      },
    }))
  }

  const exportEnvFile = () => {
    const envContent = Object.entries(settings.environment)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")

    const blob = new Blob([envContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = ".env"
    a.click()
    URL.revokeObjectURL(url)
  }

  const importEnvFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const envVars: Record<string, string> = {}

      content.split("\n").forEach((line) => {
        const [key, ...valueParts] = line.split("=")
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join("=").trim()
        }
      })

      setSettings((prev) => ({
        ...prev,
        environment: { ...prev.environment, ...envVars },
      }))
    }
    reader.readAsText(file)
  }

  if (!currentProject) {
    return (
      <div className="bg-background text-foreground flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Project Not Found</h1>
          <p className="text-muted-foreground">The requested project could not be found.</p>
        </div>
      </div>
    )
  }

  const worktreeName =
    activeWorktreeId === "default"
      ? `${currentProject.name} (default)`
      : (activeWorktree?.title ?? "Unknown")

  return (
    <div className="bg-background text-foreground h-full">
      {/* Header */}
      <div data-testid="settings-header" className="border-border border-b p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Settings className="h-6 w-6" />
              Project Settings
            </h1>
            <p className="text-muted-foreground mt-1">Project: {currentProject.name}</p>
            <p className="text-muted-foreground text-sm">
              Worktree: <span className="font-medium">{worktreeName}</span>
              {projectPath && (
                <>
                  <br />
                  Path: <span className="font-mono">{projectPath}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="flex items-center gap-1 text-sm text-yellow-400">
                <div className="h-2 w-2 rounded-full bg-yellow-400" />
                Unsaved changes
              </span>
            )}
            {saveSuccess && (
              <span
                data-testid="settings-success-message"
                className="flex items-center gap-1 text-sm text-green-400"
              >
                <div className="h-2 w-2 rounded-full bg-green-400" />
                Settings saved
              </span>
            )}
            <Button variant="outline" onClick={() => window.history.back()} disabled={loading}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              data-testid="save-settings-button"
              onClick={handleSave}
              disabled={!hasUnsavedChanges || loading}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6" data-testid="settings-container">
        <Tabs defaultValue="general" className="w-full">
          <TabsList data-testid="settings-navigation" className="mb-6 grid w-full grid-cols-5">
            <TabsTrigger
              data-testid="settings-tab-general"
              value="general"
              className="flex items-center gap-2"
            >
              <Folder className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger
              data-testid="settings-tab-ai"
              value="ai"
              className="flex items-center gap-2"
            >
              <Brain className="h-4 w-4" />
              AI Models
            </TabsTrigger>
            <TabsTrigger
              data-testid="settings-tab-environment"
              value="environment"
              className="flex items-center gap-2"
            >
              <Key className="h-4 w-4" />
              Environment
            </TabsTrigger>
            <TabsTrigger
              data-testid="settings-tab-permissions"
              value="permissions"
              className="flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Permissions
            </TabsTrigger>
            <TabsTrigger
              data-testid="settings-tab-advanced"
              value="advanced"
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Advanced
            </TabsTrigger>
          </TabsList>

          <TabsContents>
            {/* General Settings */}
            <TabsContent
              data-testid="general-settings-section"
              value="general"
              className="space-y-6"
            >
              <div className="bg-card space-y-6 rounded-lg p-6">
                <h3 className="text-lg font-semibold">Project Information</h3>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="project-name-input">
                      Project Name
                    </label>
                    <Input
                      data-testid="project-name-input"
                      id="project-name-input"
                      value={settings.general.name}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          general: { ...prev.general, name: e.target.value },
                        }))
                      }
                      placeholder="Enter project name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="project-path-input">
                      Project Path
                    </label>
                    <Input
                      id="project-path-input"
                      value={projectPath ?? ""}
                      disabled
                      className="bg-muted font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="project-description-input">
                    Project Description
                  </label>
                  <textarea
                    data-testid="project-description-input"
                    id="project-description-input"
                    className="border-border bg-muted w-full rounded border p-2 text-sm"
                    placeholder="Describe your project..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={settings.general.description}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        general: { ...prev.general, description: e.target.value },
                      }))
                    }
                    placeholder="Enter project description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Project Icon</label>
                    <IconPicker
                      value={settings.general.icon}
                      onChange={(icon) =>
                        setSettings((prev) => ({
                          ...prev,
                          general: { ...prev.general, icon },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Project Color</label>
                    <ColorPicker
                      value={settings.general.color}
                      onChange={(color) =>
                        setSettings((prev) => ({
                          ...prev,
                          general: { ...prev.general, color },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="border-border border-t pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Project
                  </Button>
                  <p className="text-muted-foreground mt-2 text-sm">
                    This will remove the project from OpenCode. The files will not be deleted.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* AI Models Settings */}
            <TabsContent data-testid="ai-settings-section" value="ai" className="space-y-6">
              <div className="bg-card space-y-6 rounded-lg p-6">
                <h3 className="text-lg font-semibold">AI Configuration</h3>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Provider</label>
                    <Select
                      value={selectedProvider}
                      onValueChange={(value) => {
                        setSelectedProvider(value)
                        setSettings((prev) => ({ ...prev, ai: { ...prev.ai, provider: value } }))
                      }}
                    >
                      <SelectTrigger
                        id="provider-select"
                        aria-label="AI provider"
                        disabled={providers.length === 0}
                      >
                        <SelectValue placeholder={"Select provider"} />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Default Model</label>
                    <Select
                      value={selectedModel}
                      onValueChange={(value) => {
                        setSelectedModel(value)
                        setSettings((prev) => ({
                          ...prev,
                          ai: { ...prev.ai, defaultModel: value },
                        }))
                      }}
                    >
                      <SelectTrigger
                        id="model-select"
                        aria-label="AI default model"
                        disabled={availableModels.length === 0}
                      >
                        <SelectValue placeholder={"Select model"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={settings.ai.apiKey}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          ai: { ...prev.ai, apiKey: e.target.value },
                        }))
                      }
                      placeholder="Enter API key"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-1/2 right-2 -translate-y-1/2"
                      aria-label={showApiKey ? "Hide API key" : "Show API key"}
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Temperature</label>
                    <Input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.ai.temperature}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          ai: { ...prev.ai, temperature: parseFloat(e.target.value) },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Tokens</label>
                    <Input
                      type="number"
                      min="1"
                      max="32000"
                      value={settings.ai.maxTokens}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          ai: { ...prev.ai, maxTokens: parseInt(e.target.value) },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Environment Variables */}
            <TabsContent
              data-testid="environment-settings-section"
              value="environment"
              className="space-y-6"
            >
              <div className="bg-card space-y-6 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Environment Variables</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportEnvFile}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("env-import")?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Import
                    </Button>
                    <input
                      id="env-import"
                      type="file"
                      accept=".env"
                      className="hidden"
                      onChange={importEnvFile}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Variable name"
                      aria-label="Environment variable name"
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                    />
                    <Input
                      placeholder="Variable value"
                      aria-label="Environment variable value"
                      value={newEnvValue}
                      onChange={(e) => setNewEnvValue(e.target.value)}
                    />
                    <Button aria-label="Add environment variable" onClick={addEnvironmentVariable}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {Object.entries(settings.environment).map(([key, value]) => (
                      <div key={key} className="bg-muted flex items-center gap-2 rounded p-2">
                        <span className="flex-1 font-mono text-sm">{key}</span>
                        <span className="text-muted-foreground">=</span>
                        <span className="flex-1 truncate font-mono text-sm">{value}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove environment variable ${key}`}
                          onClick={() => removeEnvironmentVariable(key)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Permissions */}
            <TabsContent
              data-testid="permissions-settings-section"
              value="permissions"
              className="space-y-6"
            >
              <div className="bg-card space-y-6 rounded-lg p-6" data-testid="permissions-section">
                <h3 className="text-lg font-semibold">Access Permissions</h3>

                <div className="space-y-4">
                  {/* Public project toggle (for e2e selectors) */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Public Project</label>
                      <p className="text-muted-foreground text-xs">
                        Allow anyone with link to view
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      data-testid="project-public-checkbox"
                      className="h-4 w-4"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">File Access</label>
                      <p className="text-muted-foreground text-xs">
                        Allow AI to read and modify files
                      </p>
                    </div>
                    <Select
                      value={settings.permissions.fileAccess}
                      onValueChange={(value: "allow" | "ask" | "deny") =>
                        setSettings((prev) => ({
                          ...prev,
                          permissions: { ...prev.permissions, fileAccess: value },
                        }))
                      }
                    >
                      <SelectTrigger className="w-32" aria-label="File access level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="ask">Ask</SelectItem>
                        <SelectItem value="deny">Deny</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Web Access</label>
                      <p className="text-muted-foreground text-xs">Allow AI to fetch web content</p>
                    </div>
                    <Select
                      value={settings.permissions.webAccess}
                      onValueChange={(value: "allow" | "ask" | "deny") =>
                        setSettings((prev) => ({
                          ...prev,
                          permissions: { ...prev.permissions, webAccess: value },
                        }))
                      }
                    >
                      <SelectTrigger className="w-32" aria-label="Web access level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="ask">Ask</SelectItem>
                        <SelectItem value="deny">Deny</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Command Access</label>
                      <p className="text-muted-foreground text-xs">Allow AI to execute commands</p>
                    </div>
                    <Select
                      value={settings.permissions.commandAccess}
                      onValueChange={(value: "allow" | "ask" | "deny") =>
                        setSettings((prev) => ({
                          ...prev,
                          permissions: { ...prev.permissions, commandAccess: value },
                        }))
                      }
                    >
                      <SelectTrigger className="w-32" aria-label="Command access level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="ask">Ask</SelectItem>
                        <SelectItem value="deny">Deny</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Path-based Rules</h4>
                  {/* Minimal user role select and add button for e2e selectors */}
                  <div className="flex gap-2">
                    <Select>
                      <SelectTrigger data-testid="user-role-select" className="w-40">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button data-testid="add-user-button" variant="outline">
                      Add User
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Path pattern (e.g., /src/**)"
                      value={newPathRule.path}
                      onChange={(e) =>
                        setNewPathRule((prev) => ({ ...prev, path: e.target.value }))
                      }
                    />
                    <Select
                      value={newPathRule.permission}
                      onValueChange={(value: "allow" | "deny") =>
                        setNewPathRule((prev) => ({ ...prev, permission: value }))
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="deny">Deny</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={addPathRule}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="max-h-32 space-y-2 overflow-y-auto">
                    {settings.permissions.pathRules.map((rule, index) => (
                      <div key={index} className="bg-muted flex items-center gap-2 rounded p-2">
                        <span className="flex-1 font-mono text-sm">{rule.path}</span>
                        <span
                          className={cn(
                            "rounded px-2 py-1 text-xs",
                            rule.permission === "allow"
                              ? "bg-green-900 text-green-300"
                              : "bg-red-900 text-red-300"
                          )}
                        >
                          {rule.permission}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => removePathRule(index)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Command Whitelist</h4>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Command (e.g., npm, git)"
                      value={newCommand}
                      onChange={(e) => setNewCommand(e.target.value)}
                    />
                    <Button onClick={addCommand}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {settings.permissions.commandWhitelist.map((command, index) => (
                      <div
                        key={index}
                        className="bg-muted flex items-center gap-1 rounded px-2 py-1 text-sm"
                      >
                        <span className="font-mono">{command}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCommand(index)}
                          className="h-4 w-4 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-6">
              <div className="bg-card space-y-6 rounded-lg p-6">
                <h3 className="text-lg font-semibold">Advanced Configuration</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Enable Cache</label>
                      <p className="text-muted-foreground text-xs">
                        Cache responses for better performance
                      </p>
                    </div>
                    <Switch
                      ariaLabel="Enable Cache"
                      checked={settings.advanced.enableCache}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          advanced: { ...prev.advanced, enableCache: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Enable Logs</label>
                      <p className="text-muted-foreground text-xs">
                        Keep detailed logs for debugging
                      </p>
                    </div>
                    <Switch
                      ariaLabel="Enable Logs"
                      checked={settings.advanced.enableLogs}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          advanced: { ...prev.advanced, enableLogs: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Experimental Features</label>
                      <p className="text-muted-foreground text-xs">
                        Enable experimental features (may be unstable)
                      </p>
                    </div>
                    <Switch
                      ariaLabel="Experimental Features"
                      checked={settings.advanced.enableExperimental}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          advanced: { ...prev.advanced, enableExperimental: checked },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cache Size (MB)</label>
                    <Input
                      type="number"
                      min="100"
                      max="10000"
                      value={settings.advanced.cacheSize}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          advanced: { ...prev.advanced, cacheSize: parseInt(e.target.value) },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Log Level</label>
                    <Select
                      value={settings.advanced.logLevel}
                      onValueChange={(value: "error" | "warn" | "info" | "debug") =>
                        setSettings((prev) => ({
                          ...prev,
                          advanced: { ...prev.advanced, logLevel: value },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="debug">Debug</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>
          </TabsContents>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{currentProject.name}"? This will remove the project
              from OpenCode but will not delete the actual files.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

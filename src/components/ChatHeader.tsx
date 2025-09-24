import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { Provider, SessionInfo } from "@/types/chat"

interface ChatHeaderProps {
  currentSession: SessionInfo | null
  providers: Provider[]
  selectedProvider: string
  selectedModel: string
  availableModels: Array<{ id: string; name: string }>
  onProviderChange: (provider: string) => void
  onModelChange: (model: string) => void
}

export function ChatHeader({
  currentSession,
  providers,
  selectedProvider,
  selectedModel,
  availableModels,
  onProviderChange,
  onModelChange,
}: ChatHeaderProps) {
  if (!currentSession) {
    return (
      <div className="border-b p-4">
        <div className="text-muted-foreground text-center">
          Select or create a session to start chatting
        </div>
      </div>
    )
  }

  return (
    <div className="border-b p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{currentSession.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {currentSession.id}
            </Badge>
            <span className="text-muted-foreground text-xs">
              Created {new Date(currentSession.time.created).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Provider Selection */}
        <div className="flex items-center gap-2">
          <Label htmlFor="provider-select" className="text-sm font-medium">
            Provider:
          </Label>
          <Select value={selectedProvider} onValueChange={onProviderChange}>
            <SelectTrigger
              id="provider-select"
              data-testid="provider-select"
              className="w-48 min-w-[12rem]"
            >
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model Selection */}
        <div className="flex items-center gap-2">
          <Label htmlFor="model-select" className="text-sm font-medium">
            Model:
          </Label>
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger
              id="model-select"
              data-testid="model-select"
              className="w-60 min-w-[14rem]"
            >
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

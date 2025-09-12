import type { ProjectInfo } from "@/server/project-manager"
import type { Session, Message, Part } from "@opencode-ai/sdk/client"

// Legacy type for backwards compatibility - prefer using Message from SDK
export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp?: Date
  status?: "pending" | "streaming" | "complete" | "error"
}

// Use SDK Provider type directly, but keeping the simplified version for UI
export interface Provider {
  id: string
  name: string
  models: Array<{
    id: string
    name: string
  }>
}

// SessionInfo extends the SDK Session type
export type SessionInfo = Session

// MessageResponse matches the SDK Message structure with parts
// The SDK Message type is flattened - properties like id, role, time are directly on Message
export type MessageResponse = Message & {
  parts: Part[]
}

export interface ChatState {
  project: ProjectInfo | null
  sessions: SessionInfo[]
  currentSession: SessionInfo | null
  messages: MessageResponse[]
  inputValue: string
  isLoading: boolean
  isStreaming: boolean
  renamingSessionId: string | null
  renameValue: string
  instanceStatus: "running" | "stopped" | "starting"
  providers: Provider[]
  selectedProvider: string
  selectedModel: string
}

export interface ChatActions {
  setProject: (project: ProjectInfo | null) => void
  setSessions: (sessions: SessionInfo[] | ((prev: SessionInfo[]) => SessionInfo[])) => void
  setCurrentSession: (session: SessionInfo | null) => void
  setMessages: (
    messages: MessageResponse[] | ((prev: MessageResponse[]) => MessageResponse[])
  ) => void
  setInputValue: (value: string) => void
  setIsLoading: (loading: boolean) => void
  setIsStreaming: (streaming: boolean) => void
  setRenamingSessionId: (id: string | null) => void
  setRenameValue: (value: string) => void
  setInstanceStatus: (status: "running" | "stopped" | "starting") => void
  setProviders: (providers: Provider[]) => void
  setSelectedProvider: (provider: string) => void
  setSelectedModel: (model: string) => void
}

export interface ChatHandlers {
  handleCreateSession: () => Promise<void>
  handleSendMessage: (e: React.FormEvent) => Promise<void>
  handleStopStreaming: () => void
  handleRenameSession: (sessionId: string, newName: string) => Promise<void>
  handleDeleteSession: (sessionId: string) => Promise<void>
  loadMessages: (sessionId: string) => Promise<void>
}

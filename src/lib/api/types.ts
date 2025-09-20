// Type definitions - using SDK types where available
import type {
  Session,
  Message,
  UserMessage,
  AssistantMessage,
  Part,
  TextPart,
  ReasoningPart,
  ToolPart,
  FilePart,
  AgentPart,
  StepStartPart,
  StepFinishPart,
  SnapshotPart,
  PatchPart,
  ToolState,
  Config,
  AgentConfig as SDKAgentConfig,
  Provider,
  Model,
  Command,
  FileNode,
  File,
  Agent,
} from "@opencode-ai/sdk/client"

export type AgentModelValue =
  | string
  | {
      providerID?: string | null
      modelID?: string | null
      [key: string]: unknown
    }
  | null

// Re-export SDK types for convenience
export type {
  Session as SessionInfo,
  Message as MessageInfo,
  UserMessage as MessageUser,
  AssistantMessage as MessageAssistant,
  Part as MessagePart,
  TextPart,
  ReasoningPart,
  ToolPart,
  FilePart,
  AgentPart,
  StepStartPart,
  StepFinishPart,
  SnapshotPart,
  PatchPart,
  ToolState,
  Config as ConfigInfo,
  Provider as ProviderInfo,
  Model as ModelInfo,
  Command as CommandInfo,
  FileNode,
  File as FileInfo,
  Agent,
}

export type AgentConfig = SDKAgentConfig

export type AgentInfo = SDKAgentConfig & {
  model?: AgentModelValue
}

// Permission type for the app (string literal union)
export type Permission = "ask" | "allow" | "deny"

// Additional app-specific types not in SDK

// Response Types
export interface SessionListResponse {
  sessions: Session[]
}

export interface MessageResponse {
  info: Message
  parts: Part[]
}

export interface MessageListResponse {
  messages: MessageResponse[]
}

export interface ProvidersResponse {
  providers: Provider[]
}

// Event Types
export interface EventStreamMessage {
  type: string
  data: unknown
}

export interface MessageWithParts {
  info: Message
  parts: Part[]
}

// App Types
export interface AppInfo {
  hostname: string
  git: boolean
  path: {
    home: string
    config: string
    data: string
    storage: string
    logs: string
  }
  version: string
  os: string
  arch: string
  pid: number
  openaiBaseURL?: string
  anthropicBaseURL?: string
}

export interface AppSnapshot {
  id: string
  time: number
  parentID: string
  description: string
  path: string
  size: number
  files: SnapshotFile[]
}

export interface SnapshotFile {
  path: string
  hash: string
  size: number
  modified: number
}

// Permission Types
export interface PermissionRequest {
  id: string
  type: "edit" | "bash" | "webfetch"
  title: string
  description?: string
  created: number
}

// Error Types
export interface OpenCodeError {
  type: string
  message: string
  code?: string
  status?: number
}

// Project Types (app-specific, not in SDK)
export interface ProjectInfo {
  id: string
  name: string
  path: string
  description?: string
  createdAt: string
  updatedAt: string
  lastActivity?: string
  status?: "active" | "inactive" | "error"
  port?: number
}

// Activity Types
export interface ActivityEvent {
  id: string
  projectId: string
  type: "session_created" | "message_sent" | "file_edited" | "command_executed" | "error"
  timestamp: string
  details?: unknown
}

// Resource Types
export interface ResourceUsage {
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    percentage: number
  }
  disk?: {
    used: number
    total: number
    percentage: number
  }
}

// Git Types
export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  modified: number
  untracked: number
  staged: number
}

// Search Types
export interface SearchResult {
  file: string
  line: number
  column: number
  text: string
  context?: {
    before: string[]
    after: string[]
  }
}

// Completion Types
export interface CompletionRequest {
  sessionID: string
  messages: Message[]
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface CompletionResponse {
  id: string
  choices: CompletionChoice[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface CompletionChoice {
  index: number
  message: Message
  finishReason?: string
}

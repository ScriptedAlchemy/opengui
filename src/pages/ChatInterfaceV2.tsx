import { useParams } from "react-router-dom"

// Context
import { OpencodeSDKProvider } from "@/contexts/OpencodeSDKContext"

// Custom hooks - SDK versions only
import { useProjectSDK } from "@/hooks/useProjectSDK"
import { useProvidersSDK } from "@/hooks/useProvidersSDK"
import { useSessionsSDK } from "@/hooks/useSessionsSDK"
import { useMessagesSDK } from "@/hooks/useMessagesSDK"
import { useSSESDK } from "@/hooks/useSSESDK"

// Components
import { ChatSidebar } from "@/components/chat/ChatSidebar"
import { ChatHeader } from "@/components/chat/ChatHeader"
import { ChatMessages } from "@/components/chat/ChatMessages"
import { ChatInput } from "@/components/chat/ChatInput"

// Types
import React from "react"
import { useCurrentProject } from "@/stores/projects"

function ChatInterfaceV2Inner() {
  const { projectId, sessionId } = useParams<{ projectId: string; sessionId: string }>()

  // Prefer store for project path to avoid extra network fetch and races
  const currentProject = useCurrentProject()
  const [projectPath, setProjectPath] = React.useState<string | undefined>(
    currentProject?.path
  )
  React.useEffect(() => {
    if (currentProject?.path) setProjectPath(currentProject.path)
  }, [currentProject?.path])

  // Custom hooks - SDK versions
  const { project, instanceStatus, client } = useProjectSDK(projectId, projectPath)

  // If store didn't have the path (e.g., deep-linked directly), derive it from API-loaded project
  React.useEffect(() => {
    if (!projectPath && project?.path) {
      setProjectPath(project.path)
    }
  }, [project?.path, projectPath])
  const {
    providers,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
    availableModels,
  } = useProvidersSDK(projectId, projectPath, instanceStatus)

  // Sessions hook with loadMessages dependency
  const {
    sessions,
    currentSession,
    isLoading: isLoadingSessions,
    handleCreateSession,
    handleRenameSession,
    handleDeleteSession,
  } = useSessionsSDK(
    projectId,
    projectPath,
    sessionId,
    instanceStatus,
    async () => Promise.resolve()
  )

  // Additional session handlers
  // handleSelectSession and startRenaming are handled by SessionItem component

  // Messages hook with current session
  const {
    messages,
    inputValue,
    setInputValue,
    isStreaming,
    setMessages,
    setIsStreaming,
    handleSendMessage,
    handleStopStreaming,
    loadMessages,
  } = useMessagesSDK(
    projectId,
    projectPath,
    currentSession || null,
    selectedModel,
    selectedProvider
  )

  // Ensure messages load when the current session changes
  React.useEffect(() => {
    if (currentSession?.id) {
      loadMessages(currentSession.id)
    }
  }, [currentSession?.id])

  // SSE hook for real-time updates
  useSSESDK(client, projectPath, currentSession, instanceStatus, setMessages, setIsStreaming)

  if (!projectId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">No project selected</p>
      </div>
    )
  }

  return (
    <div className="bg-background flex h-screen" data-testid="chat-interface-v2-container">
      {/* Sidebar */}
      <ChatSidebar
        project={project}
        sessions={sessions}
        currentSession={currentSession}
        isLoadingSessions={isLoadingSessions}
        onCreateSession={handleCreateSession}
        onSelectSession={() => {}}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col" data-testid="chat-main-area">
        {/* Header */}
        <ChatHeader
          currentSession={currentSession}
          providers={providers}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          availableModels={availableModels}
          onProviderChange={setSelectedProvider}
          onModelChange={setSelectedModel}
        />

        {currentSession ? (
          <>
            {/* Messages */}
            <ChatMessages
              currentSession={currentSession}
              messages={messages}
              isStreaming={isStreaming}
            />

            {/* Input */}
            <ChatInput
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSendMessage={handleSendMessage}
              onStopStreaming={handleStopStreaming}
              isLoading={false}
              isStreaming={isStreaming}
              disabled={!selectedModel}
            />
          </>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="mb-2 text-lg">No session selected</p>
              <p className="text-sm">
                Create a new session or select an existing one to start chatting
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatInterfaceV2() {
  return (
    <OpencodeSDKProvider>
      <ChatInterfaceV2Inner />
    </OpencodeSDKProvider>
  )
}

// Named export alias for CommonJS interop and tests that import by name
export { ChatInterfaceV2Inner as ChatInterface }

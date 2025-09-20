import React from "react"
import { useNavigate, useParams } from "react-router-dom"

import { OpencodeSDKProvider } from "@/contexts/OpencodeSDKContext"
import { useProjectSDK } from "@/hooks/useProjectSDK"
import { useProvidersSDK } from "@/hooks/useProvidersSDK"
import { useSessionsSDK } from "@/hooks/useSessionsSDK"
import { useMessagesSDK } from "@/hooks/useMessagesSDK"
import { useSSESDK } from "@/hooks/useSSESDK"
import { ChatSidebar } from "@/components/chat/ChatSidebar"
import { ChatHeader } from "@/components/chat/ChatHeader"
import { ChatMessages } from "@/components/chat/ChatMessages"
import { ChatInput } from "@/components/chat/ChatInput"
import { useCurrentProject } from "@/stores/projects"
import { useWorktreesForProject, useWorktreesStore } from "@/stores/worktrees"
import type { SessionInfo } from "@/types/chat"

function ChatInterfaceV2Inner() {
  const params = useParams<{
    projectId: string
    worktreeId: string
    sessionId: string
  }>()
  const projectId = params.projectId ?? ""
  const activeWorktreeId = params.worktreeId ?? "default"
  const sessionId = params.sessionId ?? ""
  const navigate = useNavigate()

  const currentProject = useCurrentProject()
  const loadWorktrees = useWorktreesStore((state) => state.loadWorktrees)
  const worktrees = useWorktreesForProject(projectId)

  React.useEffect(() => {
    if (projectId) {
      void loadWorktrees(projectId)
    }
  }, [projectId, loadWorktrees])

  const [projectPath, setProjectPath] = React.useState<string | undefined>(currentProject?.path)

  React.useEffect(() => {
    if (currentProject?.path) setProjectPath(currentProject.path)
  }, [currentProject?.path])

  const { project, instanceStatus, client } = useProjectSDK(projectId, projectPath)

  const activeWorktree = React.useMemo(() => {
    if (activeWorktreeId === "default") {
      if (project?.path) {
        return { id: "default", path: project.path, title: `${project.name ?? "Project"} (default)` }
      }
      if (currentProject?.path) {
        return {
          id: "default",
          path: currentProject.path,
          title: `${currentProject.name ?? "Project"} (default)`
        }
      }
      return undefined
    }
    return worktrees.find((worktree) => worktree.id === activeWorktreeId)
  }, [activeWorktreeId, worktrees, project?.path, project?.name, currentProject?.path, currentProject?.name])

  React.useEffect(() => {
    if (!projectId) return
    if (activeWorktreeId !== "default" && !activeWorktree) {
      navigate(`/projects/${projectId}/default/sessions/${sessionId || "new"}` , { replace: true })
    }
  }, [projectId, activeWorktreeId, activeWorktree, navigate, sessionId])

  React.useEffect(() => {
    if (activeWorktree?.path) {
      setProjectPath(activeWorktree.path)
      return
    }
    if (project?.path) {
      setProjectPath(project.path)
      return
    }
    if (currentProject?.path) {
      setProjectPath(currentProject.path)
    }
  }, [activeWorktree?.path, project?.path, currentProject?.path])

  const resolvedPath = projectPath || project?.path || currentProject?.path

  const {
    providers,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
    availableModels,
  } = useProvidersSDK(projectId, resolvedPath, instanceStatus)

  const {
    sessions,
    currentSession,
    isLoading: isLoadingSessions,
    handleCreateSession,
    handleRenameSession,
    handleDeleteSession,
  } = useSessionsSDK(
    projectId,
    resolvedPath,
    sessionId,
    instanceStatus,
    async () => Promise.resolve(),
    activeWorktreeId
  )

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
    resolvedPath,
    currentSession || null,
    selectedModel,
    selectedProvider,
    sessionId
  )

  React.useEffect(() => {
    if (currentSession?.id) {
      loadMessages(currentSession.id)
    }
  }, [currentSession?.id, loadMessages])

  React.useEffect(() => {
    const targetSessionId = currentSession?.id
    if (!targetSessionId) return
    if (messages.length > 0) return
    const timeout = setTimeout(() => {
      void loadMessages(targetSessionId)
    }, 2000)
    return () => clearTimeout(timeout)
  }, [currentSession?.id, messages.length, loadMessages])

  useSSESDK(client, resolvedPath, currentSession, instanceStatus, setMessages, setIsStreaming)

  // When selecting an existing session, prefer its previously used provider/model
  const sessionDefaultsApplied = React.useRef<string | null>(null)
  React.useEffect(() => {
    const sessionId = currentSession?.id
    if (!sessionId) return
    if (!messages || messages.length === 0) return
    if (sessionDefaultsApplied.current === sessionId) return

    // Find most recent assistant message carrying provider/model info
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i]
      const provider = (msg as unknown as { providerID?: string }).providerID
      const model = (msg as unknown as { modelID?: string }).modelID
      if (msg.role === 'assistant' && provider && model) {
        if (selectedProvider !== provider) setSelectedProvider(provider)
        if (selectedModel !== model) setSelectedModel(model)
        sessionDefaultsApplied.current = sessionId
        break
      }
    }
  }, [currentSession?.id, messages, selectedProvider, selectedModel, setSelectedProvider, setSelectedModel])

  const handleSelectSession = React.useCallback(
    (session: SessionInfo) => {
      if (!projectId || !session.id) return
      navigate(`/projects/${projectId}/${activeWorktreeId}/sessions/${session.id}/chat`)
    },
    [navigate, projectId, activeWorktreeId]
  )

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No project selected</p>
      </div>
    )
  }

  return (
    <div className="bg-background flex h-screen-minus-header min-h-0" data-testid="chat-interface-v2-container">
      <ChatSidebar
        project={project}
        sessions={sessions}
        currentSession={currentSession}
        isLoadingSessions={isLoadingSessions}
        onCreateSession={handleCreateSession}
        onSelectSession={handleSelectSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
      />

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden" data-testid="chat-main-area">
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
            <ChatMessages currentSession={currentSession} messages={messages} isStreaming={isStreaming} />
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
              <p className="text-sm">Create a new session or select an existing one to start chatting</p>
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

export { ChatInterfaceV2Inner as ChatInterface }

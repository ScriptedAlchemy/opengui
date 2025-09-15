import { useState, useRef, useEffect, useCallback } from "react"
import { toast } from "sonner"
import type { MessageResponse, SessionInfo } from "@/types/chat"
import type { Message, Part } from "@opencode-ai/sdk/client"
import { useProjectSDK } from "@/contexts/OpencodeSDKContext"
import type { FileAttachment } from "@/util/file"

export function useMessagesSDK(
  projectId: string | undefined,
  projectPath: string | undefined,
  currentSession: SessionInfo | null,
  selectedModel: string,
  selectedProvider: string,
  sessionIdFromRoute?: string
){
  const [messages, setMessages] = useState<MessageResponse[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { client } = useProjectSDK(projectId, projectPath)

  // Load messages for a session
  const loadMessages = useCallback(async (sessionIdParam: string) => {
    if (!projectId || !client || !projectPath) return

    try {
      let response = await client.session.messages({
        path: { id: sessionIdParam },
        query: { directory: projectPath },
      })

      if (!response.data || (Array.isArray(response.data) && response.data.length === 0)) {
        // Fallback: some backends may not require directory; try without it
        try {
          response = await client.session.messages({ path: { id: sessionIdParam } })
        } catch (fallbackError) {
          console.warn("Failed fallback message load without directory:", fallbackError)
        }
      }

      if (!response.data) return

      // The SDK may return either a flattened Message with optional parts
      // or an object with { info: Message, parts: Part[] }.
      type MessageListItem = (Message & { parts?: Part[] }) | { info: Message; parts: Part[] }

      let raw = response.data as unknown as MessageListItem[]

      // If empty immediately after creating a new session, retry briefly
      if (Array.isArray(raw) && raw.length === 0) {
        for (let attempt = 0; attempt < 2; attempt++) {
          await new Promise((r) => setTimeout(r, 800))
          const retry = await client.session.messages({
            path: { id: sessionIdParam },
            query: { directory: projectPath },
          })
          if (retry.data && Array.isArray(retry.data) && retry.data.length > 0) {
            raw = retry.data as unknown as MessageListItem[]
            break
          }
        }
      }

      const messagesData: MessageResponse[] = (raw || []).map((item) => {
        const info: Message = "info" in item ? item.info : item
        const parts: Part[] = ("parts" in item ? item.parts : []) as Part[]
        return {
          ...info,
          parts: parts.filter((p) => p.type !== "step-start" && p.type !== "step-finish"),
        }
      })

      setMessages(messagesData)
    } catch (error) {
      console.error("Failed to load messages:", error)
    }
  }, [projectId, projectPath, client])

  // Automatically load messages when the current session changes
  useEffect(() => {
    let mounted = true
    const sessionId = currentSession?.id || sessionIdFromRoute

    // When session changes, clear messages; they will be loaded from API
    if (sessionId) setMessages([])

    // Only attempt network load when dependencies are ready
    if (!projectId || !projectPath || !client || !sessionId) return () => { mounted = false }

    loadMessages(sessionId).catch((err) => {
      if (mounted) {
        console.error("Auto-load messages failed:", err)
      }
    })

    return () => {
      mounted = false
    }
  }, [projectId, projectPath, client, currentSession?.id, sessionIdFromRoute, loadMessages])

  // Send message
  const handleSendMessage = async (attachments?: FileAttachment[]) => {
    if (
      (!inputValue.trim() && (!attachments || attachments.length === 0)) ||
      !currentSession ||
      !projectId ||
      !selectedModel
    ) {
      if (!selectedModel) {
        toast.error("Please select an AI model")
      }
      if (!client) {
        toast.error("SDK client not initialized")
      }
      return
    }

    // Store message content and clear input immediately for better UX
    const messageContent = inputValue.trim()
    setInputValue("")
    setIsStreaming(true)

    // Create parts array for the message
    const messageParts: Part[] = []
    
    // Add text part if there's content
    if (messageContent) {
      messageParts.push({
        id: `temp-part-text-${Date.now()}`,
        sessionID: currentSession.id,
        messageID: `temp-${Date.now()}`,
        type: "text" as const,
        text: messageContent,
      })
    }

    // Add file parts if there are attachments
    if (attachments && attachments.length > 0) {
      attachments.forEach((attachment, index) => {
        messageParts.push({
          id: `temp-part-file-${Date.now()}-${index}`,
          sessionID: currentSession.id,
          messageID: `temp-${Date.now()}`,
          type: "file" as const,
          mime: attachment.mime,
          filename: attachment.filename,
          url: attachment.url, // This is the data URI
        })
      })
    }

    // Create a temporary user message for immediate UI feedback
    // The real user message will come through SSE events, but this provides instant feedback
    const tempUserMessage: MessageResponse = {
      id: `temp-${Date.now()}`,
      role: "user" as const,
      time: {
        created: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
      },
      sessionID: currentSession.id,
      parts: messageParts,
      _isTemporary: true, // Flag to identify temporary messages
    }

    // Add temporary user message for immediate UI feedback and persist cache
    setMessages((prev) => [...prev, tempUserMessage])

    // No local persistence

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      if (!client) {
        // SDK client not ready yet; we've already added the temporary user message
        // End streaming state and return gracefully so UI reflects the sent message
        setIsStreaming(false)
        return
      }

      // Create parts for the SDK call
      const sdkParts: Array<
        | { type: "text"; text: string }
        | { type: "file"; mime: string; filename: string; url: string }
      > = []
      
      // Add text part if there's content
      if (messageContent) {
        sdkParts.push({ type: "text", text: messageContent })
      }

      // Add file parts if there are attachments
      if (attachments && attachments.length > 0) {
        attachments.forEach((attachment) => {
          sdkParts.push({
            type: "file",
            mime: attachment.mime,
            filename: attachment.filename,
            url: attachment.url, // Data URI
          })
        })
      }

      const response = await client.session.prompt({
        path: { id: currentSession.id },
        // Allow prompt without directory until projectPath is resolved
        ...(projectPath ? { query: { directory: projectPath } } : {}),
        body: {
          model: {
            providerID: selectedProvider,
            modelID: selectedModel,
          },
          parts: sdkParts,
        },
        signal: abortControllerRef.current.signal,
      })


      if (response.data) {
        // Handle both flattened and { info, parts } shapes
        type PromptItem = Message & { parts?: Part[] }
        type PromptWithParts = { info: Message; parts: Part[] }

        const item = response.data as unknown as PromptItem | PromptWithParts
        const info: Message = (item as PromptWithParts).info ?? (item as PromptItem)
        const parts: Part[] = ((item as PromptWithParts).parts ?? (item as PromptItem).parts ?? []) as Part[]

        const assistantMessage: MessageResponse = {
          ...info,
          parts: parts.filter((p) => p.type !== "step-start" && p.type !== "step-finish"),
        }

        // Add assistant message to messages array
        setMessages((prev) => [...prev, assistantMessage])
      }

      setIsStreaming(false)
    } catch (error: unknown) {
      if ((error as { name?: string })?.name !== "AbortError") {
        console.error("Failed to send message:", error)
        toast.error("Failed to send message")
      }
      setIsStreaming(false)
    }
  }

  // Stop streaming
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
  }

  return {
    messages,
    inputValue,
    isStreaming,
    setMessages,
    setInputValue,
    setIsStreaming,
    loadMessages,
    handleSendMessage,
    handleStopStreaming,
  }
}

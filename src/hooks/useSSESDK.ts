import { useEffect, useRef } from "react"
import type { OpencodeClient, Event, Part } from "@opencode-ai/sdk/client"
import type { SessionInfo, MessageResponse } from "@/types/chat"

export function useSSESDK(
  client: OpencodeClient | null,
  projectPath: string | undefined,
  currentSession: SessionInfo | null,
  instanceStatus: "running" | "stopped" | "starting",
  setMessages: (
    messages: MessageResponse[] | ((prev: MessageResponse[]) => MessageResponse[])
  ) => void,
  setIsStreaming: (streaming: boolean) => void
) {
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const debug = (() => {
      try {
        return localStorage.getItem("debugSSE") === "1"
      } catch {
        return false
      }
    })()
    const log = (...args: unknown[]) => {
      if (debug) console.debug(...args)
    }
    const warn = (...args: unknown[]) => {
      if (debug) console.warn(...args)
    }

    log("[useSSESDK] Effect called with:", {
      hasClient: !!client,
      projectPath,
      currentSessionId: currentSession?.id,
      instanceStatus
    })

    if (!client || !projectPath || !currentSession || instanceStatus !== "running") {
      log("[useSSESDK] Skipping SSE connection - missing requirements:", {
        hasClient: !!client,
        hasProjectPath: !!projectPath,
        hasCurrentSession: !!currentSession,
        instanceStatus
      })
      return
    }

    log("[useSSESDK] All requirements met, proceeding with SSE connection")

    // Clean up previous subscription
    if (abortControllerRef.current) {
      log("[useSSESDK] Aborting previous SSE connection")
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const findLastTemporaryUserMessageIndex = (messagesList: MessageResponse[], sessionID: string) => {
      for (let index = messagesList.length - 1; index >= 0; index -= 1) {
        const message = messagesList[index]
        if (message._isTemporary && message.role === "user" && message.sessionID === sessionID) {
          return index
        }
      }
      return -1
    }

    async function subscribeToEvents() {
      if (!client || !projectPath || !currentSession) {
        log("[useSSESDK] subscribeToEvents: Missing requirements")
        return
      }

      try {
        log("[useSSESDK] Attempting to subscribe to events with client:", !!client)

        const result = await client.event.subscribe({
          signal: abortController.signal,
        })

        const stream = result.stream as AsyncGenerator<Event, void, unknown>

        log("[useSSESDK] Successfully connected to SSE stream, starting to process events")

        for await (const event of stream) {
          log("[useSSESDK] Received raw event from stream:", event)

          if (abortController.signal.aborted) {
            log("[useSSESDK] SSE stream aborted")
            break
          }

          handleEvent(event)
        }
        log("[useSSESDK] Event processing loop ended")
      } catch (error) {
        if (!abortController.signal.aborted) {
          warn("[useSSESDK] SSE SDK error:", error)
        }
      }
    }

    const handleEvent = (event: Event) => {
      try {
        log("[useSSESDK] Received event:", event.type, event.properties)
        switch (event.type) {
          case "message.updated": {
            const { info } = event.properties
            if (info.sessionID === currentSession?.id && info.id) {
              setMessages((prev) => {
                const existingIndex = prev.findIndex((message) => message.id === info.id)
                if (existingIndex >= 0) {
                  const updated = [...prev]
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    ...info,
                    _isTemporary: false,
                  }
                  return updated
                }

                if (info.role === "user") {
                  const tempIndex = findLastTemporaryUserMessageIndex(prev, info.sessionID)
                  if (tempIndex >= 0) {
                    log("[useSSESDK] Replacing temporary user message with real one")
                    const updated = [...prev]
                    const existingMessage = updated[tempIndex]
                    updated[tempIndex] = {
                      ...info,
                      parts: existingMessage.parts,
                      _isTemporary: false,
                    }
                    return updated
                  }
                }

                log("[useSSESDK] Adding new message from SSE:", info.role, info.id)
                return [
                  ...prev,
                  {
                    ...info,
                    parts: [],
                    _isTemporary: false,
                  },
                ]
              })

              if (info.role === "assistant") {
                if (!info.time.completed) {
                  setIsStreaming(true)
                }
                if (info.time.completed) {
                  setIsStreaming(false)
                }
              }
            }
            break
          }

          case "message.part.updated": {
            const { part } = event.properties
            log("[useSSESDK] message.part.updated event:", {
              part,
              currentSessionId: currentSession?.id,
            })
            if (part.sessionID === currentSession?.id && part.messageID) {
              if (part.type === "step-start" || part.type === "step-finish") {
                break
              }

              setMessages((prev) =>
                prev.map((message) => {
                  if (message.id !== part.messageID) {
                    return message
                  }

                  const existingPartIndex = message.parts.findIndex((existingPart) => existingPart.id === part.id)
                  if (existingPartIndex >= 0) {
                    const updatedParts = [...message.parts]
                    updatedParts[existingPartIndex] = part
                    return { ...message, parts: updatedParts }
                  }

                  const cleanedParts = message.parts.filter((existingPart) => {
                    if (!existingPart.id?.startsWith("temp-part-")) {
                      return true
                    }

                    if (existingPart.type !== part.type) {
                      return true
                    }

                    if (existingPart.type === "file" && part.type === "file") {
                      return !(
                        existingPart.filename === part.filename &&
                        existingPart.mime === part.mime
                      )
                    }

                    if (existingPart.type === "text" && part.type === "text") {
                      return existingPart.text?.trim() !== part.text?.trim()
                    }

                    return false
                  })

                  return { ...message, parts: [...cleanedParts, part] }
                })
              )
            }
            break
          }

          case "session.error": {
            const { sessionID, messageID, error: sessionError } = event.properties as {
              sessionID: string
              messageID?: string
              error?: { name?: string; message?: string; data?: unknown }
            }
            if (sessionID === currentSession?.id) {
              console.error("Session error:", sessionError)
              setIsStreaming(false)
              const now = Math.floor(Date.now() / 1000)
              const resolveErrorText = (error?: { message?: string; name?: string }) => {
                return (
                  error?.message ||
                  (error?.name ? `${error.name}: Something went wrong while generating a response.` : "Something went wrong while generating a response.")
                )
              }

              const createErrorPart = (meta: { sessionID: string; messageID: string }, errorText: string): Part => ({
                id: `error-part-${meta.messageID}-${now}`,
                sessionID: meta.sessionID,
                messageID: meta.messageID,
                type: "text",
                text: errorText,
              })

              setMessages((prev) => {
                const errorText = resolveErrorText(sessionError)
                const withAppliedError = [...prev]

                const findAssistantIndex = () => {
                  if (messageID) {
                    return withAppliedError.findIndex((message) => message.id === messageID)
                  }
                  for (let index = withAppliedError.length - 1; index >= 0; index -= 1) {
                    if (withAppliedError[index].role === "assistant") {
                      return index
                    }
                  }
                  return -1
                }

                const assistantIndex = findAssistantIndex()
                if (assistantIndex >= 0) {
                  const target = withAppliedError[assistantIndex]
                  const messageIdentifier = messageID ?? target.id ?? `error-${sessionID}-${now}`
                  const errorPart = createErrorPart(
                    { sessionID, messageID: messageIdentifier },
                    errorText
                  )

                  const filteredParts = target.parts.filter(
                    (existingPart) => !existingPart.id?.startsWith("temp-part-")
                  )

                  const hasErrorPart = filteredParts.some((existingPart) => existingPart.id === errorPart.id)
                  const parts = hasErrorPart ? filteredParts : [...filteredParts, errorPart]

                  withAppliedError[assistantIndex] = {
                    ...target,
                    _error: sessionError,
                    time: {
                      ...target.time,
                      completed: (target.time as { completed?: number } | undefined)?.completed ?? now,
                    } as MessageResponse["time"],
                    parts,
                    _isTemporary: false,
                  }
                  return withAppliedError
                }

                const fallbackMessageId = messageID ?? `error-${sessionID}-${now}`
                const fallbackPart = createErrorPart(
                  { sessionID, messageID: fallbackMessageId },
                  errorText
                )

                const fallbackMessage: MessageResponse = {
                  id: fallbackMessageId,
                  role: "assistant",
                  sessionID,
                  time: { created: now, completed: now } as MessageResponse["time"],
                  system: [],
                  modelID: "",
                  providerID: "",
                  mode: "error",
                  path: { cwd: projectPath || "", root: projectPath || "" },
                  summary: false,
                  cost: 0,
                  tokens: {
                    input: 0,
                    output: 0,
                    reasoning: 0,
                    cache: { read: 0, write: 0 },
                  },
                  parts: [fallbackPart],
                  _error: sessionError,
                  _isTemporary: false,
                }

                return [...withAppliedError, fallbackMessage]
              })
            }
            break
          }

          case "server.connected": {
            log("Server connected")
            break
          }

          default: {
            log("Unhandled SSE SDK event:", event.type, event)
          }
        }
      } catch (error) {
        warn("Failed to handle SSE SDK event:", error)
      }
    }

    subscribeToEvents()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [client, projectPath, currentSession, instanceStatus, setMessages, setIsStreaming])

  return {
    abortControllerRef,
  }
}

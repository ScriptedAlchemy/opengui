import { useEffect, useRef } from "react"
import type { OpencodeClient } from "@opencode-ai/sdk/client"
import type { SessionInfo, MessageResponse } from "@/types/chat"
import type { Event } from "@opencode-ai/sdk/client"

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
      try { return localStorage.getItem('debugSSE') === '1' } catch { return false }
    })()
    const log = (...args: any[]) => { if (debug) console.debug(...args) }
    const warn = (...args: any[]) => { if (debug) console.warn(...args) }

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

    async function subscribeToEvents() {
      if (!client || !projectPath || !currentSession) {
        log("[useSSESDK] subscribeToEvents: Missing requirements")
        return
      }

      try {
        log("[useSSESDK] Attempting to subscribe to events with client:", !!client)
        log("[useSSESDK] Client.event available:", !!client.event)
        log("[useSSESDK] Client.event.subscribe available:", !!client.event?.subscribe)
        
        const result = await client.event.subscribe({
          signal: abortController.signal,
        })

        log("[useSSESDK] Subscribe result:", { 
          hasResult: !!result, 
          hasStream: !!result?.stream,
          resultKeys: result ? Object.keys(result) : []
        })

        if (!result.stream) {
          warn("[useSSESDK] No stream available from SDK")
          return
        }

        log("[useSSESDK] Successfully connected to SSE stream, starting to process events")

        // Process events from the async generator
        log("[useSSESDK] Starting event processing loop")
        for await (const event of result.stream) {
          log("[useSSESDK] Received raw event from stream:", event)
          
          if (abortController.signal.aborted) {
            log("[useSSESDK] SSE stream aborted")
            break
          }

          handleEvent(event as Event)
        }
        log("[useSSESDK] Event processing loop ended")
      } catch (error) {
        if (!abortController.signal.aborted) {
          warn("[useSSESDK] SSE SDK error:", error)
        }
      }
    }

    function handleEvent(event: Event) {
      try {
        log("[useSSESDK] Received event:", event.type, event.properties)
        switch (event.type) {
          case "message.updated": {
            const { info } = event.properties || {}
            log("[useSSESDK] message.updated event:", { info, currentSessionId: currentSession?.id })
            if (info?.sessionID === currentSession?.id && info?.id) {
              setMessages((prev: MessageResponse[]) => {
                const existingIndex = prev.findIndex((m) => m.id === info.id)
                if (existingIndex >= 0) {
                  // Update existing message - spread info properties directly
                  const updated = [...prev]
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    ...info,
                  }
                  return updated
                } else {
                  // Check if this is a real user message that should replace a temporary one
                  if (info.role === "user") {
                    // Find and replace the most recent temporary user message
                    const tempIndex = prev.findIndex((m, i) => 
                      (m as any)._isTemporary && 
                      m.role === "user" && 
                      m.sessionID === info.sessionID &&
                      // Make sure it's the most recent temp message
                      i === prev.length - 1 || prev.slice(i + 1).every(laterMsg => !(laterMsg as any)._isTemporary || laterMsg.role !== "user")
                    )
                    
                      if (tempIndex >= 0) {
                        log("[useSSESDK] Replacing temporary user message with real one, preserving parts until server parts arrive")
                        const updated = [...prev]
                        const temp = updated[tempIndex]
                        updated[tempIndex] = {
                          ...(info as any),
                          // Preserve existing parts from temp message until real parts stream in
                          parts: (temp?.parts && temp.parts.length > 0) ? temp.parts : [],
                        } as MessageResponse
                        return updated
                      }
                  }

                  // Add new message - spread info properties directly
                  log("[useSSESDK] Adding new message from SSE:", info.role, info.id)
                  return [
                    ...prev,
                    {
                      ...info,
                      parts: [], // Parts will come via message.part.updated events
                    } as MessageResponse,
                  ]
                }
              })

              // Start streaming for assistant messages
              if (info.role === "assistant") {
                const assistantInfo = info as any
                if (!assistantInfo.time?.completed) {
                  setIsStreaming(true)
                }
                // Message complete when it has a completed time
                if (assistantInfo.time?.completed) {
                  setIsStreaming(false)
                }
              }
            }
            break
          }

          case "message.part.updated": {
            const { part } = event.properties || {}
            console.log("[useSSESDK] message.part.updated event:", { part, currentSessionId: currentSession?.id })
            if (part?.sessionID === currentSession?.id && part?.messageID) {
              // Filter out step-start and step-finish parts at the event level
              if (part.type === "step-start" || part.type === "step-finish") {
                break
              }

              setMessages((prev: MessageResponse[]) => {
                return prev.map((msg) => {
                  if (msg.id === part.messageID) {
                    const existingPartIndex = msg.parts.findIndex((p) => p.id === part.id)
                    if (existingPartIndex >= 0) {
                      const updatedParts = [...msg.parts]
                      updatedParts[existingPartIndex] = part as any
                      return { ...msg, parts: updatedParts }
                    } else {
                      return { ...msg, parts: [...msg.parts, part as any] }
                    }
                  }
                  return msg
                })
              })
            }
            break
          }

          case "session.error": {
            const { sessionID, error } = event.properties || {}
            if (sessionID === currentSession?.id) {
              console.error("Session error:", error)
              setIsStreaming(false)
            }
            break
          }

          case "server.connected": {
            log("Server connected")
            break
          }

          default: {
            // Log unhandled events for debugging
            log("Unhandled SSE SDK event:", event.type, event)
          }
        }
      } catch (error) {
        warn("Failed to handle SSE SDK event:", error)
      }
    }

    // Start subscription
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

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui/shadcn-io/ai/conversation"
import { Card } from "@/components/ui/card"
import { User, Bot, Loader2, Download } from "lucide-react"
import type { MessageResponse, SessionInfo } from "@/types/chat"
import type { ToolPart } from "@opencode-ai/sdk/client"
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ui/shadcn-io/ai/reasoning"
import { Image } from "@/components/ui/shadcn-io/ai/image"
import { Button } from "@/components/ui/button"
import { renderTool } from "@/lib/chat/toolRenderers"
import { resolveDate } from "@/lib/utils"
import { getFileIcon, isImageFile, isTextFile } from "@/util/file"

const FALLBACK_ERROR_MESSAGE = "The assistant reported an error while generating a response."

const extractErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== "object") {
    return FALLBACK_ERROR_MESSAGE
  }

  const directMessage = (error as { message?: unknown }).message
  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage
  }

  const nestedData = (error as { data?: unknown }).data
  if (nestedData && typeof nestedData === "object") {
    const nestedMessage = (nestedData as { message?: unknown }).message
    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage
    }
  }

  return FALLBACK_ERROR_MESSAGE
}

interface ChatMessagesProps {
  currentSession: SessionInfo | null
  messages: MessageResponse[]
  isStreaming: boolean
}

export function ChatMessages({ currentSession, messages, isStreaming }: ChatMessagesProps) {
  // Conversation handles stick-to-bottom automatically; no manual ref needed

  if (!currentSession) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground text-center">
          <Bot className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="mb-2 text-lg">Welcome to AI Chat</p>
          <p className="text-sm">Select or create a session to start chatting</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Conversation className="h-full flex-1">
        <ConversationContent className="mx-auto max-w-4xl space-y-4">
          {messages.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <Bot className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const assistantError =
                message.role === "assistant"
                  ? ((message as unknown as { error?: unknown; _error?: unknown }).error ??
                    message._error)
                  : null

              return (
                <div
                  key={message.id || index}
                  className={`flex gap-3 message-${message.role}`}
                  data-testid={message.role === "user" ? "message-user" : "message-assistant"}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {message.role === "user" ? (
                      <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
                        <User className="text-primary-foreground h-4 w-4" />
                      </div>
                    ) : (
                      <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                        <Bot className="text-muted-foreground h-4 w-4" />
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="max-w-[720px] min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {message.role === "user" ? "You" : "Assistant"}
                      </span>
                      {message.time && (
                        <span className="text-muted-foreground text-xs">
                          {resolveDate(message.time.created).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    <Card className="w-fit max-w-[720px] p-3">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {assistantError && (
                          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                            <span className="font-medium">
                              {(() => {
                                const namedError = assistantError as { name?: unknown }
                                return typeof namedError?.name === "string"
                                  ? `${namedError.name}: `
                                  : ""
                              })()}
                            </span>
                            {extractErrorMessage(assistantError)}
                          </div>
                        )}
                        {message.parts.map((part, partIndex) => {
                          if (part.type === "text") {
                            return (
                              <div
                                key={partIndex}
                                className="break-anywhere break-words whitespace-pre-wrap"
                              >
                                {part.text}
                              </div>
                            )
                          } else if (part.type === "file") {
                            return (
                              <div key={partIndex} className="mt-2">
                                {isImageFile(part.mime) ? (
                                  <div className="space-y-2">
                                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                      <span>{getFileIcon(part.mime)}</span>
                                      <span>{part.filename}</span>
                                    </div>
                                    <Image
                                      base64={part.url.split(",")[1]} // Remove data:image/jpeg;base64, prefix
                                      mediaType={part.mime}
                                      uint8Array={new Uint8Array()} // Required by the component
                                      alt={part.filename || "Attached image"}
                                      className="max-w-sm rounded-lg border"
                                    />
                                  </div>
                                ) : isTextFile(part.mime) ? (
                                  <div className="space-y-2">
                                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                      <span>{getFileIcon(part.mime)}</span>
                                      <span>{part.filename}</span>
                                    </div>
                                    <Card className="bg-muted/50 p-3">
                                      <pre className="overflow-x-auto text-sm whitespace-pre-wrap">
                                        {atob(part.url.split(",")[1])}{" "}
                                        {/* Decode base64 text content */}
                                      </pre>
                                    </Card>
                                  </div>
                                ) : (
                                  <div className="bg-muted/50 flex items-center gap-3 rounded-lg border p-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">{getFileIcon(part.mime)}</span>
                                      <div>
                                        <div className="text-sm font-medium">{part.filename}</div>
                                        <div className="text-muted-foreground text-xs">
                                          {part.mime}
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const link = document.createElement("a")
                                        link.href = part.url
                                        link.download = part.filename || "download"
                                        link.click()
                                      }}
                                    >
                                      <Download className="mr-1 h-4 w-4" />
                                      Download
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )
                          } else if (part.type === "reasoning") {
                            return (
                              <Reasoning
                                key={partIndex}
                                isStreaming={isStreaming && partIndex === message.parts.length - 1}
                              >
                                <ReasoningTrigger title="Thinking" />
                                <ReasoningContent>{part.text || ""}</ReasoningContent>
                              </Reasoning>
                            )
                          } else if (part.type === "tool") {
                            // Render tool parts using the tool renderer
                            try {
                              return <div key={partIndex}>{renderTool(part as ToolPart)}</div>
                            } catch (error) {
                              console.error("Error rendering tool:", error)
                              return (
                                <div key={partIndex} className="whitespace-pre-wrap text-red-500">
                                  Error rendering tool: {JSON.stringify(part, null, 2)}
                                </div>
                              )
                            }
                          } else {
                            return (
                              <div key={partIndex} className="whitespace-pre-wrap">
                                {JSON.stringify(part, null, 2)}
                              </div>
                            )
                          }
                        })}
                      </div>
                    </Card>
                  </div>
                </div>
              )
            })
          )}

          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex gap-3" data-testid="streaming-indicator">
              <div className="flex-shrink-0">
                <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                  <Bot className="text-muted-foreground h-4 w-4" />
                </div>
              </div>
              <div className="flex-1">
                <Card className="w-fit max-w-[720px] p-3">
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Generating response...</span>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </ConversationContent>
        {/* Bottom scroll button when not at bottom */}
        <ConversationScrollButton />
      </Conversation>
    </div>
  )
}

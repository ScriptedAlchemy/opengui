import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { User, Bot, Loader2, Download } from "lucide-react"
import { useEffect, useRef } from "react"
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
import { getFileIcon, isImageFile, isTextFile } from "@/util/file"

interface ChatMessagesProps {
  currentSession: SessionInfo | null
  messages: MessageResponse[]
  isStreaming: boolean
}

export function ChatMessages({ currentSession, messages, isStreaming }: ChatMessagesProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
    <div className="flex flex-1 flex-col">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="mx-auto max-w-4xl space-y-4">
          {messages.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <Bot className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => {
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
                <div className="min-w-0 max-w-[720px] space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {message.role === "user" ? "You" : "Assistant"}
                    </span>
                    {message.time && (
                      <span className="text-muted-foreground text-xs">
                        {new Date(message.time.created * 1000).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  <Card className="p-3 w-fit max-w-[720px]">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {message.parts.map((part, partIndex) => {
                        if (part.type === "text") {
                          return (
                            <div key={partIndex} className="whitespace-pre-wrap break-words break-anywhere">
                              {part.text}
                            </div>
                          )
                        } else if (part.type === "file") {
                          return (
                            <div key={partIndex} className="mt-2">
                              {isImageFile(part.mime) ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{getFileIcon(part.mime)}</span>
                                    <span>{part.filename}</span>
                                  </div>
                                  <Image
                                    base64={part.url.split(',')[1]} // Remove data:image/jpeg;base64, prefix
                                    mediaType={part.mime}
                                    uint8Array={new Uint8Array()} // Required by the component
                                    alt={part.filename || 'Attached image'}
                                    className="max-w-sm rounded-lg border"
                                  />
                                </div>
                              ) : isTextFile(part.mime) ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{getFileIcon(part.mime)}</span>
                                    <span>{part.filename}</span>
                                  </div>
                                  <Card className="p-3 bg-muted/50">
                                    <pre className="text-sm whitespace-pre-wrap overflow-x-auto">
                                      {atob(part.url.split(',')[1])} {/* Decode base64 text content */}
                                    </pre>
                                  </Card>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{getFileIcon(part.mime)}</span>
                                    <div>
                                      <div className="font-medium text-sm">{part.filename}</div>
                                      <div className="text-xs text-muted-foreground">{part.mime}</div>
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const link = document.createElement('a')
                                      link.href = part.url
                                      link.download = part.filename || 'download'
                                      link.click()
                                    }}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
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
                <Card className="p-3 w-fit max-w-[720px]">
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Generating response...</span>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  )
}

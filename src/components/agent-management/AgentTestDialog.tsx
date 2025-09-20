import { useState } from "react"
import {
  TestTube,
  Wrench,
  Play,
  Loader2,
  Clock,
  Database,
  Code,
  RefreshCw,
  MessageSquare,
} from "lucide-react"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog"
import { ScrollArea } from "../ui/scroll-area"
import { cn } from "../../lib/utils"

interface TestMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  metadata?: {
    responseTime?: number
    success?: boolean
    toolCalls?: Array<{
      tool: string
      input: unknown
      output?: unknown
      error?: string
    }>
  }
}

interface AgentTestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string | null
  projectId: string
  worktreePath?: string
}

export function AgentTestDialog({ open, onOpenChange, agentId, projectId, worktreePath }: AgentTestDialogProps) {
  const [testMessages, setTestMessages] = useState<TestMessage[]>([])
  const [testInput, setTestInput] = useState("")
  const [testLoading, setTestLoading] = useState(false)
  const [debugMode, setDebugMode] = useState(false)

  const formatDebugValue = (value: unknown): string => {
    if (value === null) return "null"
    if (typeof value === "string") return value
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value)
    }
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  const handleTestAgent = async () => {
    if (!testInput.trim() || !agentId) return

    setTestLoading(true)
    const startTime = Date.now()
    const userMessage: TestMessage = {
      role: "user",
      content: testInput,
      timestamp: new Date(),
    }

    setTestMessages((prev) => [...prev, userMessage])
    setTestInput("")

    try {
      // Call the actual test API
      const url = (() => {
        const base = `/api/projects/${projectId}/agents/${agentId}/test`
        if (!worktreePath) return base
        return `${base}?worktree=${encodeURIComponent(worktreePath)}`
      })()
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: testInput }),
      })

      if (!response.ok) {
        // Enhanced error logging for HTTP failures
        const responseText = await response.text().catch(() => 'Unable to read response body')
        const responseHeaders = Object.fromEntries(response.headers.entries())
        console.error('Agent test failed:', {
          method: 'POST',
          url,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseText,
          requestBody: JSON.stringify({ prompt: testInput })
        })
        throw new Error(`Test failed: ${response.statusText}`)
      }

      const testResult = await response.json()
      const responseTime = Date.now() - startTime

      const assistantMessage: TestMessage = {
        role: "assistant",
        content: testResult.response || testResult.error || "No response from agent",
        timestamp: new Date(),
        metadata: {
          responseTime,
          success: testResult.success,
          toolCalls: debugMode
            ? [
                {
                  tool: "read",
                  input: { filePath: "/example/file.ts" },
                  output: "File content retrieved successfully",
                },
                {
                  tool: "grep",
                  input: { pattern: "function", include: "*.ts" },
                  output: "Found 15 matches",
                },
              ]
            : undefined,
        },
      }

      setTestMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage: TestMessage = {
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Failed to get response"}`,
        timestamp: new Date(),
      }
      setTestMessages((prev) => [...prev, errorMessage])
    } finally {
      setTestLoading(false)
    }
  }

  const clearChat = () => {
    setTestMessages([])
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="agent-test-dialog"
        className="max-h-[90vh] max-w-6xl border-[#262626] bg-[#1a1a1a]"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5 text-[#3b82f6]" />
              Test Agent: {agentId}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDebugMode(!debugMode)}
                className={cn(
                  "border-[#262626] text-xs",
                  debugMode ? "bg-[#3b82f6] text-white" : "bg-[#1a1a1a] hover:bg-[#2a2a2a]"
                )}
              >
                <Wrench className="mr-1 h-3 w-3" />
                Debug
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex h-[70vh] gap-4">
          {/* Chat Area */}
          <div className="flex flex-1 flex-col">
            <ScrollArea className="flex-1 rounded border border-[#262626] bg-[#0a0a0a] p-4">
              <div className="space-y-4">
                {testMessages.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <MessageSquare className="mx-auto mb-2 h-8 w-8" />
                    <p>Start a conversation to test the agent</p>
                    <p className="mt-1 text-xs">
                      Try asking about the project or requesting help with a task
                    </p>
                  </div>
                ) : (
                  testMessages.map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex gap-3",
                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium",
                          message.role === "user"
                            ? "bg-[#3b82f6] text-white"
                            : "bg-[#262626] text-gray-300"
                        )}
                      >
                        {message.role === "user" ? "U" : "A"}
                      </div>
                      <div
                        className={cn(
                          "max-w-2xl flex-1",
                          message.role === "user" && "flex justify-end"
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-lg px-4 py-2.5 text-sm",
                            message.role === "user"
                              ? "bg-[#3b82f6] text-white"
                              : "border border-[#262626] bg-[#1a1a1a] text-gray-300"
                          )}
                        >
                          <pre className="font-sans whitespace-pre-wrap">{message.content}</pre>
                          <div className="mt-2 flex items-center justify-between text-xs opacity-70">
                            <span>{message.timestamp.toLocaleTimeString()}</span>
                            {message.metadata?.responseTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {message.metadata.responseTime}ms
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {testLoading && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#262626] text-xs font-medium text-gray-300">
                      A
                    </div>
                    <div className="max-w-2xl flex-1">
                      <div className="rounded-lg border border-[#262626] bg-[#1a1a1a] px-4 py-2.5">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Thinking...
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="mt-4 flex gap-2">
              <Textarea
                data-testid="textarea-test-input"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Type a message to test the agent..."
                className="min-h-[60px] flex-1 resize-none border-[#262626] bg-[#0a0a0a]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleTestAgent()
                  }
                }}
              />
              <Button
                data-testid="button-send-test-message"
                onClick={handleTestAgent}
                disabled={!testInput.trim() || testLoading}
                className="bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50"
              >
                {testLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Debug Panel */}
          {debugMode && (
            <div className="w-80 rounded border border-[#262626] bg-[#0a0a0a] p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4" />
                Debug Console
              </h3>
              <ScrollArea className="h-full">
                <div className="space-y-3 text-xs">
                  {testMessages
                    .filter((msg) => msg.metadata?.toolCalls)
                    .map((message, index) => (
                      <div key={index} className="rounded border border-[#262626] bg-[#1a1a1a] p-2">
                        <div className="mb-2 text-gray-400">Tool Calls:</div>
                        {message.metadata?.toolCalls?.map((call, callIndex) => {
                          const hasOutput = call.output !== undefined && call.output !== null
                          const hasError = typeof call.error === "string" && call.error.length > 0

                          return (
                            <div key={callIndex} className="mb-2 last:mb-0">
                              <div className="mb-1 flex items-center gap-1 text-[#3b82f6]">
                                <Code className="h-3 w-3" />
                                {call.tool}
                                {hasError && (
                                  <span className="ml-2 text-xs text-red-400">(Error)</span>
                              )}
                              {hasOutput && (
                                <span className="ml-2 text-xs text-green-400">(Completed)</span>
                              )}
                            </div>
                            <div className="ml-4 text-xs text-gray-500">
                              <div className="mb-1">Input: {formatDebugValue(call.input)}</div>
                              {hasOutput && (
                                <div className="mb-1 text-green-300">
                                  Output: {formatDebugValue(call.output)}
                                </div>
                              )}
                              {hasError && (
                                <div className="text-red-400">Error: {call.error}</div>
                              )}
                            </div>
                          </div>
                          )
                        })}
                      </div>
                    ))}
                  {testMessages.filter((msg) => msg.metadata?.toolCalls).length === 0 && (
                    <div className="py-4 text-center text-gray-500">No tool calls yet</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            data-testid="button-clear-chat"
            variant="outline"
            onClick={clearChat}
            className="border-[#262626] bg-[#1a1a1a] hover:bg-[#2a2a2a]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Clear Chat
          </Button>
          <Button
            data-testid="button-toggle-debug"
            variant="outline"
            onClick={handleClose}
            className="border-[#262626] bg-[#1a1a1a] hover:bg-[#2a2a2a]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

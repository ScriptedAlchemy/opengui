import { sleep } from '../utils/node-utils'

export class MockRuntime {
  messages: any[] = []
  private listeners = new Map<string, Set<Function>>()
  private messageCounter = 0
  private abortController?: AbortController
  isRunning = false
  capabilities = {
    cancel: true,
    copy: true,
    regenerate: true,
    reload: true,
  }

  constructor() {
    this.reset()
  }

  simulateUserMessage(content: string) {
    const message = {
      id: `msg-${++this.messageCounter}`,
      role: "user",
      content: [{ type: "text", text: content }],
      createdAt: new Date(),
      metadata: {},
    }
    this.messages.push(message)
    this.emit("messagesChange", this.messages)
    return message.id
  }

  simulateAssistantMessage(content: string) {
    const message = {
      id: `msg-${++this.messageCounter}`,
      role: "assistant",
      content: [{ type: "text", text: content }],
      createdAt: new Date(),
      status: "complete",
      metadata: {},
    }
    this.messages.push(message)
    this.emit("messagesChange", this.messages)
    return message.id
  }

  simulateStreamingMessage(initialContent: string = "") {
    const messageId = `msg-${++this.messageCounter}`
    const message = {
      id: messageId,
      role: "assistant",
      content: [{ type: "text", text: initialContent }],
      createdAt: new Date(),
      status: "streaming",
      metadata: {},
    }
    this.messages.push(message)
    this.emit("messagesChange", this.messages)

    return {
      messageId,
      appendText: (text: string) => {
        const msg = this.messages.find((m: any) => m.id === messageId)
        if (msg && msg.content[0]?.type === "text") {
          msg.content[0] = { ...msg.content[0], text: msg.content[0].text + text }
          this.emit("messagesChange", this.messages)
        }
      },
      complete: () => {
        const msg = this.messages.find((m: any) => m.id === messageId)
        if (msg) {
          msg.status = "complete"
        }
        this.emit("messagesChange", this.messages)
      },
    }
  }

  simulateToolCall(toolName: string, args: any, result?: any) {
    const message = {
      id: `msg-${++this.messageCounter}`,
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: `tool-${Date.now()}`,
          toolName,
          args,
          argsText: JSON.stringify(args),
          result,
        },
      ],
      createdAt: new Date(),
      status: "complete",
      metadata: {},
    }
    this.messages.push(message)
    this.emit("messagesChange", this.messages)
    return message.id
  }

  async sendMessage(content: string) {
    this.isRunning = true
    this.emit("isRunningChange", true)

    // Add user message
    this.simulateUserMessage(content)

    // Simulate processing delay
    await sleep(100)

    // Add assistant response
    this.simulateAssistantMessage(`Response to: ${content}`)

    this.isRunning = false
    this.emit("isRunningChange", false)
  }

  async regenerate() {
    if (this.messages.length === 0) return

    // Remove last assistant message
    let lastAssistantIndex = -1
    for (let j = this.messages.length - 1; j >= 0; j--) {
      if (this.messages[j].role === "assistant") {
        lastAssistantIndex = j
        break
      }
    }

    if (lastAssistantIndex >= 0) {
      this.messages.splice(lastAssistantIndex, 1)
      this.emit("messagesChange", this.messages)
    }

    // Generate new response
    this.isRunning = true
    this.emit("isRunningChange", true)

    await sleep(100)

    this.simulateAssistantMessage("Regenerated response")

    this.isRunning = false
    this.emit("isRunningChange", false)
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = undefined
    }
    this.isRunning = false
    this.emit("isRunningChange", false)
  }

  reload() {
    this.reset()
  }

  copy(message: any) {
    if (message.content[0]?.type === "text") {
      // In a real implementation, this would copy to clipboard
      return message.content[0].text
    }
    return ""
  }

  switchToThread(_threadId: string | null) {
    // Mock implementation - could switch between different message sets
    this.reset()
  }

  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: Function) {
    this.listeners.get(event)?.delete(handler)
  }

  emit(event: string, data: any) {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach((handler) => handler(data))
    }
  }

  reset() {
    this.messages = []
    this.messageCounter = 0
    this.isRunning = false
    this.emit("messagesChange", this.messages)
    this.emit("isRunningChange", false)
  }

  // Thread-like API for assistant-ui
  get thread() {
    return {
      messages: this.messages,
      isRunning: this.isRunning,
      sendMessage: this.sendMessage.bind(this),
      regenerate: this.regenerate.bind(this),
      cancel: this.cancel.bind(this),
      reload: this.reload.bind(this),
      copy: this.copy.bind(this),
      switchToThread: this.switchToThread.bind(this),
      capabilities: this.capabilities,
      subscribe: (callback: () => void) => {
        const handler = () => callback()
        this.on("messagesChange", handler)
        this.on("isRunningChange", handler)
        return () => {
          this.off("messagesChange", handler)
          this.off("isRunningChange", handler)
        }
      },
    }
  }

  subscribe(callback: () => void) {
    return this.thread.subscribe(callback)
  }
}

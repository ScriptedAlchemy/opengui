// SSE Mock that matches OpenCode's event format
import { EventEmitter } from "events"

export interface OpenCodeSSEEvent {
  type: string
  properties: Record<string, any>
}

class MockSSEStream extends EventEmitter {
  url: string
  readyState = 0 // 0=CONNECTING, 1=OPEN, 2=CLOSED
  autoConnect: boolean = true

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string, options: { autoConnect?: boolean } = {}) {
    super()
    this.url = url
    this.autoConnect = options.autoConnect !== false

    // Simulate connection opening
    setTimeout(() => {
      if (this.autoConnect) {
        this.triggerOpen()
      }
    }, 0)
  }

  sendEvent(event: OpenCodeSSEEvent) {
    if (this.readyState !== 1) {
      throw new Error("EventSource is not open")
    }

    const messageEvent = new MessageEvent("message", {
      data: JSON.stringify(event),
    })

    this.onmessage?.(messageEvent)
    this.emit("message", messageEvent)
  }

  triggerOpen() {
    this.readyState = 1
    const openEvent = new Event("open")
    this.onopen?.(openEvent)
    this.emit("open", openEvent)

    // Send initial connection event
    if (this.autoConnect) {
      this.sendEvent({
        type: "server.connected",
        properties: {},
      })
    }
  }

  triggerError() {
    const errorEvent = new Event("error")
    this.onerror?.(errorEvent)
    this.emit("error", errorEvent)
  }

  close() {
    this.readyState = 2
    this.emit("close")
  }

  addEventListener(type: string, listener: EventListener) {
    if (type === "open") this.onopen = listener as any
    if (type === "message") this.onmessage = listener as any
    if (type === "error") this.onerror = listener as any
    this.on(type, listener)
  }

  removeEventListener(type: string, listener: EventListener) {
    if (type === "open" && this.onopen === listener) this.onopen = null
    if (type === "message" && this.onmessage === listener) this.onmessage = null
    if (type === "error" && this.onerror === listener) this.onerror = null
    this.off(type, listener)
  }
}

// Store for all SSE connections
const sseConnections = new Map<string, MockSSEStream>()

// Mock EventSource that matches OpenCode's SSE format
export const MockEventSource = class extends MockSSEStream {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2

  constructor(url: string, options?: { autoConnect?: boolean }) {
    super(url, { autoConnect: options?.autoConnect ?? defaultAutoConnect })
    sseConnections.set(url, this)
  }

  close() {
    super.close()
    sseConnections.delete(this.url)
  }
}

// Helper functions for tests
export function getSSEConnection(url: string): MockSSEStream | undefined {
  return sseConnections.get(url)
}

export function sendSSEEvent(url: string, event: OpenCodeSSEEvent) {
  const connection = sseConnections.get(url)
  if (connection) {
    connection.sendEvent(event)
  }
}

export function closeSSEConnection(url: string) {
  const connection = sseConnections.get(url)
  if (connection) {
    connection.close()
  }
}

export function resetSSEConnections() {
  for (const connection of sseConnections.values()) {
    connection.close()
  }
  sseConnections.clear()
}

// Control auto-connect behavior for tests
let defaultAutoConnect = true

export function setAutoConnect(enabled: boolean) {
  defaultAutoConnect = enabled
}

export function getAutoConnect(): boolean {
  return defaultAutoConnect
}

// Common OpenCode event builders
export const OpenCodeEvents = {
  serverConnected: (): OpenCodeSSEEvent => ({
    type: "server.connected",
    properties: {},
  }),

  messageStart: (id: string, role: string, sessionId: string): OpenCodeSSEEvent => ({
    type: "message.start",
    properties: {
      message: {
        info: { id, role, sessionId, time: { created: Date.now() } },
        parts: [],
      },
    },
  }),

  messageUpdate: (id: string, role: string, content: string): OpenCodeSSEEvent => ({
    type: "message.update",
    properties: {
      message: {
        info: { id, role, sessionId: "test-session", time: { created: Date.now() } },
        parts: [{ type: "text", text: content }],
      },
    },
  }),

  messagePartUpdated: (messageId: string, part: any): OpenCodeSSEEvent => ({
    type: "message.update",
    properties: {
      message: {
        info: { id: messageId, role: "assistant", time: { created: Date.now() } },
        parts: [part],
      },
    },
  }),

  messageEnd: (messageId: string): OpenCodeSSEEvent => ({
    type: "message.end",
    properties: { messageId },
  }),

  toolStart: (messageId: string, toolId: string, name: string, args: any): OpenCodeSSEEvent => ({
    type: "tool.start",
    properties: { messageId, toolId, name, arguments: args },
  }),

  toolUpdate: (toolId: string, output: string): OpenCodeSSEEvent => ({
    type: "tool.update",
    properties: { toolId, output },
  }),

  toolEnd: (toolId: string, state: string): OpenCodeSSEEvent => ({
    type: "tool.end",
    properties: { toolId, state },
  }),

  error: (message: string, code?: string): OpenCodeSSEEvent => ({
    type: "error",
    properties: { message, code },
  }),
}

// Install mock globally
if (typeof global !== "undefined") {
  ;(global as any).EventSource = MockEventSource
}
if (typeof window !== "undefined") {
  ;(window as any).EventSource = MockEventSource
}

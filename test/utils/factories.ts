/**
 * Mock data factories for consistent test data generation
 */

import type { MessagePart } from "@/lib/api/types"

// Extended types for testing
export interface TestMessage {
  id: string
  role: "user" | "assistant"
  content: MessagePart[]
  createdAt: Date
  status?: "streaming" | "complete" | "error"
  metadata?: Record<string, any>
}

export interface TestSession {
  id: string
  projectID: string
  directory: string
  title: string
  version: string
  time: {
    created: number
    updated: number
  }
  messages: string[]
  createdAt: number
}

export interface TestProject {
  id: string
  name: string
  path: string
  status: "running" | "stopped" | "error"
  port?: number
  sessions: string[]
  createdAt: number
  error?: string
}

export interface TestToolCall {
  type: "tool-call"
  toolCallId: string
  toolName: string
  args: Record<string, any>
  argsText: string
  result?: string
  error?: string
}

export interface FactoryOptions<T = any> {
  overrides?: Partial<T>
  count?: number
  sequence?: boolean
}

let sequenceCounter = 0

export function resetSequence() {
  sequenceCounter = 0
}

function getSequenceId(prefix: string, sequence?: boolean): string {
  if (sequence) {
    return `${prefix}-${++sequenceCounter}`
  }
  return `${prefix}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Message factories
 */
export const MessageFactory = {
  user(options: FactoryOptions<TestMessage> = {}): TestMessage {
    const { overrides = {}, sequence } = options
    const messageId = getSequenceId("user-msg", sequence)
    return {
      id: messageId,
      role: "user",
      content: [{
        id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionID: "test-session",
        messageID: messageId,
        type: "text",
        text: "Hello, can you help me?"
      }],
      createdAt: new Date(),
      metadata: {},
      ...overrides,
    }
  },

  assistant(options: FactoryOptions<TestMessage> = {}): TestMessage {
    const { overrides = {}, sequence } = options
    const messageId = getSequenceId("assistant-msg", sequence)
    return {
      id: messageId,
      role: "assistant",
      content: [{
        id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionID: "test-session",
        messageID: messageId,
        type: "text",
        text: "I'd be happy to help you!"
      }],
      createdAt: new Date(),
      status: "complete",
      metadata: {},
      ...overrides,
    }
  },

  withToolCall(options: FactoryOptions<TestMessage> = {}): TestMessage {
    const { overrides = {}, sequence } = options
    const toolCall: TestToolCall = {
      type: "tool-call",
      toolCallId: getSequenceId("tool", sequence),
      toolName: "write",
      args: { path: "test.txt", content: "Hello World" },
      argsText: '{"path":"test.txt","content":"Hello World"}',
      result: "File written successfully",
    }

    const messageId = getSequenceId("assistant-msg", sequence)
    return {
      id: messageId,
      role: "assistant",
      content: [{
        id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionID: "test-session",
        messageID: messageId,
        type: "text",
        text: "I'll write that file for you."
      }, toolCall as unknown as MessagePart],
      createdAt: new Date(),
      status: "complete",
      metadata: {},
      ...overrides,
    }
  },

  streaming(options: FactoryOptions<TestMessage> = {}): TestMessage {
    const { overrides = {}, sequence } = options
    const messageId = getSequenceId("streaming-msg", sequence)
    return {
      id: messageId,
      role: "assistant",
      content: [{
        id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionID: "test-session",
        messageID: messageId,
        type: "text",
        text: "This is a streaming response..."
      }],
      createdAt: new Date(),
      status: "streaming",
      metadata: {},
      ...overrides,
    }
  },

  error(options: FactoryOptions<TestMessage> = {}): TestMessage {
    const { overrides = {}, sequence } = options
    const messageId = getSequenceId("error-msg", sequence)
    return {
      id: messageId,
      role: "assistant",
      content: [{
        id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionID: "test-session",
        messageID: messageId,
        type: "text",
        text: "I encountered an error processing your request."
      }],
      createdAt: new Date(),
      status: "error",
      metadata: { error: "Something went wrong" },
      ...overrides,
    }
  },

  conversation(messageCount = 4, options: FactoryOptions = {}): TestMessage[] {
    const { sequence } = options
    const messages: TestMessage[] = []

    for (let i = 0; i < messageCount; i++) {
      const isUser = i % 2 === 0
      const factory = isUser ? MessageFactory.user : MessageFactory.assistant
      const messageId = getSequenceId(isUser ? "user-msg" : "assistant-msg", sequence)
      messages.push(
        factory({
          sequence,
          overrides: {
            content: [
              {
                id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                sessionID: "test-session",
                messageID: messageId,
                type: "text",
                text: isUser ? `User message ${i + 1}` : `Assistant response ${i + 1}`,
              },
            ],
          },
        }),
      )
    }

    return messages
  },
}

/**
 * Session factories
 */
export const SessionFactory = {
  empty(options: FactoryOptions<TestSession> = {}): TestSession {
    const { overrides = {}, sequence } = options
    const now = Date.now()

    return {
      id: getSequenceId("session", sequence),
      projectID: "test-project",
      directory: "/tmp/test-project",
      title: "Empty Session",
      version: "1.0.0",
      time: {
        created: now,
        updated: now,
      },
      messages: [],
      createdAt: now,
      ...overrides,
    }
  },

  withMessages(messageCount = 3, options: FactoryOptions<TestSession> = {}): TestSession {
    const { overrides = {}, sequence } = options
    const messages = MessageFactory.conversation(messageCount, { sequence })
    const now = Date.now()

    return {
      id: getSequenceId("session", sequence),
      projectID: "test-project",
      directory: "/tmp/test-project",
      title: `Chat Session (${messageCount} messages)`,
      version: "1.0.0",
      time: {
        created: now,
        updated: now,
      },
      messages: messages.map((m) => m.id),
      createdAt: now,
      ...overrides,
    }
  },

  active(options: FactoryOptions<TestSession> = {}): TestSession {
    return SessionFactory.withMessages(5, {
      ...options,
      overrides: {
        title: "Active Session",
        ...options.overrides,
      },
    })
  },

  archived(options: FactoryOptions<TestSession> = {}): TestSession {
    return SessionFactory.withMessages(10, {
      ...options,
      overrides: {
        title: "Archived Session",
        time: {
          created: Date.now() - 86400000, // 1 day ago
          updated: Date.now() - 3600000, // 1 hour ago
        },
        ...options.overrides,
      },
    })
  },
}

/**
 * Project factories
 */
export const ProjectFactory = {
  stopped(options: FactoryOptions<TestProject> = {}): TestProject {
    const { overrides = {}, sequence } = options

    return {
      id: getSequenceId("project", sequence),
      name: "Test Project",
      path: "/tmp/test-project",
      status: "stopped",
      sessions: [],
      createdAt: Date.now(),
      ...overrides,
    }
  },

  running(options: FactoryOptions<TestProject> = {}): TestProject {
    const { overrides = {}, sequence } = options

    return {
      id: getSequenceId("project", sequence),
      name: "Running Project",
      path: "/tmp/running-project",
      status: "running",
      port: 3001,
      sessions: [getSequenceId("session", sequence)],
      createdAt: Date.now(),
      ...overrides,
    }
  },

  withSessions(sessionCount = 3, options: FactoryOptions<TestProject> = {}): TestProject {
    const { overrides = {}, sequence } = options
    const sessions = Array.from({ length: sessionCount }, () => getSequenceId("session", sequence))

    return {
      id: getSequenceId("project", sequence),
      name: `Project with ${sessionCount} sessions`,
      path: `/tmp/project-${sessionCount}-sessions`,
      status: "stopped",
      sessions,
      createdAt: Date.now(),
      ...overrides,
    }
  },

  error(options: FactoryOptions<TestProject> = {}): TestProject {
    const { overrides = {}, sequence } = options

    return {
      id: getSequenceId("project", sequence),
      name: "Error Project",
      path: "/tmp/error-project",
      status: "error",
      sessions: [],
      createdAt: Date.now(),
      error: "Failed to start project",
      ...overrides,
    }
  },
}

/**
 * Tool call factories
 */
export const ToolCallFactory = {
  write(options: FactoryOptions<TestToolCall> = {}): TestToolCall {
    const { overrides = {}, sequence } = options

    return {
      type: "tool-call",
      toolCallId: getSequenceId("tool", sequence),
      toolName: "write",
      args: { path: "test.txt", content: "Hello World" },
      argsText: '{"path":"test.txt","content":"Hello World"}',
      result: "File written successfully",
      ...overrides,
    }
  },

  read(options: FactoryOptions<TestToolCall> = {}): TestToolCall {
    const { overrides = {}, sequence } = options

    return {
      type: "tool-call",
      toolCallId: getSequenceId("tool", sequence),
      toolName: "read",
      args: { path: "test.txt" },
      argsText: '{"path":"test.txt"}',
      result: "Hello World",
      ...overrides,
    }
  },

  bash(options: FactoryOptions<TestToolCall> = {}): TestToolCall {
    const { overrides = {}, sequence } = options

    return {
      type: "tool-call",
      toolCallId: getSequenceId("tool", sequence),
      toolName: "bash",
      args: { command: "ls -la" },
      argsText: '{"command":"ls -la"}',
      result: "total 8\ndrwxr-xr-x  2 user user 4096 Jan  1 12:00 .\ndrwxr-xr-x  3 user user 4096 Jan  1 12:00 ..",
      ...overrides,
    }
  },

  error(options: FactoryOptions<TestToolCall> = {}): TestToolCall {
    const { overrides = {}, sequence } = options

    return {
      type: "tool-call",
      toolCallId: getSequenceId("tool", sequence),
      toolName: "write",
      args: { path: "/invalid/path.txt", content: "test" },
      argsText: '{"path":"/invalid/path.txt","content":"test"}',
      error: "Permission denied",
      ...overrides,
    }
  },
}

/**
 * Message part factories
 */
export const MessagePartFactory = {
  text(content = "Sample text content"): MessagePart {
    return {
      id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionID: "test-session",
      messageID: "test-message",
      type: "text",
      text: content,
    }
  },

  toolCall(toolCall?: Partial<TestToolCall>): TestToolCall {
    return ToolCallFactory.write({ overrides: toolCall })
  },

  code(language = "javascript", code = "console.log('Hello World')"): MessagePart {
    return {
      id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionID: "test-session",
      messageID: "test-message",
      type: "text",
      text: `\`\`\`${language}\n${code}\n\`\`\``,
    }
  },
}

/**
 * Batch factory for creating multiple items
 */
export function createBatch<T>(
  factory: (options?: FactoryOptions<T>) => T,
  count: number,
  options: FactoryOptions<T> = {},
): T[] {
  return Array.from({ length: count }, () =>
    factory({
      ...options,
      sequence: options.sequence,
      overrides: options.overrides,
    }),
  )
}

/**
 * Realistic scenario factories
 */
export const ScenarioFactory = {
  newProject(): { project: TestProject; sessions: TestSession[] } {
    const project = ProjectFactory.stopped({
      overrides: { name: "New Project", sessions: [] },
    })
    return { project, sessions: [] }
  },

  activeProject(): { project: TestProject; sessions: TestSession[]; messages: TestMessage[] } {
    const sessions = [SessionFactory.active(), SessionFactory.withMessages(2)]
    const project = ProjectFactory.running({
      overrides: {
        sessions: sessions.map((s) => s.id),
        name: "Active Development Project",
      },
    })
    const messages = MessageFactory.conversation(8)

    return { project, sessions, messages }
  },

  chatConversation(turns = 5): { messages: TestMessage[]; session: TestSession } {
    const messages = MessageFactory.conversation(turns * 2) // user + assistant per turn
    const session = SessionFactory.withMessages(0, {
      overrides: {
        messages: messages.map((m) => m.id),
        title: `Conversation (${turns} turns)`,
      },
    })

    return { messages, session }
  },

  toolUsageScenario(): { messages: TestMessage[]; session: TestSession } {
    const messages = [
      MessageFactory.user({
        overrides: {
          content: [MessagePartFactory.text("Can you create a hello world file?")],
        },
      }),
      MessageFactory.withToolCall({
        overrides: {
          content: [
            MessagePartFactory.text("I'll create that file for you."),
            ToolCallFactory.write({
              overrides: {
                args: { path: "hello.js", content: "console.log('Hello World!')" },
                argsText: '{"path":"hello.js","content":"console.log(\'Hello World!\')"}',
              },
            }) as unknown as MessagePart,
          ],
        },
      }),
      MessageFactory.user({
        overrides: {
          content: [MessagePartFactory.text("Now can you run it?")],
        },
      }),
      MessageFactory.withToolCall({
        overrides: {
          content: [
            MessagePartFactory.text("I'll run the file for you."),
            ToolCallFactory.bash({
              overrides: {
                args: { command: "node hello.js" },
                argsText: '{"command":"node hello.js"}',
                result: "Hello World!",
              },
            }) as unknown as MessagePart,
          ],
        },
      }),
    ]

    const session = SessionFactory.withMessages(0, {
      overrides: {
        messages: messages.map((m) => m.id),
        title: "Tool Usage Example",
      },
    })

    return { messages, session }
  },
}

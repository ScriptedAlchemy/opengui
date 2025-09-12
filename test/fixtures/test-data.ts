export const TestData = {
  messages: {
    userMessage: {
      id: "user-msg-1",
      role: "user" as const,
      content: [{ type: "text", text: "Hello OpenCode" }],
      createdAt: new Date(),
      metadata: {},
    },

    assistantMessage: {
      id: "assistant-msg-1",
      role: "assistant" as const,
      content: [
        { type: "text", text: "Hello! I can help you with that." },
        {
          type: "tool-call",
          toolCallId: "tool-1",
          toolName: "write",
          args: { path: "hello.txt", content: "Hello World" },
          argsText: '{"path":"hello.txt","content":"Hello World"}',
          result: "File written successfully",
        },
      ],
      createdAt: new Date(),
      status: "complete",
      metadata: {},
    },
  },

  sessions: {
    emptySession: {
      id: "session-empty",
      projectID: "test-project",
      directory: "/tmp/test-project",
      title: "Empty Session",
      version: "1.0.0",
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
      messages: [],
      createdAt: Date.now(),
    },

    chatSession: {
      id: "session-chat",
      projectID: "test-project",
      directory: "/tmp/test-project",
      title: "Chat Session",
      version: "1.0.0",
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
      messages: ["user-msg-1", "assistant-msg-1"],
      createdAt: Date.now(),
    },
  },

  projects: {
    runningProject: {
      id: "project-1",
      name: "Test Project",
      path: "/tmp/test-project",
      status: "running",
      port: 3001,
      sessions: ["session-chat"],
      createdAt: Date.now(),
    },

    stoppedProject: {
      id: "project-2",
      name: "Another Project",
      path: "/tmp/another-project",
      status: "stopped",
      sessions: [],
      createdAt: Date.now(),
    },
  },

  tools: {
    writeFile: {
      name: "write",
      description: "Write content to a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },

    readFile: {
      name: "read",
      description: "Read content from a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      },
    },
  },
} as const

// Factory functions for dynamic test data
export class TestDataFactory {
  static createMessage(overrides: any = {}) {
    return {
      id: `msg-${Math.random().toString(36).substring(2, 11)}`,
      role: "user",
      content: [{ type: "text", text: "Test message" }],
      createdAt: new Date(),
      metadata: {},
      ...overrides,
    }
  }

  static createSession(messageCount = 0) {
    const messages = Array.from({ length: messageCount }, (_, i) =>
      this.createMessage({
        role: i % 2 === 0 ? "user" : "assistant",
        content: [{ type: "text", text: `Message ${i + 1}` }],
      }),
    )

    const now = Date.now()
    return {
      id: `session-${Math.random().toString(36).substring(2, 11)}`,
      projectID: "test-project",
      directory: "/tmp/test-project",
      title: `Test Session ${now}`,
      version: "1.0.0",
      time: {
        created: now,
        updated: now,
      },
      messages,
      createdAt: now,
    }
  }

  static createProject(overrides: any = {}) {
    return {
      id: `project-${Math.random().toString(36).substring(2, 11)}`,
      name: `Test Project ${Date.now()}`,
      path: `/tmp/test-${Date.now()}`,
      status: "stopped",
      sessions: [],
      createdAt: Date.now(),
      ...overrides,
    }
  }

  static createStreamEvent(type: string, data: any) {
    return {
      type,
      properties: data,
      timestamp: Date.now(),
    }
  }
}

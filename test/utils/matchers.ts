/**
 * Custom test matchers for domain-specific assertions
 */

import { expect } from "bun:test"
import type { TestMessage, TestSession, TestProject } from "./factories"

/**
 * Message validation helpers
 */
export const assertValidMessage = (message: TestMessage) => {
  expect(typeof message).toBe("object")
  expect(message).not.toBeNull()
  expect(typeof message.id).toBe("string")
  expect(message.id.length).toBeGreaterThan(0)
  expect(["user", "assistant"]).toContain(message.role)
  expect(Array.isArray(message.content)).toBe(true)
  expect(message.content.length).toBeGreaterThan(0)
  expect(message.createdAt).toBeInstanceOf(Date)
  expect(typeof message.metadata).toBe("object")
}

export const assertValidSession = (session: TestSession) => {
  expect(typeof session).toBe("object")
  expect(session).not.toBeNull()
  expect(typeof session.id).toBe("string")
  expect(session.id.length).toBeGreaterThan(0)
  expect(typeof session.projectID).toBe("string")
  expect(typeof session.directory).toBe("string")
  expect(typeof session.title).toBe("string")
  expect(typeof session.version).toBe("string")
  expect(typeof session.time).toBe("object")
  expect(typeof session.time.created).toBe("number")
  expect(typeof session.time.updated).toBe("number")
  expect(Array.isArray(session.messages)).toBe(true)
  expect(typeof session.createdAt).toBe("number")
}

export const assertValidProject = (project: TestProject) => {
  expect(typeof project).toBe("object")
  expect(project).not.toBeNull()
  expect(typeof project.id).toBe("string")
  expect(project.id.length).toBeGreaterThan(0)
  expect(typeof project.name).toBe("string")
  expect(typeof project.path).toBe("string")
  expect(["running", "stopped", "error"]).toContain(project.status)
  expect(Array.isArray(project.sessions)).toBe(true)
  expect(typeof project.createdAt).toBe("number")
}

export const assertMessageHasToolCall = (message: TestMessage, toolName: string) => {
  const hasToolCall = message.content.some(
    (part) => (part as any).type === "tool-call" && (part as any).toolName === toolName,
  )
  expect(hasToolCall).toBe(true)
}

export const assertMessageHasStatus = (message: TestMessage, status: "streaming" | "complete" | "error") => {
  expect(message.status).toBe(status)
}

export const assertProjectHasStatus = (project: TestProject, status: "running" | "stopped" | "error") => {
  expect(project.status).toBe(status)
}

export const assertMessagesContainType = (messages: TestMessage[], type: string) => {
  const containsType = messages.some((msg) => msg.content.some((part) => (part as any).type === type))
  expect(containsType).toBe(true)
}

export const assertRecentTimestamp = (timestamp: number, withinMs = 5000) => {
  const now = Date.now()
  const isRecent = Math.abs(now - timestamp) <= withinMs
  expect(isRecent).toBe(true)
}

export const assertValidId = (obj: { id: string }, prefix?: string) => {
  expect(typeof obj.id).toBe("string")
  expect(obj.id.length).toBeGreaterThan(0)
  if (prefix) {
    expect(obj.id.startsWith(prefix)).toBe(true)
  }
}

export const assertSSEEvent = (event: any, expectedType: string, expectedProperties?: Record<string, any>) => {
  expect(event.type).toBe(expectedType)

  if (expectedProperties) {
    Object.entries(expectedProperties).forEach(([key, value]) => {
      expect(event.properties).toHaveProperty(key, value)
    })
  }
}

/**
 * Assertion helpers for arrays
 */
export const assertAllMessagesValid = (messages: TestMessage[]) => {
  messages.forEach((message) => assertValidMessage(message))
}

export const assertAllSessionsValid = (sessions: TestSession[]) => {
  sessions.forEach((session) => assertValidSession(session))
}

export const assertAllProjectsValid = (projects: TestProject[]) => {
  projects.forEach((project) => assertValidProject(project))
}

/**
 * Conversation flow assertions
 */
export const assertConversationFlow = (messages: TestMessage[]) => {
  expect(messages.length).toBeGreaterThan(0)

  // Check alternating user/assistant pattern
  for (let i = 0; i < messages.length; i++) {
    const expectedRole = i % 2 === 0 ? "user" : "assistant"
    expect(messages[i].role).toBe(expectedRole)
  }

  // Check chronological order
  for (let i = 1; i < messages.length; i++) {
    expect(messages[i].createdAt.getTime()).toBeGreaterThanOrEqual(messages[i - 1].createdAt.getTime())
  }
}

/**
 * Tool usage assertions
 */
export const assertToolUsage = (messages: TestMessage[], expectedTools: string[]) => {
  const toolCalls = messages.flatMap((msg) => msg.content.filter((part) => (part as any).type === "tool-call"))

  expect(toolCalls.length).toBeGreaterThan(0)

  expectedTools.forEach((toolName) => {
    assertMessagesContainType(messages, "tool-call")
    const hasExpectedTool = toolCalls.some((call) => (call as any).toolName === toolName)
    expect(hasExpectedTool).toBe(true)
  })
}

/**
 * Error state assertions
 */
export const assertErrorState = (obj: TestMessage | TestProject, errorMessage?: string) => {
  if ("status" in obj) {
    expect(obj.status).toBe("error")
  }

  if (errorMessage) {
    if ("metadata" in obj && obj.metadata?.error) {
      expect(obj.metadata.error).toContain(errorMessage)
    } else if ("error" in obj && obj.error) {
      expect(obj.error).toContain(errorMessage)
    } else {
      throw new Error("Expected error message but none found")
    }
  }
}

/**
 * Response time assertions
 */
export const assertResponseTime = (startTime: number, maxMs: number) => {
  const elapsed = Date.now() - startTime
  expect(elapsed).toBeLessThanOrEqual(maxMs)
}

/**
 * Content validation
 */
export const assertMessageContent = (message: TestMessage, expectedText: string) => {
  const textParts = message.content.filter((part) => part.type === "text")
  expect(textParts.length).toBeGreaterThan(0)

  const hasExpectedText = textParts.some((part) => (part as any).text?.includes(expectedText))
  expect(hasExpectedText).toBe(true)
}

export const assertMessageHasCode = (message: TestMessage, language?: string) => {
  const textParts = message.content.filter((part) => part.type === "text")
  const hasCodeBlock = textParts.some((part) => {
    const text = (part as any).text || ""
    return language ? text.includes(`\`\`\`${language}`) : text.includes("```")
  })
  expect(hasCodeBlock).toBe(true)
}

/**
 * Session state assertions
 */
export const assertSessionHasMessages = (session: TestSession, count: number) => {
  expect(session.messages.length).toBe(count)
}

export const assertSessionIsEmpty = (session: TestSession) => {
  expect(session.messages.length).toBe(0)
}

export const assertSessionUpdatedRecently = (session: TestSession, withinMs = 5000) => {
  assertRecentTimestamp(session.time.updated, withinMs)
}

/**
 * Project state assertions
 */
export const assertProjectIsRunning = (project: TestProject) => {
  expect(project.status).toBe("running")
  expect(typeof project.port).toBe("number")
  expect(project.port).toBeGreaterThan(0)
}

export const assertProjectIsStopped = (project: TestProject) => {
  expect(project.status).toBe("stopped")
}

export const assertProjectHasError = (project: TestProject, errorMessage?: string) => {
  assertErrorState(project, errorMessage)
}

export const assertProjectHasSessions = (project: TestProject, count: number) => {
  expect(project.sessions.length).toBe(count)
}

/**
 * Streaming assertions
 */
export const assertStreamingMessage = (message: TestMessage) => {
  expect(message.status).toBe("streaming")
}

export const assertCompletedMessage = (message: TestMessage) => {
  expect(message.status).toBe("complete")
}

/**
 * API response assertions
 */
export const assertValidAPIResponse = (response: any) => {
  expect(response).toBeDefined()
  expect(response).not.toBeNull()
  expect(typeof response).toBe("object")
}

export const assertAPIError = (response: any, expectedStatus?: number) => {
  expect(response).toHaveProperty("error")
  if (expectedStatus) {
    expect(response).toHaveProperty("status", expectedStatus)
  }
}

/**
 * Performance assertions
 */
export const assertPerformanceMetrics = (metrics: {
  duration: number
  memoryUsage?: number
  maxDuration?: number
  maxMemory?: number
}) => {
  const { duration, memoryUsage, maxDuration = 1000, maxMemory = 100 * 1024 * 1024 } = metrics

  expect(duration).toBeGreaterThan(0)
  expect(duration).toBeLessThanOrEqual(maxDuration)

  if (memoryUsage !== undefined) {
    expect(memoryUsage).toBeGreaterThan(0)
    expect(memoryUsage).toBeLessThanOrEqual(maxMemory)
  }
}

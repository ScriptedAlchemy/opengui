/**
 * Test database helpers for integration tests
 */

import { expect } from "@rstest/core"
import type { TestMessage, TestSession, TestProject } from "./factories"

/**
 * In-memory test database for consistent test state
 */
export class TestDatabase {
  private messages = new Map<string, TestMessage>()
  private sessions = new Map<string, TestSession>()
  private projects = new Map<string, TestProject>()
  private messagesBySession = new Map<string, string[]>()
  private sessionsByProject = new Map<string, string[]>()

  /**
   * Clear all data
   */
  clear() {
    this.messages.clear()
    this.sessions.clear()
    this.projects.clear()
    this.messagesBySession.clear()
    this.sessionsByProject.clear()
  }

  /**
   * Message operations
   */
  addMessage(message: TestMessage, sessionId?: string) {
    this.messages.set(message.id, message)

    if (sessionId) {
      const sessionMessages = this.messagesBySession.get(sessionId) || []
      sessionMessages.push(message.id)
      this.messagesBySession.set(sessionId, sessionMessages)

      // Update session if it exists
      const session = this.sessions.get(sessionId)
      if (session) {
        session.messages = sessionMessages
        session.time.updated = Date.now()
      }
    }
  }

  getMessage(id: string): TestMessage | undefined {
    return this.messages.get(id)
  }

  getMessagesBySession(sessionId: string): TestMessage[] {
    const messageIds = this.messagesBySession.get(sessionId) || []
    return messageIds.map((id) => this.messages.get(id)).filter(Boolean) as TestMessage[]
  }

  /**
   * Session operations
   */
  addSession(session: TestSession, projectId?: string) {
    this.sessions.set(session.id, session)

    if (projectId) {
      const projectSessions = this.sessionsByProject.get(projectId) || []
      projectSessions.push(session.id)
      this.sessionsByProject.set(projectId, projectSessions)

      // Update project if it exists
      const project = this.projects.get(projectId)
      if (project) {
        project.sessions = projectSessions
      }
    }
  }

  getSession(id: string): TestSession | undefined {
    return this.sessions.get(id)
  }

  getSessionsByProject(projectId: string): TestSession[] {
    const sessionIds = this.sessionsByProject.get(projectId) || []
    return sessionIds.map((id) => this.sessions.get(id)).filter(Boolean) as TestSession[]
  }

  /**
   * Project operations
   */
  addProject(project: TestProject) {
    this.projects.set(project.id, project)
  }

  getProject(id: string): TestProject | undefined {
    return this.projects.get(id)
  }

  getAllProjects(): TestProject[] {
    return Array.from(this.projects.values())
  }

  /**
   * Query helpers
   */
  getMessageCount(): number {
    return this.messages.size
  }

  getSessionCount(): number {
    return this.sessions.size
  }

  getProjectCount(): number {
    return this.projects.size
  }
}

/**
 * Global test database instance
 */
export const testDb = new TestDatabase()

/**
 * Setup test database
 */
export async function setupTestDatabase() {
  testDb.clear()
  return testDb
}

/**
 * Teardown test database
 */
export async function teardownTestDatabase() {
  testDb.clear()
}

/**
 * Seed test database with initial data
 */
export async function seedTestDatabase(data?: {
  projects?: TestProject[]
  sessions?: TestSession[]
  messages?: TestMessage[]
}) {
  if (data?.projects) {
    data.projects.forEach((p) => testDb.addProject(p))
  }
  if (data?.sessions) {
    data.sessions.forEach((s) => testDb.addSession(s))
  }
  if (data?.messages) {
    data.messages.forEach((m) => testDb.addMessage(m))
  }
  return testDb
}

/**
 * Assertion helpers for database state
 */
export function assertDatabaseEmpty() {
  expect(testDb.getMessageCount()).toBe(0)
  expect(testDb.getSessionCount()).toBe(0)
  expect(testDb.getProjectCount()).toBe(0)
}

export function assertDatabaseHasProjects(count: number) {
  expect(testDb.getProjectCount()).toBe(count)
}

export function assertDatabaseHasSessions(count: number) {
  expect(testDb.getSessionCount()).toBe(count)
}

export function assertDatabaseHasMessages(count: number) {
  expect(testDb.getMessageCount()).toBe(count)
}

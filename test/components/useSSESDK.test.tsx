import React, { useEffect, useState } from "react"
import { describe, test, expect, rstest } from "@rstest/core"
import { act, render, waitFor, cleanup } from "@testing-library/react"
import type { OpencodeClient, Event, Part } from "@opencode-ai/sdk/client"
import type { MessageResponse, SessionInfo } from "../../src/types/chat"
import { useSSESDK } from "../../src/hooks/useSSESDK"

type StreamingSetter = (streaming: boolean) => void

const BASE_PATH = "/tmp/project"

const createEventStream = (events: Event[]) => {
  async function* generator() {
    for (const event of events) {
      // Allow React effects to process between events
      await Promise.resolve()
      yield event
    }
  }
  return generator()
}

const createMockClient = (events: Event[]): OpencodeClient => {
  return {
    event: {
      subscribe: async () => ({ stream: createEventStream(events) }),
    },
  } as unknown as OpencodeClient
}

const baseTokens = {
  input: 0,
  output: 0,
  reasoning: 0,
  cache: { read: 0, write: 0 },
}

const createMessage = (overrides: Partial<MessageResponse>): MessageResponse => {
  const now = Math.floor(Date.now() / 1000)
  return {
    id: "message-1",
    role: "assistant",
    sessionID: "session-1",
    time: { created: now },
    system: [],
    modelID: "model",
    providerID: "provider",
    mode: "chat",
    path: { cwd: BASE_PATH, root: BASE_PATH },
    summary: false,
    cost: 0,
    tokens: baseTokens,
    parts: [],
    ...overrides,
  }
}

const session: SessionInfo = {
  id: "session-1",
  projectID: "project-1",
  title: "Test Session",
  directory: BASE_PATH,
  version: "1",
  time: { created: Math.floor(Date.now() / 1000), updated: Math.floor(Date.now() / 1000) },
} as unknown as SessionInfo

type HarnessProps = {
  client: OpencodeClient
  initialMessages: MessageResponse[]
  onMessages: (messages: MessageResponse[]) => void
  onStreaming: StreamingSetter
}

function Harness({ client, initialMessages, onMessages, onStreaming }: HarnessProps) {
  const [messages, setMessages] = useState<MessageResponse[]>(initialMessages)

  useEffect(() => {
    onMessages(messages)
  }, [messages, onMessages])

  useSSESDK(client, BASE_PATH, session, "running", setMessages, onStreaming)

  return null
}

describe("useSSESDK", () => {
  afterEach(() => {
    cleanup()
  })

  test("replaces temporary user message when real message arrives", async () => {
    const now = Math.floor(Date.now() / 1000)
    const tempMessage = createMessage({
      id: "temp-123",
      role: "user",
      parts: [
        {
          id: "temp-part-text-1",
          sessionID: "session-1",
          messageID: "temp-123",
          type: "text",
          text: "Hello world",
        },
      ] as Part[],
      _isTemporary: true,
    })

    const events: Event[] = [
      {
        type: "message.updated",
        properties: {
          info: {
            ...createMessage({
              id: "server-456",
              role: "user",
              time: { created: now },
            }),
          },
        },
      },
    ]

    const client = createMockClient(events)
    const onMessages = rstest.fn((messages: MessageResponse[]) => messages)
    const setIsStreaming = rstest.fn((_: boolean) => {}) as unknown as StreamingSetter

    await act(async () => {
      render(
        <Harness
          client={client}
          initialMessages={[tempMessage]}
          onMessages={onMessages}
          onStreaming={setIsStreaming}
        />
      )
    })

    let latest: MessageResponse[] = []
    await waitFor(() => {
      const call = onMessages.mock.calls.at(-1)
      expect(call).toBeDefined()
      latest = call?.[0] ?? []
      expect(latest).toHaveLength(1)
      expect(latest[0].id).toBe("server-456")
    })

    expect(latest[0]._isTemporary).toBeFalsy()
    expect(latest[0].parts).toHaveLength(1)
    expect(latest[0].parts[0].text).toBe("Hello world")
  })

  test("renders session error as assistant message", async () => {
    const tempAssistant = createMessage({
      id: "assistant-temp",
      role: "assistant",
      parts: [
        {
          id: "temp-part-text-2",
          sessionID: "session-1",
          messageID: "assistant-temp",
          type: "text",
          text: "",
        },
      ] as Part[],
      _isTemporary: true,
    })

    const events: Event[] = [
      {
        type: "session.error",
        properties: {
          sessionID: "session-1",
          messageID: "assistant-temp",
          error: {
            name: "ProviderAuthError",
            message: "Anthropic API key is missing.",
          },
        },
      },
    ]

    const client = createMockClient(events)
    const onMessages = rstest.fn((messages: MessageResponse[]) => messages)
    const setIsStreaming = rstest.fn((_: boolean) => {}) as unknown as StreamingSetter

    await act(async () => {
      render(
        <Harness
          client={client}
          initialMessages={[tempAssistant]}
          onMessages={onMessages}
          onStreaming={setIsStreaming}
        />
      )
    })

    let latest: MessageResponse[] = []
    await waitFor(() => {
      const call = onMessages.mock.calls.at(-1)
      expect(call).toBeDefined()
      latest = call?.[0] ?? []
      expect(latest).toHaveLength(1)
      expect(latest[0].id).toBe("assistant-temp")
      expect(latest[0]._error).toBeDefined()
      expect(latest[0].parts).toHaveLength(1)
      expect(latest[0].parts[0].text).toContain("Anthropic API key is missing.")
    })

    await waitFor(() => {
      expect(setIsStreaming).toHaveBeenCalledWith(false)
    })

    expect(latest[0]._isTemporary).toBeFalsy()
  })
})

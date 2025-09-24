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

  test("sets streaming true on assistant start and false on finish", async () => {
    const now = Math.floor(Date.now() / 1000)
    const assistantId = "assistant-1"
  
    const startEvent = {
      type: "message.updated",
      properties: {
        info: {
          ...createMessage({ id: assistantId, role: "assistant", time: { created: now } }),
        },
      },
    } as unknown as Event
  
    const finishEvent = {
      type: "message.updated",
      properties: {
        info: {
          ...createMessage({ id: assistantId, role: "assistant", time: { created: now - 1, completed: now } }),
        },
      },
    } as unknown as Event
  
    const events: Event[] = [startEvent, finishEvent]
    const client = createMockClient(events)
    const onMessages = rstest.fn((messages: MessageResponse[]) => messages)
    const setIsStreaming = rstest.fn((_: boolean) => {}) as unknown as StreamingSetter
  
    await act(async () => {
      render(
        <Harness
          client={client}
          initialMessages={[]}
          onMessages={onMessages}
          onStreaming={setIsStreaming}
        />
      )
    })
  
    await waitFor(() => {
      expect(setIsStreaming).toHaveBeenCalledWith(true)
    })
  
    await waitFor(() => {
      expect(setIsStreaming).toHaveBeenCalledWith(false)
    })
  })
  
  // Verifies tool call parts are processed in order during streaming (step-start -> tool output -> step-finish)
  test("processes tool call parts from step-start to step-finish", async () => {
    const assistantMessage = createMessage({ id: "message-1", role: "assistant" })
  
    const toolStartPart = {
      id: "tool-step-1-start",
      sessionID: "session-1",
      messageID: assistantMessage.id,
      type: "tool",
      name: "search",
      status: "start",
      arguments: { query: "hello" },
    } as unknown as Part
  
    const toolOutputPart = {
      id: "tool-step-1-output",
      sessionID: "session-1",
      messageID: assistantMessage.id,
      type: "tool",
      name: "search",
      status: "update",
      output: "Found 3 results",
    } as unknown as Part
  
    const toolFinishPart = {
      id: "tool-step-1-finish",
      sessionID: "session-1",
      messageID: assistantMessage.id,
      type: "tool",
      name: "search",
      status: "finish",
      result: { count: 3 },
    } as unknown as Part
  
    const events: Event[] = [
      { type: "message.part.updated", properties: { part: toolStartPart } } as unknown as Event,
      { type: "message.part.updated", properties: { part: toolOutputPart } } as unknown as Event,
      { type: "message.part.updated", properties: { part: toolFinishPart } } as unknown as Event,
    ]
  
    const client = createMockClient(events)
    const onMessages = rstest.fn((messages: MessageResponse[]) => messages)
    const setIsStreaming = rstest.fn((_: boolean) => {}) as unknown as StreamingSetter
  
    await act(async () => {
      render(
        <Harness
          client={client}
          initialMessages={[assistantMessage]}
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
      expect(latest[0].parts.map((p: any) => p.id)).toEqual([
        "tool-step-1-start",
        "tool-step-1-output",
        "tool-step-1-finish",
      ])
    })
  })
  
  // Ensures temp tool parts are removed when real tool parts arrive
  test("removes temp tool parts when real tool part arrives", async () => {
    const assistantMessage = createMessage({ id: "message-2", role: "assistant" })
    const tempToolPart: Part = {
      id: "temp-part-tool-1",
      sessionID: "session-1",
      messageID: assistantMessage.id,
      type: "tool" as any,
    } as unknown as Part
  
    const initialWithTemp = {
      ...assistantMessage,
      parts: [tempToolPart],
    }
  
    const realToolPart = {
      id: "real-tool-1",
      sessionID: "session-1",
      messageID: assistantMessage.id,
      type: "tool",
      name: "search",
      status: "start",
    } as unknown as Part
  
    const events: Event[] = [
      { type: "message.part.updated", properties: { part: realToolPart } } as unknown as Event,
    ]
  
    const client = createMockClient(events)
    const onMessages = rstest.fn((messages: MessageResponse[]) => messages)
    const setIsStreaming = rstest.fn((_: boolean) => {}) as unknown as StreamingSetter
  
    await act(async () => {
      render(
        <Harness
          client={client}
          initialMessages={[initialWithTemp]}
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
      expect(latest[0].parts).toHaveLength(1)
      expect(latest[0].parts[0].id).toBe("real-tool-1")
    })
  })
})

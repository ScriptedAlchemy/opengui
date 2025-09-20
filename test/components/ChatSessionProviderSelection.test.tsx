import { describe, test, expect, beforeEach, rstest } from "@rstest/core"
import { render, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import ChatInterfaceV2 from "../../src/pages/ChatInterfaceV2"
import { opencodeSDKService } from "../../src/services/opencode-sdk-service"

// Router mocks
const mockNavigate = rstest.fn(() => {})
let mockParams: any = { projectId: "test-proj", sessionId: "sess-1" }
rstest.mock("react-router-dom", () => {
  const actual = require("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => ({ pathname: "/projects/test-proj/sessions/sess-1/chat" }),
  }
})

// Project store mock
rstest.mock("../../src/stores/projects", () => ({
  useCurrentProject: () => ({
    id: "test-proj",
    name: "Test Proj",
    path: "/tmp/test-proj",
    type: "git" as const,
    addedAt: new Date().toISOString(),
    lastOpened: new Date().toISOString(),
  }),
}))

function makeSDK() {
  const now = Math.floor(Date.now() / 1000)
  return {
    project: {
      current: async () => ({ data: { id: "test-proj", path: "/tmp/test-proj" } }),
      list: async () => ({ data: [{ id: "test-proj", path: "/tmp/test-proj" }] }),
    },
    session: {
      list: async () => ({
        data: [
          {
            id: "sess-1",
            title: "Session 1",
            projectID: "test-proj",
            directory: "/tmp/test-proj",
            version: "1",
            time: { created: now, updated: now },
          },
        ],
      }),
      messages: async () => ({
        data: [
          {
            info: {
              id: "m1",
              sessionID: "sess-1",
              role: "assistant",
              time: { created: now },
              providerID: "anthropic",
              modelID: "claude-sonnet-4-20250514",
            },
            parts: [
              {
                id: "p1",
                sessionID: "sess-1",
                messageID: "m1",
                type: "text",
                text: "hi",
              },
            ],
          },
        ],
      }),
    },
    config: {
      providers: async () => ({
        data: {
          providers: [
            {
              id: "anthropic",
              name: "Anthropic",
              models: {
                "claude-sonnet-4-20250514": { name: "Claude Sonnet 4" },
                "claude-3-5-sonnet-20241022": { name: "Claude 3.5 Sonnet v2" },
              },
            },
          ],
          default: { anthropic: "claude-sonnet-4-20250514" },
        },
      }),
      get: async () => ({ data: {} }),
    },
  }
}

function Wrapper() {
  return (
    <MemoryRouter initialEntries={["/projects/test-proj/sessions/sess-1/chat"]}>
      <Routes>
        <Route path="/projects/:projectId/sessions/:sessionId/chat" element={<ChatInterfaceV2 />} />
      </Routes>
    </MemoryRouter>
  )
}

describe("Chat session honors previous provider/model", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    ;(opencodeSDKService as any).getClient = rstest.fn(async () => makeSDK())
  })

  test("selects Anthropic + Sonnet 4 from last assistant message", async () => {
    const { findByTestId } = render(<Wrapper />)
    const providerSelect = await findByTestId("provider-select")
    const modelSelect = await findByTestId("model-select")

    await waitFor(() => {
      expect(providerSelect.textContent || "").toMatch(/anthropic/i)
      expect(modelSelect.textContent || "").toMatch(/sonnet/i)
    })
  })
})


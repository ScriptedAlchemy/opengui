import { describe, test, beforeEach, afterAll, expect, rstest } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import React from "react"
import { useSessionsSDK } from "@/hooks/useSessionsSDK"
import { OpencodeSDKProvider } from "@/contexts/OpencodeSDKContext"
import { opencodeSDKService } from "@/services/opencode-sdk-service"
let originalGetClient: any

// Use the real OpencodeSDKProvider; stub only the SDK client
const requestedDirectories: string[] = []


function Harness() {
  const { sessions } = useSessionsSDK(
    "test-project",
    "/project",
    "s1",
    "running",
    async () => Promise.resolve(),
    "default"
  )
  return (
    <div data-testid="list">
      {sessions.map((s) => (
        <div key={s.id}>{s.title}</div>
      ))}
    </div>
  )
}

describe("useSessionsSDK worktree scoping", () => {
  beforeEach(() => {
    rstest.clearAllMocks()
    requestedDirectories.length = 0
    // Stub getClient to return a minimal client that records the requested directory
    originalGetClient = opencodeSDKService.getClient
    ;(opencodeSDKService as any).getClient = rstest.fn(async () => ({
      session: {
        list: async (opts?: { query?: { directory?: string } }) => {
          if (opts?.query?.directory) requestedDirectories.push(opts.query.directory)
          return {
            data: [
              { id: "s1", title: "A", directory: "/project", time: { created: 1, updated: 10 } },
              { id: "s2", title: "B", directory: "/project-feature", time: { created: 2, updated: 20 } },
            ],
          }
        },
      },
    }))
  })
  afterAll(() => {
    if (originalGetClient) (opencodeSDKService as any).getClient = originalGetClient
  })

  test("filters sessions to requested directory when backend returns mixed data", async () => {
    render(
      <OpencodeSDKProvider>
        <MemoryRouter initialEntries={["/projects/test-project/default/sessions/s1/chat"]}>
          <Routes>
            <Route
              path="/projects/:projectId/:worktreeId/sessions/:sessionId/chat"
              element={<Harness />}
            />
          </Routes>
        </MemoryRouter>
      </OpencodeSDKProvider>
    )

    await waitFor(() => {
      expect(opencodeSDKService.getClient).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(requestedDirectories).toContain("/project")
    })

    await waitFor(() => {
      const list = screen.getByTestId("list")
      expect(list.textContent).toContain("A")
      expect(list.textContent).not.toContain("B")
    })

    // Verify the SDK call used the correct worktree directory
    expect(requestedDirectories).toContain("/project")
  })
})

import { describe, test, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import "../setup.ts"
import { render, waitFor, act } from "@testing-library/react"
import type { OpencodeClient } from "@opencode-ai/sdk/client"
import { OpencodeSDKProvider, useProjectSDK } from "@/contexts/OpencodeSDKContext"
import { opencodeSDKService } from "@/services/opencode-sdk-service"

const mockClient = {} as OpencodeClient

let getClientSpy: ReturnType<typeof rstest.spyOn>

beforeEach(() => {
  getClientSpy = rstest.spyOn(opencodeSDKService, "getClient").mockResolvedValue(mockClient)
  rstest.spyOn(opencodeSDKService, "stopAll").mockResolvedValue()
})

afterEach(() => {
  rstest.restoreAllMocks()
})

function HookHarness(props: { projectId: string; projectPath: string }) {
  useProjectSDK(props.projectId, props.projectPath)
  return null
}

describe("useProjectSDK retry behaviour", () => {
  test("does not issue duplicate client requests when retrying after an error", async () => {
    getClientSpy.mockImplementationOnce(() => Promise.reject(new Error("boom")))

    let rerender: ReturnType<typeof render>["rerender"] | undefined

    await act(async () => {
      const rendered = render(
        <OpencodeSDKProvider>
          <HookHarness projectId="proj" projectPath="/path-a" />
        </OpencodeSDKProvider>,
      )
      rerender = rendered.rerender
    })

    await waitFor(() => expect(getClientSpy).toHaveBeenCalledTimes(1))

    await act(async () => {
      rerender!(
        <OpencodeSDKProvider>
          <HookHarness projectId="proj" projectPath="/path-b" />
        </OpencodeSDKProvider>,
      )
    })

    await waitFor(() => expect(getClientSpy).toHaveBeenCalledTimes(2))
  })
})

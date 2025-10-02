import { describe, it, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CreateWorktreeDialog } from "@/features/worktrees/CreateWorktreeDialog"

const sanitizeSegments = (value: string) => {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
  if (!normalized) return ""
  return normalized
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "")
    )
    .filter(Boolean)
    .join("/")
}

describe("CreateWorktreeDialog", () => {
  let fetchMock: ReturnType<typeof rstest.fn>
  let onCreate: ReturnType<typeof rstest.fn>
  let onOpenChange: ReturnType<typeof rstest.fn>

  beforeEach(() => {
    const branches = [
      { name: "main", checkedOut: true },
      { name: "feature/one", checkedOut: false },
    ]

    fetchMock = rstest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input instanceof URL ? input.href : (input as Request).url)
      if (url.includes("/projects/proj-1/git/branches")) {
        return new Response(JSON.stringify(branches), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    rstest.stubGlobal("fetch", fetchMock)

    onCreate = rstest.fn()
    onOpenChange = rstest.fn()
  })

  afterEach(() => {
    rstest.clearAllMocks()
    rstest.unstubAllGlobals()
  })

  const renderDialog = () =>
    render(
      <CreateWorktreeDialog
        open
        onOpenChange={onOpenChange}
        projectId="proj-1"
        onCreate={onCreate}
      />
    )

  it("prefills path and branch based on the title", async () => {
    const user = userEvent.setup()
    renderDialog()

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) =>
        typeof input === "string" ? input : (input instanceof URL ? input.href : (input as Request).url)
      )
      expect(urls.some((url) => url.includes("/projects/proj-1/git/branches"))).to.be.true
    })

    const titleInput = await screen.findByLabelText("Title")
    await user.type(titleInput, "Drawer Launch Pad")

    const pathInput = (await screen.findByLabelText("Relative Path")) as HTMLInputElement
    await waitFor(() => expect(pathInput.value).to.equal("worktrees/drawer-launch-pad"))

    const branchInput = (await screen.findByLabelText("New Branch Name")) as HTMLInputElement
    await waitFor(() => expect(branchInput.value).to.equal("drawer-launch-pad"))
  })

  it("sanitises and preserves manually edited path", async () => {
    const user = userEvent.setup()
    renderDialog()

    const titleInput = await screen.findByLabelText("Title")
    await user.type(titleInput, "Initial Feature")

    const pathInput = (await screen.findByLabelText("Relative Path")) as HTMLInputElement
    await user.clear(pathInput)
    await user.type(pathInput, "Custom // Path 🚀")

    await waitFor(() => {
      expect(pathInput.value).to.match(/^custom[\w-]*$/)
    })

    await user.clear(titleInput)
    await user.type(titleInput, "Updated Title")

    expect(pathInput.value).to.equal(pathInput.value.toLowerCase())
    expect(pathInput.value.includes(" ")).to.be.false
  })

  it("sanitises manually edited branch names and sends them on submit", async () => {
    const user = userEvent.setup()
    renderDialog()

    const titleInput = await screen.findByLabelText("Title")
    await user.type(titleInput, "Telemetry")

    const branchInput = (await screen.findByLabelText("New Branch Name")) as HTMLInputElement
    await user.clear(branchInput)
    await user.type(branchInput, "QA Release / v1.0 🧪")

    await waitFor(() => {
      expect(branchInput.value).to.match(/^[a-z0-9/-]+$/)
    })

    const pathInput = (await screen.findByLabelText("Relative Path")) as HTMLInputElement
    expect(pathInput.value).to.equal("worktrees/telemetry")

    const createButton = screen.getByRole("button", { name: /create worktree/i })
    await user.click(createButton)

    await waitFor(() => expect(onCreate.mock.calls.length).to.equal(1))
    const payload = onCreate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.title).to.equal("Telemetry")
    expect(payload.path).to.equal("worktrees/telemetry")
    expect(typeof payload.branch).to.equal("string")
    expect((payload.branch as string)).to.equal((payload.branch as string).toLowerCase())
    expect((payload.branch as string).includes(" ")).to.be.false
    expect(payload.createBranch).to.be.true
    expect(payload.baseRef).to.equal("HEAD")
  })

})

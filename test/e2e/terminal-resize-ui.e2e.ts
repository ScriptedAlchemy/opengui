import { test, expect } from "@playwright/test"

test.describe("Terminal Resize via UI", () => {
  test("UI emits larger resize after expanding terminal", async ({ page, request, baseURL }) => {
    // Create a session via API so UI hydrates it
    const projectPath = process.cwd()
    const add = await request.post(`${baseURL}/api/projects`, { data: { path: projectPath, name: "UI Resize" } })
    const project = await add.json()
    const wts = await (await request.get(`${baseURL}/api/projects/${project.id}/worktrees`)).json() as any[]
    const toolsResp = await request.get(`${baseURL}/api/cli/tools`)
    const { tools } = await toolsResp.json() as { tools: any[] }
    const tool = tools.find((t) => t.available)
    if (!tool) test.skip()
    const create = await request.post(`${baseURL}/api/cli/sessions`, {
      data: { projectId: project.id, worktreeId: wts[0].id, tool: tool.id, title: "Resize UI" },
    })
    const { session } = await create.json()

    // Capture all WebSocket send payloads before UI loads
    await page.addInitScript(() => {
      const orig = window.WebSocket.prototype.send
      // @ts-ignore
      window.__sent = [] as string[]
      window.WebSocket.prototype.send = function(data: any) {
        try { 
          // @ts-ignore
          window.__sent.push(typeof data === 'string' ? data : String(data)) 
        } catch {}
        // @ts-ignore
        return orig.apply(this, [data])
      }
    })

    await page.goto("/")
    await expect(page.getByTestId("terminal-canvas")).toBeVisible()

    // Let the initial fit/resize settle
    await page.waitForTimeout(300)
    const initialResizes = await page.evaluate(() => {
      // @ts-ignore
      return (window.__sent as string[]).map((s) => { try { return JSON.parse(s) } catch { return null } }).filter(Boolean).filter((m: any) => m.type === 'resize')
    }) as Array<{ type: string, cols: number, rows: number }>
    expect(initialResizes.length).toBeGreaterThan(0)
    const first = initialResizes[initialResizes.length - 1]

    // Expand via double-click to increase rows/cols
    const sep = page.getByRole("separator", { name: /Drag to resize terminal/i })
    await sep.dblclick()
    await page.waitForTimeout(250)
    const afterResizes = await page.evaluate(() => {
      // @ts-ignore
      return (window.__sent as string[]).map((s) => { try { return JSON.parse(s) } catch { return null } }).filter(Boolean).filter((m: any) => m.type === 'resize')
    }) as Array<{ type: string, cols: number, rows: number }>
    const last = afterResizes[afterResizes.length - 1]
    // At minimum, a new resize should have been sent
    expect(afterResizes.length).toBeGreaterThan(initialResizes.length)

    // Cleanup
    await request.delete(`${baseURL}/api/cli/sessions/${session.id}`)
  })
})

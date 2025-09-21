import { describe, test, expect } from "@rstest/core"
import { waitFor, retry, withTimeout } from "./async"

describe("test utils async helpers", () => {
  test("waitFor resolves when condition becomes true", async () => {
    let ready = false
    setTimeout(() => {
      ready = true
    }, 10)

    await expect(waitFor(() => ready, { timeout: 200, interval: 5 })).resolves.toBeUndefined()
  })

  test("waitFor rejects when condition stays false", async () => {
    await expect(waitFor(() => false, { timeout: 30, interval: 5 })).rejects.toThrow(
      /Condition not met within timeout/,
    )
  })

  test("retry retries failed attempts until success", async () => {
    let attempts = 0
    const result = await retry(async () => {
      attempts += 1
      if (attempts < 3) {
        throw new Error("not yet")
      }
      return "done"
    })

    expect(result).toBe("done")
    expect(attempts).toBe(3)
  })

  test("withTimeout rejects when promise does not settle in time", async () => {
    const slow = new Promise<void>(() => {
      /* never resolves */
    })

    await expect(withTimeout(slow, 20, "too slow")).rejects.toThrow(/too slow/)
  })
})

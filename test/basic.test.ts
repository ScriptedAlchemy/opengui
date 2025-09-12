import { describe, test, expect } from "@rstest/core"

describe("Basic Test", () => {
  test("should pass", () => {
    expect(1 + 1).toBe(2)
  })

  test("should handle strings", () => {
    expect("hello").toBe("hello")
  })
})
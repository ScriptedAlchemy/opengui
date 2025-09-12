import { describe, test, expect } from "@rstest/core"
import { z } from "zod"
import { NamedError, ValidationError, NotFoundError, ConflictError, InternalError, isNamedError, getErrorMessage, getErrorCode } from "../../src/util/error"

describe("error utilities", () => {
  test("NamedError.create builds class and toObject", () => {
    const Custom = NamedError.create("CustomError", z.object({ reason: z.string() }))
    const e = new Custom({ reason: "nope" })
    const obj = e.toObject()
    expect(obj.name).toBe("CustomError")
    expect(obj.data.reason).toBe("nope")
    expect(isNamedError(e)).toBe(true)
    expect(getErrorCode(e)).toBe("CustomError")
  })

  test("built-in errors shape and message helpers", () => {
    const v = new ValidationError("bad", "field")
    const n = new NotFoundError("missing")
    const c = new ConflictError("exists")
    const i = new InternalError("boom")
    expect(getErrorMessage(v)).toBe("bad")
    expect(v.toObject().data.field).toBe("field")
    expect(n.toObject().name).toBe("NotFoundError")
    expect(c.toObject().name).toBe("ConflictError")
    expect(i.toObject().data.message).toBe("boom")
    expect(getErrorMessage("x")).toBe("x")
    expect(getErrorMessage(123)).toBe("Unknown error occurred")
  })
})

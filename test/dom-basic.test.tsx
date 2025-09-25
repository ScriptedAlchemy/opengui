import { describe, test, expect } from "@rstest/core"
import {
  NamedError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalError,
  isNamedError,
  getErrorMessage,
  getErrorCode,
} from "../src/util/error"
import { z } from "zod"

describe("Error Utilities", () => {
  describe("NamedError", () => {
    test("creates custom error classes", () => {
      const CustomError = NamedError.create(
        "CustomError",
        z.object({
          code: z.number(),
          details: z.string(),
        }),
      )

      const error = new CustomError({ code: 404, details: "Resource not found" })

      expect(error.name).toBe("CustomError")
      expect(error.data.code).toBe(404)
      expect(error.data.details).toBe("Resource not found")
      expect(error instanceof NamedError).toBe(true)
      expect(error instanceof Error).toBe(true)
    })

    test("has correct schema", () => {
      const CustomError = NamedError.create(
        "TestError",
        z.object({
          message: z.string(),
        }),
      )

      const error = new CustomError({ message: "test" })
      const schema = error.schema()

      expect(schema).toBeDefined()
      expect(schema.parse({ name: "TestError", data: { message: "test" } })).toEqual({
        name: "TestError",
        data: { message: "test" },
      })
    })

    test("converts to object correctly", () => {
      const CustomError = NamedError.create(
        "TestError",
        z.object({
          value: z.number(),
        }),
      )

      const error = new CustomError({ value: 42 })
      const obj = error.toObject()

      expect(obj).toEqual({
        name: "TestError",
        data: { value: 42 },
      })
    })

    test("has isInstance method", () => {
      const CustomError = NamedError.create(
        "TestError",
        z.object({
          message: z.string(),
        }),
      )

      const error = new CustomError({ message: "test" })
      const regularError = new Error("regular")

      expect(CustomError.isInstance(error)).toBe(true)
      expect(CustomError.isInstance(regularError)).toBe(false)
      expect(CustomError.isInstance({ name: "TestError" })).toBe(true)
      expect(CustomError.isInstance({ name: "OtherError" })).toBe(false)
    })

    test("has Unknown error class", () => {
      const error = new NamedError.Unknown({ message: "Something went wrong" })

      expect(error.name).toBe("UnknownError")
      expect(error.data.message).toBe("Something went wrong")
    })
  })

  describe("ValidationError", () => {
    test("creates validation error with message", () => {
      const error = new ValidationError("Invalid input")

      expect(error.name).toBe("ValidationError")
      expect(error.message).toBe("Invalid input")
      expect(error.field).toBeUndefined()
      expect(error instanceof NamedError).toBe(true)
    })

    test("creates validation error with field", () => {
      const error = new ValidationError("Required field", "email")

      expect(error.message).toBe("Required field")
      expect(error.field).toBe("email")
    })

    test("converts to object correctly", () => {
      const error = new ValidationError("Invalid email", "email")
      const obj = error.toObject()

      expect(obj).toEqual({
        name: "ValidationError",
        data: {
          message: "Invalid email",
          field: "email",
        },
      })
    })

    test("has correct schema", () => {
      const error = new ValidationError("test")
      const schema = error.schema()

      expect(schema.parse({ message: "test", field: "name" })).toEqual({
        message: "test",
        field: "name",
      })

      expect(schema.parse({ message: "test" })).toEqual({
        message: "test",
      })
    })
  })

  describe("NotFoundError", () => {
    test("creates not found error", () => {
      const error = new NotFoundError("Resource not found")

      expect(error.name).toBe("NotFoundError")
      expect(error.message).toBe("Resource not found")
      expect(error instanceof NamedError).toBe(true)
    })

    test("converts to object correctly", () => {
      const error = new NotFoundError("User not found")
      const obj = error.toObject()

      expect(obj).toEqual({
        name: "NotFoundError",
        data: {
          message: "User not found",
        },
      })
    })
  })

  describe("ConflictError", () => {
    test("creates conflict error", () => {
      const error = new ConflictError("Resource already exists")

      expect(error.name).toBe("ConflictError")
      expect(error.message).toBe("Resource already exists")
      expect(error instanceof NamedError).toBe(true)
    })

    test("converts to object correctly", () => {
      const error = new ConflictError("Email already taken")
      const obj = error.toObject()

      expect(obj).toEqual({
        name: "ConflictError",
        data: {
          message: "Email already taken",
        },
      })
    })
  })

  describe("InternalError", () => {
    test("creates internal error", () => {
      const error = new InternalError("Database connection failed")

      expect(error.name).toBe("InternalError")
      expect(error.message).toBe("Database connection failed")
      expect(error instanceof NamedError).toBe(true)
    })

    test("converts to object correctly", () => {
      const error = new InternalError("Server error")
      const obj = error.toObject()

      expect(obj).toEqual({
        name: "InternalError",
        data: {
          message: "Server error",
        },
      })
    })
  })

  describe("isNamedError", () => {
    test("identifies NamedError instances", () => {
      const namedError = new ValidationError("test")
      const regularError = new Error("test")
      const notError = { message: "test" }

      expect(isNamedError(namedError)).toBe(true)
      expect(isNamedError(regularError)).toBe(false)
      expect(isNamedError(notError)).toBe(false)
      expect(isNamedError(null)).toBe(false)
      expect(isNamedError(undefined)).toBe(false)
    })
  })

  describe("getErrorMessage", () => {
    test("extracts message from Error instances", () => {
      const error = new Error("Test error message")
      expect(getErrorMessage(error)).toBe("Test error message")
    })

    test("extracts message from NamedError instances", () => {
      const error = new ValidationError("Validation failed")
      expect(getErrorMessage(error)).toBe("Validation failed")
    })

    test("handles string errors", () => {
      expect(getErrorMessage("String error")).toBe("String error")
    })

    test("handles unknown error types", () => {
      expect(getErrorMessage(null)).toBe("Unknown error occurred")
      expect(getErrorMessage(undefined)).toBe("Unknown error occurred")
      expect(getErrorMessage(42)).toBe("Unknown error occurred")
      expect(getErrorMessage({})).toBe("Unknown error occurred")
    })
  })

  describe("getErrorCode", () => {
    test("extracts code from NamedError instances", () => {
      const validationError = new ValidationError("test")
      const notFoundError = new NotFoundError("test")
      const conflictError = new ConflictError("test")
      const internalError = new InternalError("test")

      expect(getErrorCode(validationError)).toBe("ValidationError")
      expect(getErrorCode(notFoundError)).toBe("NotFoundError")
      expect(getErrorCode(conflictError)).toBe("ConflictError")
      expect(getErrorCode(internalError)).toBe("InternalError")
    })

    test("returns undefined for regular errors", () => {
      const regularError = new Error("test")
      expect(getErrorCode(regularError)).toBeUndefined()
    })

    test("returns undefined for non-error values", () => {
      expect(getErrorCode("string")).toBeUndefined()
      expect(getErrorCode(null)).toBeUndefined()
      expect(getErrorCode(undefined)).toBeUndefined()
      expect(getErrorCode({})).toBeUndefined()
    })
  })

  describe("Error inheritance and polymorphism", () => {
    test("all custom errors are instances of NamedError", () => {
      const validation = new ValidationError("test")
      const notFound = new NotFoundError("test")
      const conflict = new ConflictError("test")
      const internal = new InternalError("test")

      expect(validation instanceof NamedError).toBe(true)
      expect(notFound instanceof NamedError).toBe(true)
      expect(conflict instanceof NamedError).toBe(true)
      expect(internal instanceof NamedError).toBe(true)
    })

    test("all custom errors are instances of Error", () => {
      const validation = new ValidationError("test")
      const notFound = new NotFoundError("test")
      const conflict = new ConflictError("test")
      const internal = new InternalError("test")

      expect(validation instanceof Error).toBe(true)
      expect(notFound instanceof Error).toBe(true)
      expect(conflict instanceof Error).toBe(true)
      expect(internal instanceof Error).toBe(true)
    })

    test("errors can be caught and handled polymorphically", () => {
      const errors = [
        new ValidationError("validation"),
        new NotFoundError("not found"),
        new ConflictError("conflict"),
        new InternalError("internal"),
      ]

      errors.forEach((error) => {
        expect(() => {
          throw error
        }).toThrow(NamedError as unknown as { new (...args: any[]): Error })
        expect(() => {
          throw error
        }).toThrow(Error)
      })
    })
  })
})

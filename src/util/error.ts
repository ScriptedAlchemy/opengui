/**
 * Error utilities for OpenCode Web UI
 * Compatible with OpenCode core error system
 */

import { z, type ZodSchema } from "zod"

// Add openapi method to z object if not available
declare module "zod" {
  interface ZodType {
    openapi(options: { ref: string }): this
  }
}

// Extend Zod with openapi functionality if not already available
if (!("openapi" in z.object({}))) {
  ;(z as any).ZodType.prototype.openapi = function (_options: { ref: string }) {
    return this
  }
}

export abstract class NamedError extends Error {
  abstract schema(): ZodSchema
  abstract toObject(): { name: string; data: any }

  static create<Name extends string, Data extends ZodSchema>(name: Name, data: Data) {
    const schema = z
      .object({
        name: z.literal(name),
        data,
      })
      .openapi({
        ref: name,
      })
    const result = class extends NamedError {
      public static readonly Schema = schema

      public readonly name = name as Name

      constructor(
        public readonly data: z.input<Data>,
        options?: ErrorOptions
      ) {
        super(name, options)
        this.name = name
      }

      static isInstance(input: any): input is InstanceType<typeof result> {
        return "name" in input && input.name === name
      }

      schema() {
        return schema
      }

      toObject() {
        return {
          name: name,
          data: this.data,
        }
      }
    }
    Object.defineProperty(result, "name", { value: name })
    return result
  }

  public static readonly Unknown = NamedError.create(
    "UnknownError",
    z.object({
      message: z.string(),
    })
  )
}

export class ValidationError extends NamedError {
  readonly name = "ValidationError"

  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message)
    this.name = "ValidationError"
  }

  schema() {
    return z.object({
      message: z.string(),
      field: z.string().optional(),
    })
  }

  toObject() {
    return {
      name: "ValidationError",
      data: {
        message: this.message,
        field: this.field,
      },
    }
  }
}

export class NotFoundError extends NamedError {
  readonly name = "NotFoundError"

  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
  }

  schema() {
    return z.object({
      message: z.string(),
    })
  }

  toObject() {
    return {
      name: "NotFoundError",
      data: {
        message: this.message,
      },
    }
  }
}

export class ConflictError extends NamedError {
  readonly name = "ConflictError"

  constructor(message: string) {
    super(message)
    this.name = "ConflictError"
  }

  schema() {
    return z.object({
      message: z.string(),
    })
  }

  toObject() {
    return {
      name: "ConflictError",
      data: {
        message: this.message,
      },
    }
  }
}

export class InternalError extends NamedError {
  readonly name = "InternalError"

  constructor(message: string) {
    super(message)
    this.name = "InternalError"
  }

  schema() {
    return z.object({
      message: z.string(),
    })
  }

  toObject() {
    return {
      name: "InternalError",
      data: {
        message: this.message,
      },
    }
  }
}

export function isNamedError(error: unknown): error is NamedError {
  return error instanceof NamedError
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  return "Unknown error occurred"
}

export function getErrorCode(error: unknown): string | undefined {
  if (isNamedError(error)) {
    return error.name
  }
  return undefined
}

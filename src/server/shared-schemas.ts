/**
 * Shared Validation Schemas and Error Definitions
 *
 * This module contains shared validation schemas and error response definitions
 * used across multiple route modules.
 */

import { z } from "zod"
import { resolver } from "hono-openapi/zod"

/**
 * Common error response schemas for API endpoints
 */
export const ERRORS = {
  400: {
    description: "Bad request",
    content: {
      "application/json": {
        schema: resolver(
          z
            .object({
              data: z.record(z.string(), z.any()),
            })
            .openapi({
              ref: "Error",
            })
        ),
      },
    },
  },
  404: {
    description: "Project not found",
    content: {
      "application/json": {
        schema: resolver(
          z
            .object({
              data: z.record(z.string(), z.any()),
            })
            .openapi({
              ref: "Error",
            })
        ),
      },
    },
  },
} as const

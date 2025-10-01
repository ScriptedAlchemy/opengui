/**
 * Shared Validation Schemas and Error Definitions
 *
 * This module contains shared validation schemas and error response definitions
 * used across multiple route modules.
 */

import { z } from "zod"

/**
 * Common error response schemas for API endpoints
 */
export const ERRORS = {
  400: {
    description: "Bad request",
    content: {
      "application/json": {
        schema: z.object({
          error: z.string(),
        }),
      },
    },
  },
  404: {
    description: "Not found",
    content: {
      "application/json": {
        schema: z.object({
          error: z.string(),
        }),
      },
    },
  },
} as const

/**
 * Project Management Validation Schemas
 *
 * This module contains all validation schemas related to project management operations.
 */

import { z } from "zod"
import { extendZodWithOpenApi } from "zod-openapi"

// Extend zod with OpenAPI functionality
extendZodWithOpenApi(z)

/**
 * Schema for creating a new project
 */
export const ProjectCreateSchema = z.object({
  path: z.string().min(1, "Project path is required"),
  name: z.string().min(1, "Project name is required"),
})

/**
 * Schema for updating an existing project
 */
export const ProjectUpdateSchema = z.object({
  name: z.string().optional(),
})

/**
 * Schema for project information response
 */
export const ProjectInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  port: z.number(),
  status: z.enum(["stopped", "starting", "running", "error"]),
  lastAccessed: z.number(),
  gitRoot: z.string().optional(),
  commitHash: z.string().optional(),
})

/**
 * Schema for resource usage information
 */
export const ResourceUsageSchema = z.object({
  memory: z.object({
    used: z.number(),
    total: z.number(),
  }),
  port: z.number().optional(),
  cpu: z
    .object({
      usage: z.number(),
    })
    .optional(),
})

/**
 * Schema for activity events
 */
export const ActivityEventSchema = z.object({
  id: z.string(),
  type: z.enum([
    "session_created",
    "file_changed",
    "agent_used",
    "project_started",
    "project_stopped",
  ]),
  message: z.string(),
  timestamp: z.string(),
})

/**
 * Schema for activity feed (array of events)
 */
export const ActivityFeedSchema = z.array(ActivityEventSchema)

/**
 * TypeScript types inferred from schemas
 */
export type ProjectInfo = z.infer<typeof ProjectInfoSchema>
export type ProjectCreate = z.infer<typeof ProjectCreateSchema>
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>
export type ResourceUsage = z.infer<typeof ResourceUsageSchema>
export type ActivityEvent = z.infer<typeof ActivityEventSchema>
export type ActivityFeed = z.infer<typeof ActivityFeedSchema>

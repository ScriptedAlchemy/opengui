/**
 * Project Management Validation Schemas
 *
 * This module contains all validation schemas related to project management operations.
 */

import { z } from "zod"

/**
 * Schema for creating a new project
 */
const absolutePathRegex = /^(?:[A-Za-z]:[\\/]{1}|\\\\|\/)/

export const ProjectCreateSchema = z.object({
  path: z
    .string()
    .min(1, "Project path is required")
    .refine((value) => absolutePathRegex.test(value.trim()), {
      message: "Project path must be absolute",
    }),
  name: z.string().min(1, "Project name is required").optional(),
})

/**
 * Schema for updating an existing project
 */
export const ProjectUpdateSchema = z.object({
  name: z.string().optional(),
})

export const WorktreeInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  path: z.string(),
  relativePath: z.string().optional(),
  branch: z.string().optional(),
  head: z.string().optional(),
  isPrimary: z.boolean().optional(),
  isDetached: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  lockReason: z.string().optional(),
})

/**
 * Schema for project information response
 */
export const ProjectInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  status: z.enum(["running", "stopped"]).optional(),
  lastAccessed: z.number(),
  gitRoot: z.string().optional(),
  commitHash: z.string().optional(),
  worktrees: z.array(WorktreeInfoSchema).optional(),
})

export const DirectoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDirectory: z.literal(true),
})

export const DirectoryListingSchema = z.object({
  path: z.string(),
  parent: z.string().nullable(),
  entries: DirectoryEntrySchema.array(),
})

export const HomeDirectorySchema = z.object({
  path: z.string(),
})

/**
 * TypeScript types inferred from schemas
 */
export type ProjectInfo = z.infer<typeof ProjectInfoSchema>
export type ProjectCreate = z.infer<typeof ProjectCreateSchema>
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>
export type DirectoryListing = z.infer<typeof DirectoryListingSchema>

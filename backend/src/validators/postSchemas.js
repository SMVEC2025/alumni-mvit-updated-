import { z } from 'zod'

const tag = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Tags may only contain letters, numbers, and hyphens.')

// Normalise tags: strip a leading '#', dedupe, cap at 5.
const tagsField = z
  .array(z.string())
  .optional()
  .transform((arr) => {
    if (!arr) return []
    const cleaned = arr
      .map((t) => String(t).trim().replace(/^#+/, '').toLowerCase())
      .filter(Boolean)
    return [...new Set(cleaned)].slice(0, 5)
  })
  .pipe(z.array(tag).max(5))

export const postCreateSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(160),
    body: z.string().trim().min(1, 'Write something before posting.').max(20000),
    coverImageUrl: z.string().trim().url().max(500).optional().nullable().or(z.literal('')),
    tags: tagsField,
  })
  .strip()

export const postUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    body: z.string().trim().min(1).max(20000).optional(),
    coverImageUrl: z.string().trim().url().max(500).optional().nullable().or(z.literal('')),
    tags: tagsField.optional(),
  })
  .strip()

export const postListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  search: z.string().trim().max(120).optional(),
  tag: z
    .string()
    .trim()
    .toLowerCase()
    .max(30)
    .optional(),
  author: z.string().trim().max(64).optional(), // authorId — filter to one alumni's posts
  mine: z.coerce.boolean().optional(),
})

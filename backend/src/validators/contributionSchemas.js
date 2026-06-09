import { z } from 'zod'
import {
  CONTRIBUTION_TYPES,
  CONTRIBUTION_STATUSES,
  CONTRIBUTION_MODES,
} from '../models/Contribution.js'

// A single domain/skill tag — lowercase, letters/numbers/hyphen/space.
const domain = z
  .string()
  .trim()
  .min(1)
  .max(40)

// Normalise domains: trim, dedupe, cap at 8.
const domainsField = z
  .array(z.string())
  .optional()
  .transform((arr) => {
    if (!arr) return []
    const cleaned = arr.map((t) => String(t).trim()).filter(Boolean)
    return [...new Set(cleaned)].slice(0, 8)
  })
  .pipe(z.array(domain).max(8))

const optUrl = z.string().trim().url().max(500).optional().nullable().or(z.literal(''))
const optStr = (max) => z.string().trim().max(max).optional().nullable().or(z.literal(''))

export const contributionCreateSchema = z
  .object({
    type: z.enum(CONTRIBUTION_TYPES),
    title: z.string().trim().min(4, 'Title must be at least 4 characters.').max(160),
    description: z.string().trim().min(10, 'Please describe your contribution (min 10 chars).').max(8000),
    domains: domainsField,
    mode: z.enum(CONTRIBUTION_MODES).optional().default('flexible'),
    availability: optStr(200),
    company: optStr(200),
    link: optUrl,
  })
  .strip()

export const contributionUpdateSchema = z
  .object({
    title: z.string().trim().min(4).max(160).optional(),
    description: z.string().trim().min(10).max(8000).optional(),
    domains: domainsField.optional(),
    mode: z.enum(CONTRIBUTION_MODES).optional(),
    availability: optStr(200),
    company: optStr(200),
    link: optUrl,
  })
  .strip()

export const contributionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  type: z.enum(CONTRIBUTION_TYPES).optional(),
  status: z.enum(CONTRIBUTION_STATUSES).optional(), // staff-only filter
  search: z.string().trim().max(120).optional(),
  mine: z.coerce.boolean().optional(),
})

// Staff review action.
export const contributionReviewSchema = z
  .object({
    status: z.enum(['approved', 'featured', 'archived', 'pending']),
    reviewNote: optStr(500),
  })
  .strip()

// A student/junior expressing interest.
export const contributionInterestSchema = z
  .object({
    note: optStr(500),
  })
  .strip()

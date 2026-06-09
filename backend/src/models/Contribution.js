import mongoose from 'mongoose'
import { v4 as uuid } from 'uuid'

// An alumnus's offer to give back to the institute / students. Each contribution
// is a typed entry (mentorship, success story, campus talk, referral, workshop,
// project guidance). Alumni submit; staff review (approve / feature / archive)
// before it's visible to others. Body text is plain and escaped on render.
export const CONTRIBUTION_TYPES = [
  'mentorship',
  'campus_visit',
  'referral',
  'workshop',
  'project_guidance',
]

export const CONTRIBUTION_STATUSES = ['pending', 'approved', 'featured', 'archived']

// Modes of engagement (how the alumnus wants to help).
export const CONTRIBUTION_MODES = ['online', 'in_person', 'hybrid', 'flexible']

const contributionSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    contributorId: { type: String, required: true, ref: 'User', index: true },

    type: { type: String, required: true, enum: CONTRIBUTION_TYPES, index: true },

    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, maxlength: 8000 },

    // ── Type-specific, all optional (relevance depends on `type`) ──
    // Skills / domains the alumnus can help with (mentorship, project guidance).
    domains: { type: [String], default: [] },
    // How they want to engage.
    mode: { type: String, enum: CONTRIBUTION_MODES, default: 'flexible' },
    // Free-text availability ("weekends", "1 hr/week", "Aug–Oct").
    availability: { type: String, default: null, trim: true, maxlength: 200 },
    // For referrals / workshops run at a company.
    company: { type: String, default: null, trim: true, maxlength: 200 },
    // Optional external link (job posting, portfolio, scheduling link).
    link: { type: String, default: null, trim: true, maxlength: 500 },

    coverImageUrl: { type: String, default: null },

    // ── Moderation / lifecycle ──
    status: { type: String, required: true, enum: CONTRIBUTION_STATUSES, default: 'pending', index: true },
    // Staff note shown to the contributor (e.g. why archived).
    reviewNote: { type: String, default: null, maxlength: 500 },
    reviewedBy: { type: String, default: null, ref: 'User' },
    reviewedAt: { type: Date, default: null },

    // How many people have expressed interest (students/juniors clicking "I'm interested").
    interestCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, _id: false }
)

// Public listing: approved/featured first, newest first.
contributionSchema.index({ status: 1, createdAt: -1 })
contributionSchema.index({ type: 1, status: 1, createdAt: -1 })
contributionSchema.index({ title: 'text', description: 'text', domains: 'text' })

export const Contribution = mongoose.model('Contribution', contributionSchema)

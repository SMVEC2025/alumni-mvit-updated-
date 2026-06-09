import mongoose from 'mongoose'

// One row per (contribution, user) interest. The compound unique index makes
// expressing interest idempotent — a user can register interest at most once.
const contributionInterestSchema = new mongoose.Schema(
  {
    contributionId: { type: String, required: true, ref: 'Contribution', index: true },
    userId: { type: String, required: true, ref: 'User', index: true },
    // Optional short message from the interested person to the contributor.
    note: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

contributionInterestSchema.index({ contributionId: 1, userId: 1 }, { unique: true })

export const ContributionInterest = mongoose.model('ContributionInterest', contributionInterestSchema)

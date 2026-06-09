import mongoose from 'mongoose'

// One row per (post, user) like. The compound unique index makes liking
// idempotent — a user can like a post at most once.
const postLikeSchema = new mongoose.Schema(
  {
    postId: { type: String, required: true, ref: 'Post', index: true },
    userId: { type: String, required: true, ref: 'User', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

postLikeSchema.index({ postId: 1, userId: 1 }, { unique: true })

export const PostLike = mongoose.model('PostLike', postLikeSchema)

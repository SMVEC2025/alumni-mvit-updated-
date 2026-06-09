import mongoose from 'mongoose'
import { v4 as uuid } from 'uuid'

// An alumni blog post (LinkedIn-style). Body is stored as plain text and
// escaped on render — no HTML is trusted.
const postSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    authorId: { type: String, required: true, ref: 'User', index: true },

    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, maxlength: 20000 },
    coverImageUrl: { type: String, default: null },
    tags: { type: [String], default: [], index: true },

    likeCount: { type: Number, default: 0, min: 0 },

    // Staff moderation: a hidden post is removed from the public feed.
    isHidden: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, _id: false }
)

postSchema.index({ createdAt: -1 })
postSchema.index({ title: 'text', body: 'text', tags: 'text' })

export const Post = mongoose.model('Post', postSchema)

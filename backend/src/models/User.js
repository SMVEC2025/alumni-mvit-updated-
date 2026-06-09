import mongoose from 'mongoose'
import { v4 as uuid } from 'uuid'

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^[0-9]{10}$/, 'mobileNumber must be 10 digits'],
    },
    passwordHash: { type: String, default: null },
    role: {
      type: String,
      enum: ['alumni', 'staff', 'admin'],
      default: 'alumni',
      index: true,
    },
  },
  { timestamps: true, _id: false }
)

export const User = mongoose.model('User', userSchema)

import mongoose from 'mongoose'
import { v4 as uuid } from 'uuid'

const facultySchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    employeeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^[0-9]{10}$/, 'mobileNumber must be 10 digits'],
    },
  },
  { timestamps: true, _id: false }
)

export const Faculty = mongoose.model('Faculty', facultySchema)

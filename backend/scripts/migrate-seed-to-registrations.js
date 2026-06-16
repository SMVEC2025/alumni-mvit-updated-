/**
 * One-time migration: copy alumni_records (breach seed) into alumni_registrations
 * as status:'unverified' so they appear in the directory before the person logs in.
 *
 * Safe to re-run — skips rows where a registration already exists for that phone.
 */

import mongoose from 'mongoose'
import { v4 as uuid } from 'uuid'

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL
if (!MONGO_URI) {
  console.error('MONGO_URI / MONGODB_URI / DATABASE_URL not set')
  process.exit(1)
}

await mongoose.connect(MONGO_URI)
console.log('Connected to MongoDB')

const seedCol = mongoose.connection.collection('alumni_records')
const regCol  = mongoose.connection.collection('alumni_registrations')

const seeds = await seedCol.find({}).toArray()
console.log(`Found ${seeds.length} seed rows in alumni_records`)

// Build set of phones already registered
const existingPhones = new Set()
for await (const doc of regCol.find({}, { projection: { phone: 1 } })) {
  if (doc.phone) existingPhones.add(String(doc.phone).trim())
}
console.log(`${existingPhones.size} phones already in alumni_registrations — will skip`)

const toInsert = []
for (const row of seeds) {
  const phone = row.phone ? String(row.phone).trim() : null
  if (!phone || existingPhones.has(phone)) continue

  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null
  toInsert.push({
    _id: uuid(),
    // userId intentionally omitted (not null) so the sparse unique index ignores it
    name,
    email: row.email ?? null,
    phone,
    degree: row.degree ?? null,
    department: row.department ?? null,
    yearOfCompletion: row.year_of_completion ?? null,
    rollNumber: row.roll_number != null ? String(row.roll_number) : null,
    address: {
      line1:   row.address  ?? null,
      city:    row.city     ?? null,
      state:   row.state    ?? null,
      country: row.country  ?? null,
      pincode: row.pincode  != null ? String(row.pincode) : null,
    },
    image:           row.profile_image_url ?? null,
    coverImage:      row.cover_image_url   ?? null,
    linkedinUrl:     row.linkedin_url      ?? null,
    workExperiences: Array.isArray(row.work_experiences) ? row.work_experiences : [],
    showPhone:  row.show_phone  ?? true,
    showEmail:  row.show_email  ?? true,
    isDisabled: false,
    status:     'unverified',
    source:     'recovered',
    createdAt:  new Date(),
    updatedAt:  new Date(),
  })
}

console.log(`${toInsert.length} new records to insert`)

// Try inserting first one individually to surface the real error
if (toInsert.length > 0) {
  try {
    await regCol.insertOne(toInsert[0])
    console.log('Single insert OK')
  } catch (err) {
    console.error('Single insert ERROR:', err.message)
    console.error('Error code:', err.code)
    console.error('Key pattern:', err.keyPattern)
    console.error('Key value:', err.keyValue)
    await mongoose.disconnect()
    process.exit(1)
  }
}

let inserted = 1
let errors   = 0

const BATCH = 100
for (let i = 1; i < toInsert.length; i += BATCH) {
  const batch = toInsert.slice(i, i + BATCH)
  try {
    const result = await regCol.insertMany(batch, { ordered: false })
    inserted += result.insertedCount
    process.stdout.write(`\r  inserted ${inserted}/${toInsert.length}...`)
  } catch (err) {
    const ok = err.result?.insertedCount ?? 0
    inserted += ok
    errors   += err.writeErrors?.length ?? batch.length
    if (err.writeErrors?.length > 0) {
      const first = err.writeErrors[0]
      console.error(`\nSample write error: code=${first.code} errmsg=${first.errmsg?.slice(0, 120)}`)
    }
    process.stdout.write(`\r  inserted ${inserted}/${toInsert.length} (${errors} errors)...`)
  }
}

console.log(`\n\nDone. inserted=${inserted}  skipped=${seeds.length - toInsert.length}  errors=${errors}`)
await mongoose.disconnect()

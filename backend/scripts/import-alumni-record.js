// One-time import: load the breach-recovered alumni data (data/supaabse.json)
// into MongoDB, mapped to the app's RegisteredAlumni shape, in the
// `alumni_record` collection. Upserts by user_id so it is safe to re-run.
//
//   node scripts/import-alumni-record.js          # real import
//   node scripts/import-alumni-record.js --dry     # report only, no writes
//
// Recovered records (first_name present) keep status 'unverified' with their
// recovered fields; the rest carry only the intact identity fields.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { connectMongo, disconnectMongo } from '../src/db/mongo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.resolve(__dirname, '../../data/supaabse.json')
const COLLECTION = 'alumni_record'
const DRY = process.argv.includes('--dry')

function fullName(r) {
  const n = [r.first_name, r.last_name].filter(Boolean).join(' ').trim()
  return n || null
}

// roll -> numeric enrollNo only; lateral-entry rolls (e.g. 2021L05026) -> null
function numericEnroll(roll) {
  if (roll == null) return null
  const s = String(roll).trim()
  return /^[0-9]+$/.test(s) ? Number(s) : null
}

function toAddress(r) {
  const a = {
    line1: r.address ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    country: r.country ?? null,
    pincode: r.pincode != null ? String(r.pincode) : null,
  }
  // collapse to null if entirely empty
  return Object.values(a).some((v) => v != null) ? a : {}
}

function toCompanyDetails(r) {
  if (!Array.isArray(r.work_experiences)) return []
  return r.work_experiences
    .filter(Boolean)
    .map((w) => ({
      company: w.company ?? null,
      designation: w.designation ?? null,
      industry: w.industry ?? null,
      experience: w.experience ?? null,
    }))
}

function mapRecord(r) {
  const recovered = r.first_name !== null
  return {
    userId: r.user_id,
    accountId: r.id ?? null,
    name: fullName(r),
    email: r.email ?? null,
    phone: r.phone ?? null,
    degree: r.degree ?? null,
    course: r.department ?? null, // department string -> course
    batch: r.year_of_completion != null ? String(r.year_of_completion) : null,
    enrollNo: numericEnroll(r.roll_number),
    address: toAddress(r),
    image: r.profile_image_url ?? null,
    coverImage: r.cover_image_url ?? null,
    linkedinUrl: r.linkedin_url ?? null,
    companyDetails: toCompanyDetails(r),
    showPhone: r.show_phone ?? false,
    isDisabled: r.is_disabled ?? false,
    status: 'unverified',
    seedSource: recovered ? 'matched' : 'breached',
  }
}

async function run() {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  if (!Array.isArray(raw)) throw new Error('supaabse.json is not an array')

  const docs = raw.map(mapRecord)
  const recovered = docs.filter((d) => d.seedSource === 'matched').length
  const droppedLateral = raw.filter(
    (r) => r.first_name !== null && r.roll_number && numericEnroll(r.roll_number) === null
  ).length

  console.log('Source records:', raw.length)
  console.log('  recovered (status unverified, fields filled):', recovered)
  console.log('  breached (identity only):', docs.length - recovered)
  console.log('  lateral rolls dropped from enrollNo (kept null):', droppedLateral)

  // duplicate guard within the batch
  const seen = new Set()
  const dupUser = []
  const dupEnroll = new Map()
  for (const d of docs) {
    if (seen.has(d.userId)) dupUser.push(d.userId)
    seen.add(d.userId)
    if (d.enrollNo != null) dupEnroll.set(d.enrollNo, (dupEnroll.get(d.enrollNo) || 0) + 1)
  }
  console.log('  duplicate userId in batch:', dupUser.length)
  console.log('  duplicate enrollNo in batch:', [...dupEnroll.values()].filter((v) => v > 1).length)

  if (DRY) {
    console.log('\n--- DRY RUN: sample mapped doc ---')
    console.log(JSON.stringify(docs.find((d) => d.seedSource === 'matched'), null, 2))
    console.log('\nNo writes performed (--dry).')
    return
  }

  await connectMongo()
  const col = mongoose.connection.collection(COLLECTION)

  const ops = docs.map((d) => ({
    updateOne: {
      filter: { userId: d.userId },
      update: { $set: d, $setOnInsert: { createdAt: new Date() }, $currentDate: { updatedAt: true } },
      upsert: true,
    },
  }))

  const res = await col.bulkWrite(ops, { ordered: false })
  console.log('\n✅ Import complete to collection:', COLLECTION)
  console.log('  upserted (new):', res.upsertedCount)
  console.log('  matched/updated (existing):', res.matchedCount)
  console.log('  total in collection now:', await col.countDocuments())
  console.log('  recovered (status unverified, name set):', await col.countDocuments({ name: { $ne: null } }))

  await disconnectMongo()
}

run().catch((e) => {
  console.error('Import failed:', e)
  process.exit(1)
})

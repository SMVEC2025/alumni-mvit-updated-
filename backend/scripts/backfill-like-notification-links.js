// One-time backfill: repoint existing `post_like` notification links to the
// profile of the alumnus who liked the post (was previously linking to the
// post itself). New notifications already do this; this fixes the old rows.
// Run: node scripts/backfill-like-notification-links.js
import { connectMongo, disconnectMongo } from '../src/db/mongo.js'
import { Notification } from '../src/models/Notification.js'
import { Alumni } from '../src/models/Alumni.js'

async function run() {
  await connectMongo()

  const likes = await Notification.find({ type: 'post_like' })
    .select('_id actorId link')
    .lean()

  if (!likes.length) {
    console.log('No post_like notifications to backfill.')
    return
  }

  // Resolve each actor's (non-disabled) alumni profile id in one query.
  const actorIds = [...new Set(likes.map((n) => n.actorId).filter(Boolean))]
  const profiles = await Alumni.find({ userId: { $in: actorIds } })
    .select('_id userId isDisabled')
    .lean()
  const profileByUser = {}
  for (const p of profiles) profileByUser[p.userId] = p.isDisabled ? null : p._id

  let updated = 0
  let skipped = 0
  for (const n of likes) {
    const profileId = profileByUser[n.actorId]
    if (!profileId) { skipped++; continue } // no linkable profile → leave as-is
    const nextLink = `/directory/alumni/${profileId}`
    if (n.link === nextLink) { skipped++; continue }
    await Notification.updateOne({ _id: n._id }, { $set: { link: nextLink } })
    updated++
  }

  console.log(`Backfill complete: ${updated} updated, ${skipped} skipped (of ${likes.length} total).`)
}

run()
  .catch((err) => { console.error('Backfill failed:', err); process.exitCode = 1 })
  .finally(() => disconnectMongo())

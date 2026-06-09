// Seeds a few records for local testing:
//  - one faculty (→ staff role on login)
//  - a couple of alumni profiles
// Run: npm run seed
import { connectMongo, disconnectMongo } from '../src/db/mongo.js'
import { User } from '../src/models/User.js'
import { Faculty } from '../src/models/Faculty.js'
import { Alumni } from '../src/models/Alumni.js'

async function run() {
  await connectMongo()

  await Faculty.updateOne(
    { mobileNumber: '9000000001' },
    { $set: { employeeId: 'EMP001', name: 'Test Faculty', mobileNumber: '9000000001' } },
    { upsert: true }
  )

  const u1 = await User.findOneAndUpdate(
    { mobileNumber: '9111111111' },
    { $setOnInsert: { mobileNumber: '9111111111', role: 'alumni' } },
    { upsert: true, new: true }
  )
  const u2 = await User.findOneAndUpdate(
    { mobileNumber: '9222222222' },
    { $setOnInsert: { mobileNumber: '9222222222', role: 'alumni' } },
    { upsert: true, new: true }
  )

  await Alumni.updateOne(
    { userId: u1._id },
    {
      $set: {
        userId: u1._id,
        firstName: 'Asha',
        lastName: 'Kumar',
        email: 'asha@example.com',
        phone: '9111111111',
        showPhone: false,
        showEmail: true,
        department: 'CSE',
        degree: 'B.Tech',
        yearOfCompletion: 2020,
        company: 'Acme Corp',
        designation: 'Engineer',
        city: 'Chennai',
        state: 'Tamil Nadu',
        isDisabled: false,
      },
    },
    { upsert: true }
  )
  await Alumni.updateOne(
    { userId: u2._id },
    {
      $set: {
        userId: u2._id,
        firstName: 'Ravi',
        lastName: 'Sharma',
        email: 'ravi@example.com',
        phone: '9222222222',
        showPhone: true,
        showEmail: true,
        department: 'ECE',
        degree: 'B.Tech',
        yearOfCompletion: 2019,
        company: 'Globex',
        designation: 'Manager',
        city: 'Bengaluru',
        state: 'Karnataka',
        isDisabled: false,
      },
    },
    { upsert: true }
  )

  console.log('✅ Seed complete')
  await disconnectMongo()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

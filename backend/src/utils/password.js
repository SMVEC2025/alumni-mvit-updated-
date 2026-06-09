import bcrypt from 'bcryptjs'

const COST = 12

export async function hashPassword(raw) {
  return bcrypt.hash(String(raw), COST)
}

export async function verifyPassword(raw, hash) {
  if (!hash) {
    // Spend ~equal time even when no hash exists, to avoid timing-based
    // user enumeration ("does this account have a password?").
    await bcrypt.hash(String(raw), COST)
    return false
  }
  return bcrypt.compare(String(raw), hash)
}

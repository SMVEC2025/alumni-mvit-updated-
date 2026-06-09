// Compatibility shim. The app no longer uses Supabase — all data access goes
// through the SMVEC Alumni REST API (see apiClient.js + the lib/ modules).
//
// `isSupabaseConfigured` stays true so existing "config missing" guards in the
// pages remain satisfied. `supabase` / `getSupabaseWithSession` are intentionally
// null; any remaining direct callers must be migrated to the api modules.
import { API_BASE } from './apiClient'

export const isSupabaseConfigured = Boolean(API_BASE)
export const supabase = null

export function getSupabaseWithSession() {
  return null
}

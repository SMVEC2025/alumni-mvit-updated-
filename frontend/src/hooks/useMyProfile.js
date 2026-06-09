import { useEffect, useState } from 'react'
import { getUser, onAuthChange } from '../lib/auth'
import { getMyRegistration } from '../lib/alumniApi'
import { useProtectedImageUrl } from './useProtectedImageUrl'

// ── Global current-user profile ────────────────────────────────────────────
// One shared source of truth for the signed-in user's alumni profile so every
// page (navbar, blogs, contribute, …) shows the same name/avatar without each
// re-fetching. Caches the result in-module and de-dupes concurrent fetches;
// invalidated on auth change and on `profile:changed` (dispatch after edits).

let _cache = null            // last loaded { registered, alumni }
let _cacheUserId = null      // user id the cache belongs to
let _inflight = null         // de-dupe concurrent loads
const _subscribers = new Set()

function notify() {
  _subscribers.forEach((fn) => fn(_cache))
}

export function invalidateMyProfile() {
  _cache = null
  _cacheUserId = null
  _inflight = null
  notify()
}

async function loadMyProfile(userId) {
  if (_cache && _cacheUserId === userId) return _cache
  if (_inflight) return _inflight
  _inflight = (async () => {
    try {
      const result = await getMyRegistration()
      _cache = result
      _cacheUserId = userId
      notify()
      return result
    } finally {
      _inflight = null
    }
  })()
  return _inflight
}

// Re-load whenever auth changes or a profile edit broadcasts `profile:changed`.
onAuthChange(() => invalidateMyProfile())

/**
 * Returns the signed-in user's profile data plus a ready-to-render avatar URL.
 *
 * @returns {{
 *   user: object|null,
 *   alumni: object|null,
 *   registered: boolean,
 *   name: string,
 *   initial: string,
 *   profileImageUrl: string,   // resolved (protected) URL, '' when none
 *   loading: boolean,
 * }}
 */
export function useMyProfile() {
  const [user, setUser] = useState(() => getUser())
  const [profile, setProfile] = useState(_cache)
  const [loading, setLoading] = useState(!_cache)

  const isStaff = user?.role === 'staff' || user?.role === 'admin'
  // Alumni profile only needs fetching for non-staff signed-in users; the
  // "no user" and "staff" cases are pure derivations, not fetched state.
  const needsFetch = Boolean(user) && !isStaff

  // Track auth user changes.
  useEffect(() => onAuthChange((next) => setUser(next)), [])

  useEffect(() => {
    if (!needsFetch) return undefined

    let mounted = true
    const onChange = (next) => { if (mounted) setProfile(next) }
    _subscribers.add(onChange)

    const run = () => {
      loadMyProfile(user.id)
        .catch(() => { if (mounted) setProfile({ registered: false, alumni: null }) })
        .finally(() => { if (mounted) setLoading(false) })
    }
    run()

    // Refresh when a profile edit elsewhere broadcasts a change.
    const onProfileChanged = () => { invalidateMyProfile(); run() }
    window.addEventListener('profile:changed', onProfileChanged)

    return () => {
      mounted = false
      _subscribers.delete(onChange)
      window.removeEventListener('profile:changed', onProfileChanged)
    }
  }, [needsFetch, user?.id])

  // Derive the effective profile for non-fetched cases without setState.
  const effectiveProfile = needsFetch ? profile : { registered: false, alumni: null }
  const alumni = effectiveProfile?.alumni || null
  const resolvedName = [alumni?.first_name, alumni?.last_name].filter(Boolean).join(' ')
  const name = resolvedName
    || (/[a-zA-Z]/.test(String(user?.name || '')) ? user.name : '')
    || (isStaff ? 'Staff' : 'Alumni SMVEC')
  const profileImageUrl = useProtectedImageUrl(alumni?.profile_image_url || '')

  return {
    user,
    alumni,
    registered: Boolean(effectiveProfile?.registered),
    name,
    initial: (name || 'A').charAt(0).toUpperCase(),
    profileImageUrl,
    loading: needsFetch ? loading : false,
  }
}

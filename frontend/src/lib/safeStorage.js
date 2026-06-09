function getStorage(kind) {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function safeGet(kind, key) {
  try {
    const storage = getStorage(kind)
    return storage ? storage.getItem(key) : null
  } catch {
    return null
  }
}

function safeSet(kind, key, value) {
  try {
    const storage = getStorage(kind)
    if (!storage) return false
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeRemove(kind, key) {
  try {
    const storage = getStorage(kind)
    if (!storage) return false
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export const safeLocalStorageGet = (key) => safeGet('local', key)
export const safeLocalStorageSet = (key, value) => safeSet('local', key, value)
export const safeLocalStorageRemove = (key) => safeRemove('local', key)

export const safeSessionStorageGet = (key) => safeGet('session', key)
export const safeSessionStorageSet = (key, value) => safeSet('session', key, value)
export const safeSessionStorageRemove = (key) => safeRemove('session', key)

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react'

const initialDirectoryCache = {
  key: '',
  rows: [],
  loaded: false,
  loadedPages: 0,
  totalCount: 0,
  hasMore: false,
  queryKey: '',
  cachedAt: 0,
  uiState: {
    searchInput: '',
    filters: { dept: '', year: '', city: '', company: '' },
    staffVisibilityFilter: 'all',
    sortBy: 'newest',
    view: 'grid',
  },
}

const DirectoryCacheContext = createContext(null)

export function DirectoryCacheProvider({ children }) {
  const [directoryCache, setDirectoryCache] = useState(initialDirectoryCache)

  const value = useMemo(
    () => ({
      directoryCache,
      setDirectoryCache,
      clearDirectoryCache: () => setDirectoryCache(initialDirectoryCache),
    }),
    [directoryCache],
  )

  return (
    <DirectoryCacheContext.Provider value={value}>
      {children}
    </DirectoryCacheContext.Provider>
  )
}

export function useDirectoryCache() {
  const context = useContext(DirectoryCacheContext)
  if (!context) {
    throw new Error('useDirectoryCache must be used within a DirectoryCacheProvider')
  }
  return context
}

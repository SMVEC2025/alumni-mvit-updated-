import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  HiAcademicCap,
  HiOfficeBuilding,
  HiSearch,
  HiViewGrid,
  HiViewList,
  HiLocationMarker,
  HiFilter,
  HiX,
  HiArrowRight,
  HiChevronDown,
} from 'react-icons/hi'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { getUser, onAuthChange, verifySession } from '../../lib/auth'
import { isStudentRegistered } from '../../lib/studentRegistration'
import { setAlumniDisabled } from '../../lib/alumniApi'
import CompanyLogo from '../../components/CompanyLogo'
import { useDirectoryCache } from '../../context/DirectoryCacheContext'
import { useDirectoryNavbar } from '../../context/navbarState'
import { fetchDirectoryFilterMetadata, fetchDirectoryPage } from '../../lib/directoryApi'
import { useProtectedImageUrls } from '../../hooks/useProtectedImageUrl'
import locationFilterOptions from '../../../location-filter-options.json'

const SKELETON_COUNT = 6
const DIRECTORY_PAGE_SIZE = 50
const DEFAULT_DIRECTORY_UI_STATE = {
  searchInput: '',
  filters: { dept: '', year: '', city: '' },
  staffVisibilityFilter: 'all',
  sortBy: 'newest',
  view: 'grid',
}

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function buildDirectoryCacheKey(user) {
  if (!user?.id) return ''
  return `${user.role || 'alumni'}:${user.id}`
}

function normalizeFilterKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const LOCATION_FILTER_CANONICAL_NAMES = {
  pondicheery: 'Puducherry',
  pondicherry: 'Puducherry',
  pondichery: 'Puducherry',
  pondycherry: 'Puducherry',
  pudhucherry: 'Puducherry',
  puducherrt: 'Puducherry',
  puducherry: 'Puducherry',
  puducherrypuducherry: 'Puducherry',
  villupuram: 'Villupuram',
  villupuramdistrict: 'Villupuram',
  villupuramincludingkallakurichidistrict: 'Villupuram',
  villupurm: 'Villupuram',
  viluppuram: 'Villupuram',
  vilupuram: 'Villupuram',
  vizhupuram: 'Villupuram',
  kallakurichi: 'Kallakurichi',
  kallakurichitamilnadu: 'Kallakurichi',
  kallakuruchi: 'Kallakurichi',
  marakanam: 'Marakkanam',
  marakkanam: 'Marakkanam',
  kaaikal: 'Karaikal',
  karaikal: 'Karaikal',
  thirubhuvani: 'Thirubuvanai',
  thirubuvanai: 'Thirubuvanai',
  thirukanur: 'Thirukkanur',
  thirukkanur: 'Thirukkanur',
  thirukovilur: 'Tirukkoyilur',
  tirukkoyilur: 'Tirukkoyilur',
  thiruvannamalai: 'Tiruvannamalai',
  tiruvannamalai: 'Tiruvannamalai',
  panruti: 'Panruti',
  panrutu: 'Panruti',
  villianur: 'Villianur',
  villinanur: 'Villianur',
  villiyanur: 'Villianur',
  thengaithittu: 'Thengaithittu',
  thengathittu: 'Thengaithittu',
  bangalore: 'Bengaluru',
  bengaluru: 'Bengaluru',
}

const LOCATION_FILTER_QUERY_TERMS = {
  [normalizeFilterKey('Puducherry')]: [
    'PONDICHEERY',
    'Pondicherry',
    'Pondichery',
    'pondycherry',
    'Pudhucherry',
    'Puducherrt',
    'Puducherry',
    'Puducherry, Puducherry',
  ],
  [normalizeFilterKey('Villupuram')]: [
    'Villupuram',
    'Villupuram District',
    'VILLUPURAM(INCLUDING KALLAKURICHI DISTRICT)',
    'villupurm',
    'Viluppuram',
    'Vilupuram',
    'Vizhupuram',
  ],
  [normalizeFilterKey('Kallakurichi')]: [
    'Kallakurichi',
    'KALLAKURICHI, TAMIL NADU',
    'Kallakuruchi',
  ],
  [normalizeFilterKey('Marakkanam')]: [
    'Marakanam',
    'Marakkanam',
  ],
  [normalizeFilterKey('Karaikal')]: [
    'Kaaikal',
    'Karaikal',
  ],
  [normalizeFilterKey('Thirubuvanai')]: [
    'Thirubhuvani',
    'Thirubuvanai',
  ],
  [normalizeFilterKey('Thirukkanur')]: [
    'Thirukanur',
    'Thirukkanur',
  ],
  [normalizeFilterKey('Tirukkoyilur')]: [
    'Thirukovilur',
    'Tirukkoyilur',
  ],
  [normalizeFilterKey('Tiruvannamalai')]: [
    'Thiruvannamalai',
    'Tiruvannamalai',
  ],
  [normalizeFilterKey('Panruti')]: [
    'Panruti',
    'Panrutu',
  ],
  [normalizeFilterKey('Villianur')]: [
    'Villianur',
    'Villinanur',
    'Villiyanur',
  ],
  [normalizeFilterKey('Thengaithittu')]: [
    'Thengaithittu',
    'Thengathittu',
  ],
  [normalizeFilterKey('Bengaluru')]: [
    'Bangalore',
    'Bengaluru',
  ],
}

const INVALID_LOCATION_FILTER_KEYS = new Set([
  'hhh',
  'q',
  'vill',
  'village',
  'city',
  'tckootroad',
])

function getLocationFilterLabel(value) {
  const label = String(value || '').trim()
  return LOCATION_FILTER_CANONICAL_NAMES[normalizeFilterKey(label)] || label
}

function getLocationFilterKey(value) {
  return normalizeFilterKey(getLocationFilterLabel(value))
}

function getFilterLabelScore(label) {
  const trimmed = String(label || '').trim()
  if (!trimmed) return -1

  let score = 0
  if (/[a-z]/.test(trimmed) && /[A-Z]/.test(trimmed)) score += 3
  if (/^[A-Z0-9\s&.,'-]+$/.test(trimmed)) score -= 1
  score -= Math.max(trimmed.length - 28, 0) * 0.1
  return score
}

function buildFilterOptions(rows, getValue, options = {}) {
  const {
    minLabelLength = 1,
    getOptionLabel = (value) => value,
    getOptionKey = normalizeFilterKey,
    excludedKeys = new Set(),
  } = options
  const optionMap = new Map()

  rows.forEach((row) => {
    const rawLabel = String(getValue(row) || '').trim()
    if (rawLabel.length <= minLabelLength) return

    const label = String(getOptionLabel(rawLabel) || '').trim()
    const key = getOptionKey(rawLabel)
    if (!key || excludedKeys.has(key) || /^\d+$/.test(key)) return

    const existing = optionMap.get(key)
    if (!existing || getFilterLabelScore(label) > getFilterLabelScore(existing.label)) {
      optionMap.set(key, { key, label })
    }
  })

  return [...optionMap.values()].sort((a, b) => a.label.localeCompare(b.label))
}

function getFilterLabel(options, key, fallback) {
  if (!key) return fallback
  return options.find((option) => option.key === key)?.label || fallback
}

function getCanonicalFilterTerms(key, options, canonicalMap, fallbackLabel, queryTermsMap = {}) {
  if (!key) return []

  const terms = new Set()
  const selectedLabel = options.find((option) => option.key === key)?.label || fallbackLabel
  if (selectedLabel) terms.add(selectedLabel)

  const queryTerms = queryTermsMap[key] || []
  queryTerms.forEach((term) => terms.add(term))

  Object.entries(canonicalMap).forEach(([, canonicalLabel]) => {
    if (normalizeFilterKey(canonicalLabel) === key) {
      terms.add(canonicalLabel)
    }
  })

  return [...terms].filter(Boolean)
}

function Directory() {
  const navigate = useNavigate()
  const location = useLocation()
  const { enqueueSnackbar } = useSnackbar()
  const configMissing = !isSupabaseConfigured
  const { directoryCache, setDirectoryCache } = useDirectoryCache()

  const [hasDirectoryAccess, setHasDirectoryAccess] = useState(false)
  const [authReady, setAuthReady] = useState(configMissing)
  const [viewer, setViewer] = useState(() => getUser())

  const initialCacheKey = buildDirectoryCacheKey(viewer)
  const hasInitialCache =
    !!initialCacheKey &&
    directoryCache.loaded &&
    directoryCache.key === initialCacheKey &&
    Array.isArray(directoryCache.rows)
  const initialRows = hasInitialCache ? directoryCache.rows : []
  const initialUiState = directoryCache.key === initialCacheKey && directoryCache.uiState
    ? directoryCache.uiState
    : DEFAULT_DIRECTORY_UI_STATE

  const [alumni, setAlumni] = useState(initialRows)
  const [loading, setLoading] = useState(!configMissing && !hasInitialCache)
  const [error, setError] = useState(configMissing ? 'Supabase is not configured.' : '')
  const [totalCount, setTotalCount] = useState(hasInitialCache ? directoryCache.totalCount || initialRows.length : 0)
  const [loadedPages, setLoadedPages] = useState(hasInitialCache ? directoryCache.loadedPages || 1 : 0)

  const [searchInput, setSearchInput] = useState(initialUiState.searchInput ?? DEFAULT_DIRECTORY_UI_STATE.searchInput)
  const debouncedSearch = useDebounce(searchInput)
  const [filters, setFilters] = useState(initialUiState.filters ?? DEFAULT_DIRECTORY_UI_STATE.filters)
  const [staffVisibilityFilter, setStaffVisibilityFilter] = useState(initialUiState.staffVisibilityFilter ?? DEFAULT_DIRECTORY_UI_STATE.staffVisibilityFilter)
  const [sortBy, setSortBy] = useState(initialUiState.sortBy ?? DEFAULT_DIRECTORY_UI_STATE.sortBy)
  const [view, setView] = useState(initialUiState.view ?? DEFAULT_DIRECTORY_UI_STATE.view)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 600)
  const [statusMutatingIds, setStatusMutatingIds] = useState({})

  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef(null)
  const filterBtnRef = useRef(null)
  const requestIdRef = useRef(0)
  const lastQueryKeyRef = useRef(null)

  const [departments, setDepartments] = useState(
    buildFilterOptions(initialRows, (r) => r.department),
  )
  const [years, setYears] = useState(
    [...new Set(initialRows.map((r) => r.year_of_completion).filter(Boolean))].sort((a, b) => b - a),
  )
  const [cities] = useState(
    buildFilterOptions(locationFilterOptions.locations || [], (locationName) => locationName, {
      getOptionLabel: getLocationFilterLabel,
      getOptionKey: getLocationFilterKey,
      excludedKeys: INVALID_LOCATION_FILTER_KEYS,
    }),
  )
  const isStaff = viewer?.role === 'staff'
  const cityOptions = useMemo(() => cities.map((city) => ({ key: city.key, label: city.label })), [cities])
  const departmentFilterTerm = useMemo(
    () => departments.find((department) => department.key === filters.dept)?.label || '',
    [departments, filters.dept],
  )
  const cityFilterTerms = useMemo(
    () => getCanonicalFilterTerms(
      filters.city,
      cityOptions,
      LOCATION_FILTER_CANONICAL_NAMES,
      '',
      LOCATION_FILTER_QUERY_TERMS,
    ),
    [filters.city, cityOptions],
  )
  const queryKey = useMemo(
    () => JSON.stringify({
      user: buildDirectoryCacheKey(viewer),
      search: debouncedSearch,
      filters,
      staffVisibilityFilter: isStaff ? staffVisibilityFilter : 'all',
      sortBy,
    }),
    [viewer, debouncedSearch, filters, staffVisibilityFilter, sortBy, isStaff],
  )

  useEffect(() => {
    if (configMissing) return

    let mounted = true

    const init = async () => {
      const user = await verifySession()
      if (!mounted) return
      setViewer(user)
      if (!user) {
        navigate('/login', { replace: true })
        return
      }

      if (user.role === 'staff') {
        setHasDirectoryAccess(true)
        setAuthReady(true)
        return
      }

      const { registered } = await isStudentRegistered(user)
      if (!mounted) return

      setHasDirectoryAccess(Boolean(registered))
      setAuthReady(true)
      if (!registered) {
        setLoading(false)
      }
    }

    init()
    return () => {
      mounted = false
    }
  }, [configMissing, navigate])

  const loadDirectoryPage = useCallback(async (nextPage, { replaceUrl = true } = {}) => {
    if (!viewer?.id || !hasDirectoryAccess) return

    const requestId = ++requestIdRef.current

    setLoading(true)
    setError('')

    try {
      const result = await fetchDirectoryPage({
        user: viewer,
        page: nextPage,
        limit: DIRECTORY_PAGE_SIZE,
        filters,
        search: debouncedSearch,
        sortBy,
        staffVisibilityFilter: isStaff ? staffVisibilityFilter : 'all',
        departmentTerm: departmentFilterTerm,
        cityTerms: cityFilterTerms,
      })

      if (requestId !== requestIdRef.current) return

      setAlumni(result.rows)
      setTotalCount(result.total)
      setLoadedPages(result.page)
      setDirectoryCache((prev) => ({
        ...prev,
        key: buildDirectoryCacheKey(viewer),
        rows: result.rows,
        loaded: true,
        loadedPages: result.page,
        totalCount: result.total,
        hasMore: result.hasMore,
        queryKey,
        cachedAt: Date.now(),
      }))

      if (replaceUrl) {
        const params = new URLSearchParams(location.search)
        params.set('page', String(result.page))
        params.set('limit', String(DIRECTORY_PAGE_SIZE))
        navigate({ pathname: location.pathname, search: params.toString() }, { replace: true })
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setError(err.message || 'Unable to load alumni directory.')
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [
    viewer,
    hasDirectoryAccess,
    filters,
    debouncedSearch,
    sortBy,
    staffVisibilityFilter,
    departmentFilterTerm,
    isStaff,
    cityFilterTerms,
    queryKey,
    location.pathname,
    location.search,
    navigate,
    setDirectoryCache,
  ])

  useEffect(() => {
    if (!authReady || !hasDirectoryAccess || !viewer?.id || configMissing) return

    const isNewQuery = lastQueryKeyRef.current !== null && lastQueryKeyRef.current !== queryKey
    const urlPage = isNewQuery
      ? 1
      : Math.max(Number(new URLSearchParams(location.search).get('page')) || 1, 1)
    lastQueryKeyRef.current = queryKey
    const cachedForQuery =
      directoryCache.loaded &&
      directoryCache.key === buildDirectoryCacheKey(viewer) &&
      directoryCache.queryKey === queryKey &&
      Array.isArray(directoryCache.rows) &&
      directoryCache.rows.length > 0

    if (cachedForQuery) {
      setAlumni(directoryCache.rows)
      setTotalCount(directoryCache.totalCount || directoryCache.rows.length)
      setLoadedPages(directoryCache.loadedPages || 1)
      setLoading(false)
      return
    }

    setAlumni([])
    setTotalCount(0)
    setLoadedPages(0)
    loadDirectoryPage(urlPage)
    // This effect intentionally keys data reloads by the stable query signature.
    // Including the mutable cache object or load callback here causes duplicate page fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, hasDirectoryAccess, viewer?.id, configMissing, queryKey])

  useEffect(() => {
    if (!authReady || !hasDirectoryAccess || !viewer?.id || configMissing) return undefined

    let mounted = true
    const loadMetadata = async () => {
      try {
        const metadataRows = await fetchDirectoryFilterMetadata({ user: viewer })
        if (!mounted) return
        setDepartments(buildFilterOptions(metadataRows, (r) => r.department))
        setYears([...new Set(metadataRows.map((r) => r.year_of_completion).filter(Boolean))].sort((a, b) => b - a))
      } catch {
        // Keep the static and already-loaded filter options if metadata fails.
      }
    }

    loadMetadata()
    return () => {
      mounted = false
    }
  }, [authReady, hasDirectoryAccess, viewer, configMissing])

  useEffect(() => {
    const unsubscribe = onAuthChange((nextUser) => {
      setViewer(nextUser)
    })
    return () => unsubscribe()
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    filterBtnRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!drawerOpen || !drawerRef.current) return

    const drawer = drawerRef.current
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')

    const focusable = drawer.querySelectorAll(selectors)
    if (!focusable.length) return

    focusable[0].focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDrawer()
        return
      }

      if (e.key !== 'Tab') return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen, closeDrawer])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 600)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!viewer?.id) return undefined

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const nextKey = buildDirectoryCacheKey(viewer)
      setDirectoryCache((prev) => ({
        ...prev,
        key: nextKey,
        rows: prev.key && prev.key !== nextKey ? [] : prev.rows,
        loaded: prev.key && prev.key !== nextKey ? false : prev.loaded,
        cachedAt: prev.key && prev.key !== nextKey ? 0 : prev.cachedAt,
        uiState: {
          searchInput,
          filters,
          staffVisibilityFilter,
          sortBy,
          view,
        },
      }))
    })

    return () => {
      cancelled = true
    }
  }, [viewer, searchInput, filters, staffVisibilityFilter, sortBy, view, setDirectoryCache])

  const getInitials = (row) => {
    const f = (row.first_name ?? '').charAt(0).toUpperCase()
    return f || '?'
  }

  const getFullName = useCallback(
    (row) => [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown',
    [],
  )

  const getCurrentRole = useCallback((row) => {
    if (Array.isArray(row.work_experiences) && row.work_experiences.length > 0) {
      const latest = row.work_experiences[0]
      if (latest?.is_startup) {
        return {
          company: latest.startup_name || '',
          designation: latest.startup_type || '',
          is_startup: true,
        }
      }
      if (latest) return { company: latest.company || '', designation: latest.designation || '', is_startup: false }
    }
    if (row.company || row.designation) {
      return { company: row.company || '', designation: row.designation || '', is_startup: false }
    }
    return null
  }, [])

  const getHeadline = useCallback(
    (row) => {
      const role = getCurrentRole(row)
      if (!role) return null
      return role.designation || null
    },
    [getCurrentRole],
  )

  const getLocation = (row) => [row.city, row.state].filter(Boolean).join(', ') || null

  const displayedAlumni = alumni
  const totalPages = Math.max(Math.ceil(totalCount / DIRECTORY_PAGE_SIZE), 1)
  const currentPage = Math.max(loadedPages || 1, 1)
  const displayedImageSources = useMemo(
    () => displayedAlumni.flatMap((row) => [row.cover_image_url, row.profile_image_url].filter(Boolean)),
    [displayedAlumni],
  )
  const protectedDisplayedImageUrls = useProtectedImageUrls(displayedImageSources)

  const handlePageChange = (page) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages)
    if (nextPage === currentPage || loading) return
    loadDirectoryPage(nextPage)
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  const activeFilterCount = [
    filters.dept,
    filters.year,
    filters.city,
    isStaff && staffVisibilityFilter !== 'all' ? staffVisibilityFilter : '',
  ].filter(Boolean).length

  const clearFilters = () => {
    setFilters({ dept: '', year: '', city: '' })
    setStaffVisibilityFilter('all')
    setSearchInput('')
  }

  const selectedDeptLabel = getFilterLabel(departments, filters.dept, 'Department')
  const selectedCityLabel = getFilterLabel(cities, filters.city, 'Location')
  const yearOptions = years.map((year) => ({ key: String(year), label: String(year) }))
  const departmentOptions = departments.map((department) => ({ key: department.key, label: department.label }))
  const staffVisibilityOptions = [
    { key: 'all', label: 'All Alumni' },
    { key: 'disabled', label: 'Disabled Alumni' },
  ]
  const staffStatusOptions = [
    { key: 'all', label: 'Status: All Alumni' },
    { key: 'disabled', label: 'Status: Disabled Alumni' },
  ]
  const sortOptions = [
    { key: 'newest', label: 'Sort: Newest' },
    { key: 'name', label: 'Sort: Name' },
    { key: 'company', label: 'Sort: Company' },
  ]
  const mobileFilterNav = useMemo(() => (
    <div className="dir-mobile-filter-nav" role="navigation" aria-label="Mobile quick filters">
      <button ref={filterBtnRef} className="dir-mobile-pill" type="button" onClick={() => setDrawerOpen(true)}>
        <HiAcademicCap />
        {selectedDeptLabel}
      </button>
      <button className="dir-mobile-pill" type="button" onClick={() => setDrawerOpen(true)}>
        {filters.year || 'Batch'}
      </button>
      <button className="dir-mobile-pill" type="button" onClick={() => setDrawerOpen(true)}>
        <HiLocationMarker />
        {selectedCityLabel}
      </button>
      {isStaff && (
        <button className="dir-mobile-pill" type="button" onClick={() => setDrawerOpen(true)}>
          {staffVisibilityFilter === 'disabled' ? 'Disabled Alumni' : 'All Alumni'}
        </button>
      )}

      <button className="dir-mobile-pill dir-mobile-pill--icon" type="button" onClick={() => setDrawerOpen(true)} aria-label="More filters">
        <HiFilter />
      </button>
    </div>
  ), [filters.year, isStaff, selectedCityLabel, selectedDeptLabel, staffVisibilityFilter])

  useDirectoryNavbar({
    searchValue: searchInput,
    onSearchChange: setSearchInput,
    mobileFilterNav,
  })

  const handleStaffVisibilityToggle = async (row) => {
    if (!isStaff || !row?.id) return

    const nextDisabledState = !row.is_disabled
    setStatusMutatingIds((prev) => ({ ...prev, [row.id]: true }))

    let updatedRow
    try {
      updatedRow = await setAlumniDisabled(row.id, nextDisabledState)
    } catch (updateError) {
      setStatusMutatingIds((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      enqueueSnackbar(updateError.message || 'Unable to update alumni visibility.', { variant: 'error', autoHideDuration: 3200 })
      return
    }

    setStatusMutatingIds((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })

    const persistedIsDisabled = Boolean(updatedRow?.is_disabled)

    setAlumni((prev) => prev.map((entry) => (
      entry.id === row.id
        ? { ...entry, is_disabled: persistedIsDisabled }
        : entry
    )))
    setDirectoryCache((prev) => ({
      ...prev,
      rows: Array.isArray(prev.rows)
        ? prev.rows.map((entry) => (
          entry.id === row.id
            ? { ...entry, is_disabled: persistedIsDisabled }
            : entry
        ))
        : prev.rows,
      cachedAt: Date.now(),
    }))
    enqueueSnackbar(
      persistedIsDisabled
        ? 'Alumni profile disabled successfully.'
        : 'Alumni profile enabled successfully.',
      { variant: 'success', autoHideDuration: 2600 },
    )
  }

  if (authReady && !hasDirectoryAccess) {
    return (
      <div className="directory-page page-content">
        <div className="dir-restricted">
          <HiAcademicCap />
          <h3>Directory Access Restricted</h3>
          <p>Please complete alumni registration or login as staff to view registered alumni.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="directory-page page-content">
      <div className="dir-layout">
        <aside className="dir-sidebar" aria-label="Filters">
          <div className="dir-sidebar-card">
            <div className="dir-sidebar-title">Filters</div>

            <div className="dir-filter-section">
              <label htmlFor="filter-dept">Department</label>
              <DirectorySelect
                id="filter-dept"
                value={filters.dept}
                onChange={(value) => setFilters((p) => ({ ...p, dept: value }))}
                placeholder="All Departments"
                options={departmentOptions}
              />
            </div>

            <div className="dir-filter-section">
              <label htmlFor="filter-year">Batch Year</label>
              <DirectorySelect
                id="filter-year"
                value={filters.year}
                onChange={(value) => setFilters((p) => ({ ...p, year: value }))}
                placeholder="All Years"
                options={yearOptions}
              />
            </div>

            <div className="dir-filter-section">
              <label htmlFor="filter-city">Location</label>
              <DirectorySelect
                id="filter-city"
                value={filters.city}
                onChange={(value) => setFilters((p) => ({ ...p, city: value }))}
                placeholder="All Locations"
                options={cityOptions}
              />
            </div>

            {isStaff && (
              <div className="dir-filter-section">
                <label htmlFor="filter-status">Profile Status</label>
                <DirectorySelect
                  id="filter-status"
                  value={staffVisibilityFilter}
                  onChange={setStaffVisibilityFilter}
                  options={staffVisibilityOptions}
                />
              </div>
            )}

            {activeFilterCount > 0 && (
              <button className="dir-filter-reset" onClick={clearFilters}>
                Clear all filters
              </button>
            )}
          </div>
        </aside>

        <main className="dir-results" role="main">
          {loading && <SkeletonGrid view={view} />}
          {error && !loading && <div className="dir-error">{error}</div>}

          {!loading && !error && (
            <>
              <div className="dir-results-toolbar">
                <div className="dir-results-count">
                  <strong>{totalCount}</strong>{' '}
                  {totalCount === 1 ? 'alumnus' : 'alumni'} found
                  {displayedAlumni.length > 0 && ` · showing ${displayedAlumni.length}`}
                </div>

                <div className="dir-toolbar-right">
                  {isStaff && (
                    <DirectorySelect
                      className="dir-sort-select"
                      value={staffVisibilityFilter}
                      onChange={setStaffVisibilityFilter}
                      aria-label="Filter by profile status"
                      options={staffStatusOptions}
                    />
                  )}
                  <DirectorySelect
                    className="dir-sort-select"
                    value={sortBy}
                    onChange={setSortBy}
                    aria-label="Sort results"
                    options={sortOptions}
                  />

                  <div className="dir-view-toggle" role="radiogroup" aria-label="View mode">
                    <button
                      className={view === 'grid' ? 'active' : ''}
                      onClick={() => setView('grid')}
                      aria-label="Grid view"
                      role="radio"
                      aria-checked={view === 'grid'}
                    >
                      <HiViewGrid />
                    </button>
                    <button
                      className={view === 'list' ? 'active' : ''}
                      onClick={() => setView('list')}
                      aria-label="List view"
                      role="radio"
                      aria-checked={view === 'list'}
                    >
                      <HiViewList />
                    </button>
                  </div>
                </div>
              </div>

              {displayedAlumni.length === 0 && (
                <div className="dir-empty">
                  <div className="dir-empty-icon"><HiSearch /></div>
                  <h3>No results found</h3>
                  <p>
                    {debouncedSearch || activeFilterCount > 0
                      ? 'Try broadening your search or removing some filters.'
                      : 'Registered alumni will appear here once they complete registration.'}
                  </p>
                  {activeFilterCount > 0 && (
                    <button className="dir-btn dir-btn--ghost dir-empty-clear" onClick={clearFilters}>
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {!isMobile && view === 'grid' && displayedAlumni.length > 0 && (
                <div className="dir-grid">
                  {displayedAlumni.map((row) => (
                    <PersonCard
                      key={row.id}
                      row={row}
                      protectedImageUrls={protectedDisplayedImageUrls}
                      getInitials={getInitials}
                      getFullName={getFullName}
                      getHeadline={getHeadline}
                      getLocation={getLocation}
                      getCurrentRole={getCurrentRole}
                      isStaff={isStaff}
                      onToggleEnabled={handleStaffVisibilityToggle}
                      isToggling={Boolean(statusMutatingIds[row.id])}
                    />
                  ))}
                </div>
              )}

              {(isMobile || view === 'list') && displayedAlumni.length > 0 && (
                <div className="dir-list">
                  {displayedAlumni.map((row) => (
                    <PersonRow
                      key={row.id}
                      row={row}
                      protectedImageUrls={protectedDisplayedImageUrls}
                      getInitials={getInitials}
                      getFullName={getFullName}
                      getHeadline={getHeadline}
                      getLocation={getLocation}
                      isMobile={isMobile}
                      isStaff={isStaff}
                      onToggleEnabled={handleStaffVisibilityToggle}
                      isToggling={Boolean(statusMutatingIds[row.id])}
                    />
                  ))}
                </div>
              )}

              {totalPages > 1 && displayedAlumni.length > 0 && (
                <DirectoryPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  loading={loading}
                  onPageChange={handlePageChange}
                  compact
                />
              )}
            </>
          )}
        </main>
      </div>

      <div
        className={`dir-drawer-overlay${drawerOpen ? ' dir-drawer-overlay--open' : ''}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <div
        id="directory-filter-drawer"
        className={`dir-drawer${drawerOpen ? ' dir-drawer--open' : ''}`}
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filter options"
        aria-hidden={!drawerOpen}
        inert={drawerOpen ? undefined : ''}
      >
        <div className="dir-drawer-handle" />
        <div className="dir-drawer-header">
          <h3>Filters</h3>
          <button onClick={closeDrawer} aria-label="Close filters">
            <HiX />
          </button>
        </div>

        <div className="dir-filter-section">
          <label htmlFor="drawer-dept">Department</label>
          <DirectorySelect
            id="drawer-dept"
            value={filters.dept}
            onChange={(value) => setFilters((p) => ({ ...p, dept: value }))}
            placeholder="All Departments"
            options={departmentOptions}
          />
        </div>

        <div className="dir-filter-section">
          <label htmlFor="drawer-year">Batch Year</label>
          <DirectorySelect
            id="drawer-year"
            value={filters.year}
            onChange={(value) => setFilters((p) => ({ ...p, year: value }))}
            placeholder="All Years"
            options={yearOptions}
          />
        </div>

        <div className="dir-filter-section">
          <label htmlFor="drawer-city">Location</label>
          <DirectorySelect
            id="drawer-city"
            value={filters.city}
            onChange={(value) => setFilters((p) => ({ ...p, city: value }))}
            placeholder="All Locations"
            options={cityOptions}
          />
        </div>

        {isStaff && (
          <div className="dir-filter-section">
            <label htmlFor="drawer-status">Profile Status</label>
            <DirectorySelect
              id="drawer-status"
              value={staffVisibilityFilter}
              onChange={setStaffVisibilityFilter}
              options={staffVisibilityOptions}
            />
          </div>
        )}

        <button className="dir-drawer-apply" onClick={closeDrawer}>
          Show results
        </button>
      </div>
    </div>
  )
}

function DirectorySelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  className = '',
  'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectRef = useRef(null)
  const searchRef = useRef(null)
  const allOptions = placeholder ? [{ key: '', label: placeholder }, ...options] : options
  const selected = allOptions.find((option) => option.key === value) || allOptions[0]
  const listboxId = `${id || 'directory-select'}-listbox`

  const normalizedQuery = query.trim().toLowerCase()
  const filteredOptions = normalizedQuery
    ? allOptions.filter((option) => String(option.label || '').toLowerCase().includes(normalizedQuery))
    : allOptions

  useEffect(() => {
    if (!open) return undefined

    const focusTimer = window.setTimeout(() => {
      searchRef.current?.focus()
    }, 0)

    const onPointerDown = (event) => {
      if (!selectRef.current?.contains(event.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleSelect = (nextValue) => {
    onChange(nextValue)
    setOpen(false)
    setQuery('')
  }

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const firstSelectable = filteredOptions.find((option) => option.key !== '' || !placeholder)
      const target = firstSelectable || filteredOptions[0]
      if (target) handleSelect(target.key)
    }
  }

  return (
    <div ref={selectRef} className={`dir-select ${className}${open ? ' dir-select--open' : ''}`}>
      <button
        id={id}
        type="button"
        className="dir-select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => {
          if (open) {
            setOpen(false)
            setQuery('')
          } else {
            setOpen(true)
          }
        }}
      >
        <span className="dir-select__value">{selected?.label || placeholder}</span>
        <HiChevronDown className="dir-select__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div id={listboxId} className="dir-select__menu" role="listbox" aria-labelledby={id}>
          <div className="dir-select__search">
            <input
              ref={searchRef}
              type="text"
              className="dir-select__search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search..."
              aria-label="Filter options"
            />
          </div>
          {filteredOptions.length === 0 ? (
            <div className="dir-select__empty">No matches</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.key || '__empty'}
                type="button"
                className={`dir-select__option${option.key === value ? ' is-selected' : ''}`}
                role="option"
                aria-selected={option.key === value}
                onClick={() => handleSelect(option.key)}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function getPaginationPages(currentPage, totalPages) {
  const pages = new Set([1, totalPages])
  for (let page = currentPage - 2; page <= currentPage + 2; page += 1) {
    if (page >= 1 && page <= totalPages) pages.add(page)
  }

  const sortedPages = [...pages].sort((a, b) => a - b)
  return sortedPages.reduce((items, page, index) => {
    const previousPage = sortedPages[index - 1]
    if (index > 0 && page - previousPage > 1) {
      items.push(`gap-${previousPage}-${page}`)
    }
    items.push(page)
    return items
  }, [])
}

function DirectoryPagination({
  currentPage,
  totalPages,
  loading,
  onPageChange,
  compact = false,
}) {
  const pages = getPaginationPages(currentPage, totalPages)

  return (
    <nav
      className={`dir-pagination${compact ? ' dir-pagination--compact' : ''}`}
      aria-label="Directory pagination"
    >
      <button
        type="button"
        className="dir-pagination__btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={loading || currentPage <= 1}
      >
        Previous
      </button>

      <div className="dir-pagination__pages">
        {pages.map((page) => (
          typeof page === 'number' ? (
            <button
              key={page}
              type="button"
              className={`dir-pagination__page${page === currentPage ? ' is-active' : ''}`}
              onClick={() => onPageChange(page)}
              disabled={loading || page === currentPage}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          ) : (
            <span key={page} className="dir-pagination__gap">...</span>
          )
        ))}
      </div>

      <button
        type="button"
        className="dir-pagination__btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={loading || currentPage >= totalPages}
      >
        Next
      </button>
    </nav>
  )
}

function PersonCard({
  row,
  protectedImageUrls,
  getInitials,
  getFullName,
  getHeadline,
  getCurrentRole,
  isStaff,
  onToggleEnabled,
  isToggling,
}) {
  const headline = getHeadline(row)
  const role = getCurrentRole(row)
  const isDisabled = row.is_disabled === true
  const protectedCoverImageUrl = protectedImageUrls?.[row.cover_image_url] || ''
  const protectedProfileImageUrl = protectedImageUrls?.[row.profile_image_url] || ''

  return (
    <Link
      to={`/directory/alumni/${row.id}`}
      state={{ fromDirectory: true }}
      className="dir-person-card"
    >
      <div
        className={`dir-card-cover${protectedCoverImageUrl ? '' : ' dir-card-cover--fallback'}`}
        style={protectedCoverImageUrl ? { backgroundImage: `url(${protectedCoverImageUrl})` } : undefined}
        aria-hidden="true"
      />
      <div className={`dir-card-avatar${protectedProfileImageUrl ? '' : ' dir-card-avatar--initials'}`}>
        {protectedProfileImageUrl
          ? <img src={protectedProfileImageUrl} alt={getFullName(row)} loading="lazy" />
          : getInitials(row)
        }
      </div>

      <div className="dir-card-name">
        {getFullName(row)}
      </div>
      {isStaff && isDisabled && (
        <div className="dir-status-badge">Disabled</div>
      )}

      {headline && <div className="dir-card-headline">{headline}</div>}

      {role?.company && (
        <div className="dir-card-company-row">
          <span className="dir-company-logo">
            <CompanyLogo
              company={role.company}
              className="company-logo-img"
              fallback={<HiOfficeBuilding />}
            />
          </span>
          <span className="dir-card-company-name">{role.company}</span>
        </div>
      )}

      {/* {location && (
        <div className="dir-card-meta">
          <HiLocationMarker />
          <span>{location}</span>
        </div>
      )} */}


      <div className="dir-card-actions">
        <span className="dir-btn dir-btn--primary">View Profile</span>
        {isStaff && (
          <button
            type="button"
            className={`dir-status-toggle ${isDisabled?'enable':'disable'}`}
            disabled={isToggling}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onToggleEnabled(row)
            }}
          >
            {isToggling ? (
              isDisabled ? 'Enabling...' : 'Disabling...'
            ) : (
              isDisabled ? 'Enable' : 'Disable'
            )}
          </button>
        )}
      </div>
    </Link>
  )
}

function PersonRow({
  row,
  protectedImageUrls,
  getInitials,
  getFullName,
  getHeadline,
  getLocation,
  isMobile = false,
  isStaff,
  onToggleEnabled,
  isToggling,
}) {
  const headline = getHeadline(row)
  const location = getLocation(row)
  const isDisabled = row.is_disabled === true
  const protectedProfileImageUrl = protectedImageUrls?.[row.profile_image_url] || ''
  const rowDetailItems = [
    row.department,
    isMobile ? null : (row.year_of_completion ? `Batch of ${row.year_of_completion}` : null),
    isMobile ? null : location,
  ]

  return (
    <Link
      to={`/directory/alumni/${row.id}`}
      state={{ fromDirectory: true }}
      className="dir-person-row"
    >
      <div className={`dir-row-avatar${protectedProfileImageUrl ? '' : ' dir-row-avatar--initials'}`}>
        {protectedProfileImageUrl
          ? <img src={protectedProfileImageUrl} alt={getFullName(row)} loading="lazy" />
          : getInitials(row)
        }
      </div>

      <div className="dir-row-info">
        <div className="dir-row-name">
          {getFullName(row)}
        </div>
        {isStaff && isDisabled && (
          <div className="dir-status-badge">Disabled</div>
        )}
        {headline && <div className="dir-row-headline">{headline}</div>}
        <div className="dir-row-detail">
          {rowDetailItems.filter(Boolean).join(' | ')}
        </div>
      </div>

      <div className="dir-row-actions">
        <span className="dir-row-add">
          <HiArrowRight />
        </span>
        <span className="dir-btn dir-btn--primary">View Profile</span>
        {isStaff && (
          <button
            type="button"
            className="dir-status-toggle"
            disabled={isToggling}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onToggleEnabled(row)
            }}
          >
            {isToggling ? (
              isDisabled ? 'Enabling...' : 'Disabling...'
            ) : (
              isDisabled ? 'Enable' : 'Disable'
            )}
          </button>
        )}
      </div>
    </Link>
  )
}

function SkeletonGrid({ view }) {
  if (view === 'list') {
    return (
      <div className="dir-list">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div className="dir-skeleton-row" key={i}>
            <div className="dir-skel-avatar dir-skeleton-pulse" />
            <div className="dir-skel-info">
              <div className="dir-skel-name dir-skeleton-pulse" />
              <div className="dir-skel-headline dir-skeleton-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="dir-grid">
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <div className="dir-skeleton-card" key={i}>
          <div className="dir-skel-avatar dir-skeleton-pulse" />
          <div className="dir-skel-name dir-skeleton-pulse" />
          <div className="dir-skel-headline dir-skeleton-pulse" />
          <div className="dir-skel-meta dir-skeleton-pulse" />
          <div className="dir-skel-btn dir-skeleton-pulse" />
        </div>
      ))}
    </div>
  )
}

export default Directory


// Directory data access — now backed by the REST API. Keeps the same function
// signatures the Directory page already calls; the `supabase` argument is
// ignored (kept for call-site compatibility).
import { api } from './apiClient'

const SORT_MAP = { newest: 'recent', name: 'name', company: 'company' }

export async function fetchDirectoryPage({
  user,
  page = 1,
  limit = 50,
  filters = {},
  search,
  sortBy,
  staffVisibilityFilter,
  departmentTerm,
  cityTerms = [],
}) {
  const query = {
    page,
    limit,
    sortBy: SORT_MAP[sortBy] || 'recent',
  }

  if (search) query.search = String(search).trim()
  if (filters.dept) query.dept = departmentTerm || filters.dept
  if (filters.year) query.year = Number(filters.year)
  // The server does flexible matching; send the first resolved term.
  if (filters.city && cityTerms.length) query.city = cityTerms[0]

  // Staff-only visibility filter.
  if (user?.role === 'staff' && staffVisibilityFilter === 'disabled') {
    query.visibility = 'disabled'
  }

  const data = await api.get('/directory', { query })
  return {
    rows: data.rows || [],
    total: data.total ?? (data.rows ? data.rows.length : 0),
    page: data.page ?? page,
    limit: data.limit ?? limit,
    hasMore: Boolean(data.hasMore),
  }
}

export async function fetchDirectoryFilterMetadata() {
  const data = await api.get('/directory/filters')
  // Page expects rows with { department, year_of_completion } to build options.
  const departments = data.departments || []
  const years = data.years || []
  const rows = []
  departments.forEach((department) => rows.push({ department, year_of_completion: null }))
  years.forEach((year) => rows.push({ department: null, year_of_completion: year }))
  return rows
}

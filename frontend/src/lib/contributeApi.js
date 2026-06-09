// Contribute API — alumni give back to the institute & students.
import { api } from './apiClient'

// Contribution types, with display metadata used across the UI. `color` drives
// the accent strip / icon tint; `icon` (emoji) is a lightweight fallback — the
// page renders crisp inline SVGs via icons.jsx keyed on `key`.
export const CONTRIBUTION_TYPES = [
  {
    key: 'mentorship', label: 'Mentorship', short: 'Mentor', icon: '🎓', color: '#0a66c2',
    image: '/img/contribute/mentorship.png',
    blurb: 'Mentor students in your domain',
    points: [
      { lead: 'Share your expertise', rest: 'in 1:1 or group sessions on the skills you know best.' },
      { lead: 'Guide career decisions', rest: 'helping students navigate internships, jobs, and higher studies.' },
    ],
  },
  {
    key: 'campus_visit', label: 'Campus Visit / Talk', short: 'Campus Talk', icon: '🏛️', color: '#7c3aed',
    image: '/img/contribute/campus_visit.png',
    blurb: 'Visit campus & share your thoughts',
    points: [
      { lead: 'Inspire on campus', rest: 'with a guest lecture, panel, or fireside chat.' },
      { lead: 'Bring the real world in', rest: 'sharing industry stories students rarely hear in class.' },
    ],
  },
  {
    key: 'referral', label: 'Job / Internship Referral', short: 'Referral', icon: '💼', color: '#0e7490',
    image: '/img/contribute/referral.png',
    blurb: 'Refer students to opportunities',
    points: [
      { lead: 'Open doors', rest: 'by referring strong students to openings at your company.' },
      { lead: 'Build the pipeline', rest: 'connecting MVIT talent with real internships and roles.' },
    ],
  },
  {
    key: 'workshop', label: 'Workshop / Training', short: 'Workshop', icon: '🛠️', color: '#15803d',
    image: '/img/contribute/workshop.png',
    blurb: 'Run a skill workshop or webinar',
    points: [
      { lead: 'Teach a practical skill', rest: 'through a hands-on workshop or online session.' },
      { lead: 'Close the skills gap', rest: 'with tools and techniques used in the industry today.' },
    ],
  },
  {
    key: 'project_guidance', label: 'Project / Research Guidance', short: 'Guidance', icon: '🔬', color: '#be185d',
    image: '/img/contribute/project_guidance.png',
    blurb: 'Guide final-year projects or research',
    points: [
      { lead: 'Mentor real projects', rest: 'advising final-year teams from idea to delivery.' },
      { lead: 'Shape research', rest: 'lending direction and feedback on student research work.' },
    ],
  },
]

export const CONTRIBUTION_MODES = [
  { key: 'online', label: 'Online' },
  { key: 'in_person', label: 'In person' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'flexible', label: 'Flexible' },
]

export function typeMeta(key) {
  return CONTRIBUTION_TYPES.find((t) => t.key === key) || { key, label: key, short: key, icon: '🤝', color: '#054d5a', blurb: '' }
}

export async function fetchContributions({ page = 1, limit = 10, type, status, search, mine } = {}) {
  const query = { page, limit }
  if (type) query.type = type
  if (status) query.status = status
  if (search) query.search = search
  if (mine) query.mine = true
  return api.get('/contributions', { query })
}

export async function fetchContribution(id) {
  const data = await api.get(`/contributions/${id}`)
  return data.contribution
}

export async function createContribution(payload) {
  const data = await api.post('/contributions', payload)
  return data.contribution
}

export async function updateContribution(id, patch) {
  const data = await api.patch(`/contributions/${id}`, patch)
  return data.contribution
}

export async function deleteContribution(id) {
  return api.del(`/contributions/${id}`)
}

// Staff review: status ∈ approved | featured | archived | pending.
export async function reviewContribution(id, status, reviewNote) {
  const data = await api.post(`/contributions/${id}/review`, { status, reviewNote })
  return data.contribution
}

export async function expressInterest(id, note) {
  return api.post(`/contributions/${id}/interest`, { note })
}

export async function withdrawInterest(id) {
  return api.post(`/contributions/${id}/withdraw-interest`)
}

export async function fetchInterested(id) {
  const data = await api.get(`/contributions/${id}/interested`)
  return data.rows || []
}

// Inline SVG iconography for the Contribute feature. Crisp at any size, themeable
// via currentColor, no external asset/network dependency. One per contribution
// type plus a few UI glyphs.

const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

export function IconMentorship(p) {
  return (
    <svg {...base} {...p}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5" />
    </svg>
  )
}

export function IconCampusVisit(p) {
  return (
    <svg {...base} {...p}>
      <path d="M3 21h18M4 21V10l8-5 8 5v11" />
      <path d="M9 21v-6h6v6M9 11h.01M15 11h.01" />
    </svg>
  )
}

export function IconReferral(p) {
  return (
    <svg {...base} {...p}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20" />
    </svg>
  )
}

export function IconWorkshop(p) {
  return (
    <svg {...base} {...p}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-7 7L4 21l7-7a4 4 0 0 0 5.4-5.4l-2.1 2.1-2-2 2.1-2.1z" />
    </svg>
  )
}

export function IconProjectGuidance(p) {
  return (
    <svg {...base} {...p}>
      <path d="M9 18V5l12-2v13M9 13l12-2" />
      <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  )
}

export function IconHeart({ filled, ...p } = {}) {
  return (
    <svg {...base} fill={filled ? 'currentColor' : 'none'} {...p}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  )
}

export function IconUsers(p) {
  return (
    <svg {...base} {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function IconCheck(p) {
  return (
    <svg {...base} {...p}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

export function IconStar({ filled, ...p } = {}) {
  return (
    <svg {...base} fill={filled ? 'currentColor' : 'none'} {...p}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export function IconArchive(p) {
  return (
    <svg {...base} {...p}>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8M10 12h4" />
    </svg>
  )
}

export function IconClose(p) {
  return (
    <svg {...base} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>
  )
}

export function IconLink(p) {
  return (
    <svg {...base} {...p}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </svg>
  )
}

export function IconCalendar(p) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

export function IconBuilding(p) {
  return (
    <svg {...base} {...p}>
      <rect x="4" y="2" width="16" height="20" rx="1" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  )
}

export function IconPin(p) {
  return (
    <svg {...base} {...p}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function IconPlus(p) {
  return (
    <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
  )
}

export function IconGift(p) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
      <path d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5" />
    </svg>
  )
}

export function IconSparkle(p) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
    </svg>
  )
}

// Render the icon for a contribution-type key (falls back to the gift glyph).
export function TypeIcon({ type, ...p }) {
  switch (type) {
    case 'mentorship': return <IconMentorship {...p} />
    case 'campus_visit': return <IconCampusVisit {...p} />
    case 'referral': return <IconReferral {...p} />
    case 'workshop': return <IconWorkshop {...p} />
    case 'project_guidance': return <IconProjectGuidance {...p} />
    default: return <IconGift {...p} />
  }
}

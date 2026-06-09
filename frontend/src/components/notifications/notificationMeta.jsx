import {
  HiOutlineThumbUp,
  HiOutlineEyeOff,
  HiOutlineEye,
  HiOutlineSparkles,
  HiOutlineSpeakerphone,
  HiOutlineBell,
} from 'react-icons/hi'

// Visual treatment per notification type — icon + accent color. Keeps the
// dropdown and the full page rendering identical. Falls back to a generic bell.
const TYPE_META = {
  post_like: { Icon: HiOutlineThumbUp, color: '#0a66c2', label: 'Like' },
  post_hidden: { Icon: HiOutlineEyeOff, color: '#b45309', label: 'Moderation' },
  post_unhidden: { Icon: HiOutlineEye, color: '#16a34a', label: 'Moderation' },
  welcome: { Icon: HiOutlineSparkles, color: '#7c3aed', label: 'Welcome' },
  announcement: { Icon: HiOutlineSpeakerphone, color: '#db2777', label: 'Announcement' },
}

export function notificationMeta(type) {
  return TYPE_META[type] || { Icon: HiOutlineBell, color: '#6b7280', label: 'Update' }
}

// Compact relative time for the feed (e.g. "just now", "5m", "3h", "2d").
export function notificationTimeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

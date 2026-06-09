import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import {
  HiBell,
  HiInformationCircle,
  HiThumbUp,
  HiEyeOff,
  HiEye,
  HiSparkles,
  HiSpeakerphone,
  HiCheck,
} from 'react-icons/hi'
import { verifySession } from '../../lib/auth'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../lib/notificationsApi'

const PAGE_SIZE = 15

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

// Per-type icon for the left badge.
function NotifIcon({ type }) {
  switch (type) {
    case 'post_like':
      return <HiThumbUp />
    case 'post_hidden':
      return <HiEyeOff />
    case 'post_unhidden':
      return <HiEye />
    case 'welcome':
      return <HiSparkles />
    case 'announcement':
      return <HiSpeakerphone />
    default:
      return <HiBell />
  }
}

function Notifications() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all') // all | unread
  const [marking, setMarking] = useState(false)

  // Gate on a valid session — same pattern as the blogs page.
  useEffect(() => {
    let mounted = true
    verifySession().then((user) => {
      if (!mounted) return
      if (!user) navigate('/login', { replace: true })
    })
    return () => { mounted = false }
  }, [navigate])

  const load = useCallback(async (nextPage, replace) => {
    setLoading(true)
    try {
      const data = await fetchNotifications({
        page: nextPage,
        limit: PAGE_SIZE,
        unread: tab === 'unread' || undefined,
      })
      setItems((prev) => (replace ? data.rows : [...prev, ...data.rows]))
      setPage(data.page)
      setHasMore(data.hasMore)
      setUnreadCount(data.unread_count ?? 0)
    } catch (err) {
      enqueueSnackbar(err.message || 'Could not load notifications.', { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [tab, enqueueSnackbar])

  useEffect(() => { load(1, true) }, [load])

  // Mark one as read, then follow its link (if any).
  const handleOpen = async (notif) => {
    if (!notif.read) {
      setItems((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
      try {
        await markNotificationRead(notif.id)
        // Tell the navbar badge to refresh.
        window.dispatchEvent(new Event('notifications:changed'))
      } catch {
        /* optimistic — a failed read isn't worth interrupting the user */
      }
    }
    if (notif.link) navigate(notif.link)
  }

  const handleMarkAll = async () => {
    if (marking || unreadCount === 0) return
    setMarking(true)
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await markAllNotificationsRead()
      window.dispatchEvent(new Event('notifications:changed'))
      enqueueSnackbar('All notifications marked as read.', { variant: 'success' })
      if (tab === 'unread') load(1, true)
    } catch (err) {
      enqueueSnackbar(err.message || 'Could not update notifications.', { variant: 'error' })
      load(1, true)
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="notifications-page page-content">
      <section className="notifications-hero">
        <div className="container">
          <div className="notifications-hero-inner">
            <HiBell className="notifications-hero-icon" />
            <div>
              <h1>Notification Centre</h1>
              <p>Likes on your posts, moderation updates, and announcements from MVIT Alumni</p>
            </div>
          </div>
        </div>
      </section>

      <section className="notifications-content">
        <div className="container">
          <div className="notif-toolbar">
            <div className="notif-tabs">
              <button
                className={`notif-tab${tab === 'all' ? ' is-active' : ''}`}
                onClick={() => setTab('all')}
              >
                All
              </button>
              <button
                className={`notif-tab${tab === 'unread' ? ' is-active' : ''}`}
                onClick={() => setTab('unread')}
              >
                Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            </div>
            <button
              className="notif-markall"
              onClick={handleMarkAll}
              disabled={marking || unreadCount === 0}
            >
              <HiCheck /> Mark all read
            </button>
          </div>

          {loading && items.length === 0 && (
            <div className="notif-empty">
              <HiBell />
              <p>Loading notifications…</p>
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="notif-empty">
              <HiInformationCircle />
              <p>{tab === 'unread' ? "You're all caught up." : 'No notifications yet.'}</p>
            </div>
          )}

          {items.length > 0 && (
            <div className="notif-list">
              {items.map((notif) => (
                <button
                  type="button"
                  key={notif.id}
                  className={`notif-card${notif.read ? '' : ' is-unread'}${notif.link ? ' is-clickable' : ''}`}
                  onClick={() => handleOpen(notif)}
                >
                  <div className={`notif-icon-wrap notif-icon-wrap--${notif.type}`}>
                    <NotifIcon type={notif.type} />
                  </div>
                  <div className="notif-body">
                    <span className="notif-time">{timeAgo(notif.created_at)}</span>
                    <p className="notif-text">{notif.message}</p>
                  </div>
                  {!notif.read && <span className="notif-dot" aria-label="Unread" />}
                </button>
              ))}
            </div>
          )}

          {hasMore && !loading && (
            <button className="notif-more" onClick={() => load(page + 1, false)}>
              Load more
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

export default Notifications

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import { verifySession } from '../../lib/auth'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../lib/notificationsApi'
import { notificationMeta, notificationTimeAgo } from '../../components/notifications/notificationMeta'
import '../../components/notifications/notifications.css'

const PAGE_SIZE = 20

function Notifications() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [tab, setTab] = useState('all') // all | unread
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    verifySession().then((user) => {
      if (mounted && !user) navigate('/login', { replace: true })
    })
    return () => { mounted = false }
  }, [navigate])

  const load = useCallback(async (nextPage, replace) => {
    setLoading(true)
    if (replace) setError('')
    try {
      const data = await fetchNotifications({
        page: nextPage,
        limit: PAGE_SIZE,
        unread: tab === 'unread',
      })
      setRows((prev) => (replace ? data.rows : [...prev, ...(data.rows || [])]))
      setPage(data.page)
      setHasMore(data.hasMore)
      setUnreadCount(data.unread_count ?? 0)
    } catch (err) {
      // Don't show an empty "no notifications" state that masks a failed load —
      // surface a real error with a retry path. On an initial/replace load we
      // render the inline error UI; on "load more" we keep what's there and toast.
      const msg = err?.message || 'Could not load notifications. Please try again.'
      if (replace) setError(msg)
      enqueueSnackbar(msg, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [tab, enqueueSnackbar])

  useEffect(() => { load(1, true) }, [load])

  const handleItemClick = async (item) => {
    if (!item.read) {
      setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, read: true } : r)))
      setUnreadCount((c) => Math.max(0, c - 1))
      try {
        await markNotificationRead(item.id)
        window.dispatchEvent(new Event('notifications:changed'))
      } catch { /* best-effort */ }
    }
    if (item.link) navigate(item.link)
  }

  const handleMarkAll = async () => {
    setRows((prev) => prev.map((r) => ({ ...r, read: true })))
    setUnreadCount(0)
    try {
      await markAllNotificationsRead()
      window.dispatchEvent(new Event('notifications:changed'))
    } catch { /* best-effort */ }
    if (tab === 'unread') load(1, true)
  }

  return (
    <div className="notif-page page-content">
      <div className="notif-page__inner">
        <div className="notif-page__head">
          <h1>Notifications</h1>
          <button className="notif-page__markall" onClick={handleMarkAll} disabled={unreadCount === 0}>
            Mark all as read
          </button>
        </div>

        <div className="notif-page__tabs">
          <button className={`notif-page__tab${tab === 'all' ? ' is-active' : ''}`} onClick={() => setTab('all')}>
            All
          </button>
          <button className={`notif-page__tab${tab === 'unread' ? ' is-active' : ''}`} onClick={() => setTab('unread')}>
            Unread{unreadCount > 0 && <span className="notif-tab__badge">{unreadCount}</span>}
          </button>
        </div>

        {loading && rows.length === 0 ? (
          <div className="notif-page__list"><div className="notif-page__state">Loading…</div></div>
        ) : error && rows.length === 0 ? (
          <div className="notif-page__list">
            <div className="notif-page__state notif-page__state--error">
              <p>{error}</p>
              <button type="button" className="notif-page__retry" onClick={() => load(1, true)}>
                Try again
              </button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="notif-page__list">
            <div className="notif-page__state">
              {tab === 'unread' ? 'You have no unread notifications.' : 'No notifications yet.'}
            </div>
          </div>
        ) : (
          <div className="notif-page__list">
            {rows.map((item) => {
              const { Icon, color } = notificationMeta(item.type)
              return (
                <button
                  key={item.id}
                  className={`notif-item${item.read ? '' : ' is-unread'}`}
                  onClick={() => handleItemClick(item)}
                >
                  <span className="notif-item__icon" style={{ '--c': color }}><Icon /></span>
                  <span className="notif-item__body">
                    <span className="notif-item__text">{item.message}</span>
                    <span className="notif-item__time">{notificationTimeAgo(item.created_at)}</span>
                  </span>
                  {!item.read && <span className="notif-item__dot" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        )}

        {hasMore && !loading && (
          <button className="notif-page__more" onClick={() => load(page + 1, false)}>Load more</button>
        )}
      </div>
    </div>
  )
}

export default Notifications

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiX } from 'react-icons/hi'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../lib/notificationsApi'
import { notificationMeta, notificationTimeAgo } from './notificationMeta'
import './notifications.css'

// Bell dropdown panel — mirrors the look of a notifications inbox: All/Unread
// tabs, "Mark all as read", a scrollable list, and a "View all" footer that
// opens the full page. Closes on outside click / Escape (handled by parent).
function NotificationDropdown({ onClose }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all') // all | unread
  const [rows, setRows] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchNotifications({ page: 1, limit: 8, unread: tab === 'unread' })
      setRows(data.rows || [])
      setUnreadCount(data.unread_count ?? 0)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  // Close on outside click / Escape.
  useEffect(() => {
    const onPointer = (e) => { if (!panelRef.current?.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const handleItemClick = async (item) => {
    if (!item.read) {
      setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, read: true } : r)))
      setUnreadCount((c) => Math.max(0, c - 1))
      try {
        await markNotificationRead(item.id)
        window.dispatchEvent(new Event('notifications:changed'))
      } catch { /* best-effort */ }
    }
    onClose()
    if (item.link) navigate(item.link)
  }

  const handleMarkAll = async () => {
    setRows((prev) => prev.map((r) => ({ ...r, read: true })))
    setUnreadCount(0)
    try {
      await markAllNotificationsRead()
      window.dispatchEvent(new Event('notifications:changed'))
    } catch { /* best-effort */ }
    if (tab === 'unread') load()
  }

  const goToAll = () => { onClose(); navigate('/notifications') }

  return (
    <div className="notif-dropdown" ref={panelRef} role="dialog" aria-label="Notifications">
      <div className="notif-dropdown__head">
        <h3>Notifications</h3>
        <button className="notif-dropdown__x" onClick={onClose} aria-label="Close notifications"><HiX /></button>
      </div>

      <div className="notif-dropdown__tabs">
        <button className={`notif-tab${tab === 'all' ? ' is-active' : ''}`} onClick={() => setTab('all')}>All</button>
        <button className={`notif-tab${tab === 'unread' ? ' is-active' : ''}`} onClick={() => setTab('unread')}>
          Unread{unreadCount > 0 && <span className="notif-tab__badge">{unreadCount}</span>}
        </button>
        <button
          className="notif-dropdown__markall"
          onClick={handleMarkAll}
          disabled={unreadCount === 0}
        >
          Mark all as read
        </button>
      </div>

      <div className="notif-dropdown__list">
        {loading && rows.length === 0 && (
          <div className="notif-dropdown__state">Loading…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="notif-dropdown__state">
            {tab === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
          </div>
        )}
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

      <button className="notif-dropdown__viewall" onClick={goToAll}>View all</button>
    </div>
  )
}

export default NotificationDropdown

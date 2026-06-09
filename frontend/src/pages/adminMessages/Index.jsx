import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import { HiOutlineRefresh, HiOutlineMail, HiOutlineTrash } from 'react-icons/hi'
import {
  listContactMessages,
  markMessageRead,
  deleteContactMessage,
} from '../../lib/contactMessages'

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function StatusBadge({ status }) {
  const map = {
    received: { label: 'Received', cls: 'badge-received' },
    emailed: { label: 'Emailed', cls: 'badge-emailed' },
    failed: { label: 'Email failed', cls: 'badge-failed' },
    read: { label: 'Read', cls: 'badge-read' },
  }
  const item = map[status] || { label: status || 'Unknown', cls: 'badge-default' }
  return <span className={`am-badge ${item.cls}`}>{item.label}</span>
}

function AdminMessages() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()

  // 'checking' until first listContactMessages() resolves; then 'ready'.
  // On 401/403 we navigate away before changing state.
  const [accessState, setAccessState] = useState('checking')
  const [messages, setMessages] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  // ── Single combined auth + data check ─────────────────────────────────
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const result = await listContactMessages()
        if (!mounted) return
        setMessages(result?.messages || [])
        setAccessState('ready')
      } catch (err) {
        if (!mounted) return
        if (err?.status === 401) {
          navigate('/login', { replace: true })
          return
        }
        if (err?.status === 403) {
          enqueueSnackbar('You are not authorized to view this page.', { variant: 'error' })
          navigate('/', { replace: true })
          return
        }
        enqueueSnackbar(err?.message || 'Failed to load messages.', { variant: 'error' })
        navigate('/', { replace: true })
      }
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = async () => {
    setRefreshing(true)
    try {
      const result = await listContactMessages()
      setMessages(result?.messages || [])
    } catch (err) {
      enqueueSnackbar(err?.message || 'Failed to refresh.', { variant: 'error' })
    } finally {
      setRefreshing(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return messages.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (!q) return true
      return [m.name, m.email, m.subject, m.message].some((v) =>
        String(v || '').toLowerCase().includes(q),
      )
    })
  }, [messages, query, statusFilter])

  const handleOpen = (m) => {
    setSelected(m)
    if (m.status !== 'read') {
      // Optimistic local update; ignore server errors silently here so the
      // admin's reading flow isn't interrupted by a transient failure.
      setMessages((prev) =>
        prev.map((row) =>
          row.id === m.id
            ? { ...row, status: 'read', read_at: new Date().toISOString() }
            : row,
        ),
      )
      markMessageRead(m.id).catch(() => {})
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this message permanently?')) return
    try {
      await deleteContactMessage(id)
      setMessages((prev) => prev.filter((m) => m.id !== id))
      if (selected?.id === id) setSelected(null)
      enqueueSnackbar('Message deleted.', { variant: 'success' })
    } catch (err) {
      enqueueSnackbar(err?.message || 'Failed to delete.', { variant: 'error' })
    }
  }

  // ── Loading gate: nothing but a spinner until access is confirmed ────
  if (accessState !== 'ready') {
    return (
      <div className="admin-messages-page page-content">
        <div className="am-fullscreen-loader">
          <div className="am-spinner" aria-label="Checking access" />
        </div>
      </div>
    )
  }

  return (
    <div className="admin-messages-page page-content">
      <section className="am-hero">
        <div className="container">
          <p className="am-eyebrow">Admin</p>
          <h1>Contact Messages</h1>
          <p className="am-sub">
            Messages submitted through the Contact form. Decrypted server-side and shown only to authorized accounts.
          </p>
        </div>
      </section>

      <section className="am-content">
        <div className="container">
          <div className="am-toolbar">
            <div className="am-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, subject, message"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="am-toolbar-right">
              <select
                className="am-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All status</option>
                <option value="received">Received</option>
                <option value="emailed">Emailed</option>
                <option value="failed">Email failed</option>
                <option value="read">Read</option>
              </select>

              <button
                type="button"
                className="am-refresh-btn"
                onClick={refresh}
                disabled={refreshing}
              >
                <HiOutlineRefresh />
                <span>{refreshing ? 'Loading…' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          <div className="am-table-wrap">
            <table className="am-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Subject</th>
                  <th className="am-actions-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="am-empty">No messages found.</td>
                  </tr>
                ) : (
                  filtered.map((m) => {
                    const rowClasses = [
                      selected?.id === m.id ? 'am-row-selected' : '',
                      m.status === 'read' ? 'am-row-read' : 'am-row-unread',
                    ].filter(Boolean).join(' ')

                    return (
                      <tr
                        key={m.id}
                        className={rowClasses}
                        onClick={() => handleOpen(m)}
                      >
                        <td>{formatDate(m.created_at)}</td>
                        <td className="am-name-cell">{m.name}</td>
                        <td className="am-email-cell">
                          <a href={`mailto:${m.email}`} onClick={(e) => e.stopPropagation()}>
                            {m.email}
                          </a>
                        </td>
                        <td className="am-subject-cell">{m.subject}</td>
                        <td className="am-actions">
                          <a
                            className="am-action-btn"
                            href={`mailto:${m.email}?subject=Re:%20${encodeURIComponent(m.subject)}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Reply"
                          >
                            <HiOutlineMail />
                          </a>
                          <button
                            type="button"
                            className="am-action-btn am-action-danger"
                            onClick={(e) => { e.stopPropagation(); handleDelete(m.id) }}
                            title="Delete"
                          >
                            <HiOutlineTrash />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="am-detail-overlay" onClick={() => setSelected(null)}>
              <div className="am-detail" onClick={(e) => e.stopPropagation()}>
                <div className="am-detail-head">
                  <div>
                    <p className="am-detail-eyebrow">{formatDate(selected.created_at)}</p>
                    <h3>{selected.subject}</h3>
                  </div>
                  <button
                    type="button"
                    className="am-detail-close"
                    onClick={() => setSelected(null)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="am-detail-meta">
                  <div>
                    <span>From</span>
                    <strong>{selected.name}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <a href={`mailto:${selected.email}`}>{selected.email}</a>
                  </div>
                  <div>
                    <span>Status</span>
                    <StatusBadge status={selected.status} />
                  </div>
                  {selected.email_error && (
                    <div className="am-detail-error">
                      <span>Email error</span>
                      <code>{selected.email_error}</code>
                    </div>
                  )}
                </div>
                <div className="am-detail-body">{selected.message}</div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default AdminMessages

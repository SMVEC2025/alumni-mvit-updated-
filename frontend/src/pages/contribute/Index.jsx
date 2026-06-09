import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import { verifySession, getUser } from '../../lib/auth'
import {
  CONTRIBUTION_TYPES,
  CONTRIBUTION_MODES,
  typeMeta,
  fetchContributions,
  createContribution,
  reviewContribution,
  expressInterest,
  withdrawInterest,
  fetchInterested,
} from '../../lib/contributeApi'
import { useProtectedImageUrl } from '../../hooks/useProtectedImageUrl'
import {
  TypeIcon, IconHeart, IconUsers, IconCheck, IconStar, IconArchive, IconClose,
  IconLink, IconCalendar, IconBuilding, IconPin, IconPlus, IconGift,
} from './icons'
import './Index.css'

const PAGE_SIZE = 10

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

const STATUS_LABEL = {
  pending: 'Pending review',
  approved: 'Approved',
  featured: 'Featured',
  archived: 'Archived',
}

const TYPE_CARD_ICONS = {
  mentorship: '/icon/mentorship.png',
  campus_visit: '/icon/campus_visit.png',
  referral: '/icon/intership_referal.png',
  workshop: '/icon/Workshop.png',
  project_guidance: '/icon/project.png',
}

function Contribute() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [searchParams] = useSearchParams()
  const [viewer, setViewer] = useState(() => getUser())
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const initialStaff = (() => { const u = getUser(); return u?.role === 'staff' || u?.role === 'admin' })()
  // Alumni only ever see their own contributions, so they default to (and stay on)
  // the 'mine' tab. Staff get the full Explore feed + review queue.
  const [tab, setTab] = useState(initialStaff ? 'all' : 'mine') // all | mine | queue
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerType, setComposerType] = useState('mentorship')

  // Open the composer pre-set to a contribution type (from the feature grid).
  const openComposerWith = (type) => { setComposerType(type); setComposerOpen(true) }

  const isStaff = viewer?.role === 'staff' || viewer?.role === 'admin'

  useEffect(() => {
    let mounted = true
    verifySession().then((user) => {
      if (!mounted) return
      if (!user) { navigate('/login', { replace: true }); return }
      setViewer(user)
      // Non-staff are locked to their own contributions.
      const staff = user.role === 'staff' || user.role === 'admin'
      if (!staff) setTab('mine')
    })
    return () => { mounted = false }
  }, [navigate])

  const load = useCallback(async (nextPage, replace) => {
    setLoading(true)
    try {
      const params = { page: nextPage, limit: PAGE_SIZE }
      // Non-staff always fetch only their own (server enforces this too).
      if (tab === 'mine' || !isStaff) params.mine = true
      if (tab === 'queue') params.status = 'pending'
      const data = await fetchContributions(params)
      setRows((prev) => (replace ? data.rows : [...prev, ...data.rows]))
      setPage(data.page)
      setHasMore(data.hasMore)
    } catch (err) {
      enqueueSnackbar(err.message || 'Could not load contributions.', { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [tab, isStaff, enqueueSnackbar])

  useEffect(() => {
    const t = setTimeout(() => load(1, true), 180)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    const id = searchParams.get('id')
    if (id && rows.length) {
      const el = document.getElementById(`contrib-${id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('is-highlighted')
      const t = setTimeout(() => el?.classList.remove('is-highlighted'), 2400)
      return () => clearTimeout(t)
    }
    return undefined
  }, [searchParams, rows])

  const handleInterestToggle = async (item) => {
    const optimistic = !item.interested
    setRows((prev) => prev.map((r) => (
      r.id === item.id
        ? { ...r, interested: optimistic, interest_count: r.interest_count + (optimistic ? 1 : -1) }
        : r
    )))
    try {
      const res = optimistic ? await expressInterest(item.id) : await withdrawInterest(item.id)
      setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, interested: res.interested, interest_count: res.interest_count } : r)))
      if (optimistic) enqueueSnackbar('Interest sent — the alumnus will be notified.', { variant: 'success' })
    } catch (err) {
      enqueueSnackbar(err.message || 'Action failed.', { variant: 'error' })
      load(1, true)
    }
  }

  const handleReview = async (item, status) => {
    try {
      const updated = await reviewContribution(item.id, status)
      setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: updated.status } : r)))
      enqueueSnackbar(`Marked as ${STATUS_LABEL[status] || status}.`, { variant: 'success' })
      if (tab === 'queue' && status !== 'pending') {
        setRows((prev) => prev.filter((r) => r.id !== item.id))
      }
    } catch (err) {
      enqueueSnackbar(err.message || 'Review failed.', { variant: 'error' })
    }
  }

  const onCreated = (item) => {
    setComposerOpen(false)
    enqueueSnackbar('Thank you! Your contribution was submitted for review.', { variant: 'success' })
    if (tab === 'mine') setRows((prev) => [item, ...prev])
  }

  return (
    <div className="contribute-page page-content">
      {/* ── Hero (LinkedIn-business style: clean, centered, single blue accent) ── */}
      <section className="ctb-hero">
        <div className="ctb-container ctb-hero__inner">
          <div className="ctb-hero__copy">
            <span className="ctb-hero__eyebrow">SMVEC Alumni · Give back</span>
            <h1>Turn your experience into impact for MVIT students</h1>
            <p>Mentor, visit campus, refer opportunities, run a workshop, or guide a project. Offer your time — staff review it, and students reach out.</p>
            <div className="ctb-hero__cta">
              <button className="ctb-btn-primary" onClick={() => setComposerOpen(true)}>Offer a contribution</button>
              <a className="ctb-btn-link" href="#ctb-how">See how it works →</a>
            </div>
          </div>
          <div className="ctb-hero__visual" aria-hidden="true">
            <div className="ctb-hero__photo">
              <img src="/img/background/contribution_home.png" alt="Alumni mentoring MVIT students" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Ways to contribute: alternating zig-zag rows ── */}
      <section className="ctb-section ctb-section--light">
        <div className="ctb-container">
          <div className="ctb-section__head">
            <h2>Ways you can contribute</h2>
            <p>Pick how you’d like to support the next generation of MVIT.</p>
          </div>
          <div className="ctb-rows">
            {CONTRIBUTION_TYPES.map((t, i) => (
              <FeatureRow key={t.key} type={t} flipped={i % 2 === 1} onOffer={() => openComposerWith(t.key)} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works: 3-step band ── */}
      <section className="ctb-section ctb-how" id="ctb-how">
        <div className="ctb-container">
          <div className="ctb-section__head">
            <h2>How it works</h2>
          </div>
          <div className="ctb-steps3">
            <div className="ctb-step"><span className="ctb-step__num">1</span><h3>Offer your contribution</h3><p>Choose a type and tell us how you’d like to help.</p></div>
            <div className="ctb-step"><span className="ctb-step__num">2</span><h3>Staff review it</h3><p>Our team verifies and approves your contribution.</p></div>
            <div className="ctb-step"><span className="ctb-step__num">3</span><h3>Students reach out</h3><p>Approved contributions reach students who need them.</p></div>
          </div>
        </div>
      </section>

      {/* ── My contributions / feed ── */}
      <section className="ctb-section ctb-section--feed">
        <div className="ctb-container ctb-feed-wrap">
          <div className="ctb-feed__bar">
            <div className="ctb-feed__title">
              <h2>{isStaff ? 'Contributions' : 'My contributions'}</h2>
              <p>{isStaff ? 'Review, feature, and manage alumni contributions.' : 'Your offers to give back — visible to you and reviewed by staff.'}</p>
            </div>
            <button className="ctb-btn-primary ctb-btn-primary--sm" onClick={() => setComposerOpen(true)}>
              <IconPlus width={16} height={16} /> Contribute
            </button>
          </div>

          {isStaff && (
            <div className="ctb-tabs">
              <button className={`ctb-tab${tab === 'all' ? ' is-active' : ''}`} onClick={() => setTab('all')}>Explore</button>
              <button className={`ctb-tab${tab === 'mine' ? ' is-active' : ''}`} onClick={() => setTab('mine')}>Mine</button>
              <button className={`ctb-tab${tab === 'queue' ? ' is-active' : ''}`} onClick={() => setTab('queue')}>Review queue</button>
            </div>
          )}

          <div className="ctb-feed">
            {loading && rows.length === 0 && (<>{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</>)}

            {!loading && rows.length === 0 && (
              <div className="ctb-card ctb-empty">
                <div className="ctb-empty__art"><IconGift width={42} height={42} /></div>
                <h3>{tab === 'queue' ? 'Nothing to review' : tab === 'mine' ? 'You haven’t contributed yet' : 'No contributions yet'}</h3>
                <p>{tab === 'queue' ? 'You’re all caught up. 🎉' : 'Be the first to give back — it only takes a minute.'}</p>
                {tab !== 'queue' && (
                  <button className="ctb-empty__btn" onClick={() => setComposerOpen(true)}>
                    <IconPlus width={16} height={16} /> Offer a contribution
                  </button>
                )}
              </div>
            )}

            {rows.map((item) => (
              <ContributionCard
                key={item.id}
                item={item}
                isStaff={isStaff}
                onInterest={() => handleInterestToggle(item)}
                onReview={(status) => handleReview(item, status)}
                enqueueSnackbar={enqueueSnackbar}
              />
            ))}

            {hasMore && !loading && (
              <button className="ctb-more" onClick={() => load(page + 1, false)}>Show more contributions</button>
            )}
          </div>
        </div>
      </section>

      {composerOpen && (
        <Composer initialType={composerType} onClose={() => setComposerOpen(false)} onCreated={onCreated} enqueueSnackbar={enqueueSnackbar} />
      )}
    </div>
  )
}

// One alternating "zig-zag" feature row: copy on one side, a themed illustration
// on the other (LinkedIn-business style). Uses the type's PNG; if it's missing/
// fails to load, falls back to the built-in layered card-stack mock.
function FeatureRow({ type, flipped, onOffer }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = type.image && !imgFailed

  return (
    <div className={`ctb-row${flipped ? ' ctb-row--flip' : ''}`} style={{ '--c': type.color }}>
      <div className="ctb-row__copy">
        <h3>{type.label}</h3>
        <ul className="ctb-row__points">
          {type.points.map((p, i) => (
            <li key={i}><strong>{p.lead}</strong> {p.rest}</li>
          ))}
        </ul>
        <button className="ctb-btn-primary ctb-btn-primary--sm" onClick={onOffer}>
          <IconPlus width={15} height={15} /> Offer this
        </button>
      </div>
      <div className="ctb-row__art" aria-hidden="true">
        {showImage ? (
          <img
            className="ctb-row__img"
            src={type.image}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <FeatureArt type={type} />
        )}
      </div>
    </div>
  )
}

// Layered, floating card-stack mock for a contribution type.
function FeatureArt({ type }) {
  return (
    <div className="ctb-art" style={{ '--c': type.color }}>
      <div className="ctb-art__tag"><TypeIcon type={type.key} width={15} height={15} /> {type.short}</div>

      <div className="ctb-art__card ctb-art__card--main">
        <div className="ctb-art__avatar"><TypeIcon type={type.key} width={20} height={20} /></div>
        <div className="ctb-art__lines">
          <span className="ctb-art__line ctb-art__line--w70" />
          <span className="ctb-art__line ctb-art__line--w45 ctb-art__line--soft" />
        </div>
      </div>

      <div className="ctb-art__card ctb-art__card--stat">
        <span className="ctb-art__stat-label">{type.blurb}</span>
        <div className="ctb-art__pills">
          <span className="ctb-art__pill" /><span className="ctb-art__pill" />
        </div>
      </div>

      <div className="ctb-art__card ctb-art__card--people">
        <span className="ctb-art__people-title">Reaches students</span>
        <div className="ctb-art__person"><span className="ctb-art__dot" /><span className="ctb-art__line ctb-art__line--w60" /></div>
        <div className="ctb-art__person"><span className="ctb-art__dot" /><span className="ctb-art__line ctb-art__line--w50" /></div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="ctb-card ctb-skel">
      <div className="ctb-skel__head">
        <div className="ctb-skel__avatar sk" />
        <div className="ctb-skel__lines">
          <div className="sk sk--w40" /><div className="sk sk--w24" />
        </div>
      </div>
      <div className="sk sk--title" />
      <div className="sk sk--text" /><div className="sk sk--text" /><div className="sk sk--w60" />
      <div className="ctb-skel__foot"><div className="sk sk--btn" /></div>
    </div>
  )
}

function ContributionCard({ item, isStaff, onInterest, onReview, enqueueSnackbar }) {
  const meta = typeMeta(item.type)
  const avatarUrl = useProtectedImageUrl(item.contributor?.profile_image_url)
  const initials = (item.contributor?.name || 'A').charAt(0).toUpperCase()
  const profileTo = item.contributor?.profile_id ? `/directory/alumni/${item.contributor.profile_id}` : null
  const [showInterested, setShowInterested] = useState(false)
  const [interested, setInterested] = useState(null)
  const modeLabel = (CONTRIBUTION_MODES.find((m) => m.key === item.mode) || {}).label

  const loadInterested = async () => {
    setShowInterested(true)
    try {
      setInterested(await fetchInterested(item.id))
    } catch (err) {
      enqueueSnackbar(err.message || 'Could not load interested list.', { variant: 'error' })
      setShowInterested(false)
    }
  }

  const canShowInterest = !item.can_edit && item.status !== 'pending' && item.status !== 'archived'

  const showActions = canShowInterest || item.can_edit || isStaff

  return (
    <article className="ctb-card ctb-post" id={`contrib-${item.id}`} style={{ '--c': meta.color }}>
      {/* Header */}
      <div className="ctb-post__head">
        {profileTo ? (
          <Link to={profileTo} className="ctb-avatar ctb-avatar--link" aria-label={`View ${item.contributor?.name}'s profile`}>
            {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
          </Link>
        ) : (
          <div className="ctb-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initials}</div>
        )}
        <div className="ctb-post__who">
          {profileTo ? (
            <Link to={profileTo} className="ctb-post__name ctb-post__name--link">{item.contributor?.name}</Link>
          ) : (
            <span className="ctb-post__name">{item.contributor?.name}</span>
          )}
          <span className="ctb-post__sub">
            {item.contributor?.headline ? `${item.contributor.headline} · ` : ''}{timeAgo(item.created_at)} ago
          </span>
        </div>
        <span className="ctb-post__badge">
          <TypeIcon type={item.type} width={13} height={13} /> {meta.short}
        </span>
      </div>

      {/* Body */}
      <h3 className="ctb-post__title">{item.title}</h3>
      <p className="ctb-post__desc">{item.description}</p>

      {(item.company || item.availability || (item.mode && item.mode !== 'flexible')) && (
        <div className="ctb-post__meta">
          {item.company && <span className="ctb-meta"><IconBuilding width={14} height={14} /> {item.company}</span>}
          {item.availability && <span className="ctb-meta"><IconCalendar width={14} height={14} /> {item.availability}</span>}
          {item.mode && item.mode !== 'flexible' && <span className="ctb-meta"><IconPin width={14} height={14} /> {modeLabel}</span>}
        </div>
      )}

      {item.domains?.length > 0 && (
        <div className="ctb-post__domains">
          {item.domains.map((d) => <span key={d} className="ctb-domain">{d}</span>)}
        </div>
      )}

      {item.link && (
        <a className="ctb-post__link" href={item.link} target="_blank" rel="noopener noreferrer">
          <IconLink width={14} height={14} /> View related link
        </a>
      )}

      {/* Footer: status + interest, on one quiet line */}
      {(showActions || item.status !== 'approved') && (
        <div className="ctb-post__foot">
          {item.status !== 'approved' && (
            <span className={`ctb-status ctb-status--${item.status}`}>
              <span className="ctb-status__dot" />
              {STATUS_LABEL[item.status]}
            </span>
          )}

          <div className="ctb-post__foot-actions">
            {canShowInterest && (
              <button className={`ctb-action${item.interested ? ' is-on' : ''}`} onClick={onInterest}>
                <IconHeart filled={item.interested} width={16} height={16} />
                {item.interested ? 'Interested' : "I'm interested"}
              </button>
            )}
            {(item.can_edit || isStaff) && (
              item.interest_count > 0 ? (
                <button className="ctb-action ctb-action--ghost" onClick={loadInterested}>
                  <IconUsers width={16} height={16} /> {item.interest_count} interested
                </button>
              ) : (
                <span className="ctb-interest-none"><IconUsers width={15} height={15} /> No interest yet</span>
              )
            )}
          </div>
        </div>
      )}

      {/* Staff review */}
      {item.can_review && (
        <div className="ctb-post__review">
          {item.status !== 'approved' && (
            <button className="ctb-rev ctb-rev--approve" onClick={() => onReview('approved')}><IconCheck width={15} height={15} /> Approve</button>
          )}
          {item.status !== 'featured' && (
            <button className="ctb-rev ctb-rev--feature" onClick={() => onReview('featured')}><IconStar width={15} height={15} /> Feature</button>
          )}
          {item.status !== 'archived' && (
            <button className="ctb-rev ctb-rev--archive" onClick={() => onReview('archived')}><IconArchive width={15} height={15} /> Archive</button>
          )}
        </div>
      )}

      {showInterested && (
        <div className="ctb-modal-overlay" onClick={() => setShowInterested(false)}>
          <div className="ctb-modal ctb-modal--list" onClick={(e) => e.stopPropagation()}>
            <div className="ctb-modal__head">
              <strong><IconUsers width={18} height={18} /> Interested people</strong>
              <button className="ctb-modal__x" onClick={() => setShowInterested(false)}><IconClose width={18} height={18} /></button>
            </div>
            {interested === null ? (
              <p className="ctb-modal__empty">Loading…</p>
            ) : interested.length === 0 ? (
              <p className="ctb-modal__empty">No one yet.</p>
            ) : (
              <ul className="ctb-intlist">
                {interested.map((p, i) => (
                  <li key={i}>
                    <span className="ctb-intlist__avatar">{(p.user?.name || 'M').charAt(0).toUpperCase()}</span>
                    <span className="ctb-intlist__body">
                      <strong>{p.user?.name}</strong>
                      {p.note && <em>“{p.note}”</em>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function Composer({ initialType = 'mentorship', onClose, onCreated, enqueueSnackbar }) {
  const [type, setType] = useState(initialType)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [domainsInput, setDomainsInput] = useState('')
  const [mode, setMode] = useState('flexible')
  const [availability, setAvailability] = useState('')
  const [company, setCompany] = useState('')
  const [link, setLink] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const meta = useMemo(() => typeMeta(type), [type])
  const showDomains = ['mentorship', 'project_guidance', 'workshop'].includes(type)
  const showCompany = ['referral', 'workshop'].includes(type)
  // A job/internship referral has no "mode" of engagement.
  const showMode = type !== 'referral'

  const handleSubmit = async () => {
    if (title.trim().length < 4) { enqueueSnackbar('Title must be at least 4 characters.', { variant: 'error' }); return }
    if (description.trim().length < 10) { enqueueSnackbar('Please add a longer description.', { variant: 'error' }); return }
    setSubmitting(true)
    try {
      const domains = domainsInput.split(/[,]+/).map((d) => d.trim()).filter(Boolean)
      const item = await createContribution({
        type, title: title.trim(), description: description.trim(), domains,
        mode: showMode ? mode : 'flexible',
        availability: availability.trim() || null,
        company: showCompany ? (company.trim() || null) : null,
        link: link.trim() || null,
      })
      onCreated(item)
    } catch (err) {
      enqueueSnackbar(err.message || 'Could not submit contribution.', { variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ctb-modal-overlay" onClick={onClose}>
      <div className="ctb-modal ctb-composer" onClick={(e) => e.stopPropagation()} style={{ '--c': meta.color }}>
        <div className="ctb-composer__head">
          <div>
            <h2>Offer a contribution</h2>
            <span>Share how you’d like to support MVIT students</span>
          </div>
          <button className="ctb-modal__x" onClick={onClose}><IconClose width={20} height={20} /></button>
        </div>

        <div className="ctb-composer__body">
          <label className="ctb-flabel">Choose a contribution type</label>
          <div className="ctb-typegrid">
            {CONTRIBUTION_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`ctb-typecard${type === t.key ? ' is-active' : ''}`}
                onClick={() => setType(t.key)}
                style={{ '--c': t.color }}
              >
                <span className="ctb-typecard__icon">
                  {TYPE_CARD_ICONS[t.key] ? (
                    <img src={TYPE_CARD_ICONS[t.key]} alt="" loading="lazy" />
                  ) : (
                    <TypeIcon type={t.key} width={22} height={22} />
                  )}
                </span>
                <span className="ctb-typecard__label">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="ctb-composer__hint" style={{ '--c': meta.color }}>{meta.blurb}</div>

          <label className="ctb-flabel">Title</label>
          <input className="ctb-field" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. Mentor students in full-stack development" />

          <label className="ctb-flabel">Description</label>
          <textarea className="ctb-field ctb-field--area" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={8000} placeholder="Describe how you'd like to help and what students can expect…" />

          {showDomains && (
            <>
              <label className="ctb-flabel">Skills / domains <span className="ctb-flabel__hint">comma separated</span></label>
              <input className="ctb-field" type="text" value={domainsInput} onChange={(e) => setDomainsInput(e.target.value)} placeholder="react, node, machine learning" />
            </>
          )}

          {showCompany && (
            <>
              <label className="ctb-flabel">Company / organisation</label>
              <input className="ctb-field" type="text" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} placeholder="Where the opportunity is" />
            </>
          )}

          {showMode ? (
            <div className="ctb-composer__row">
              <div>
                <label className="ctb-flabel">Mode</label>
                <select className="ctb-field" value={mode} onChange={(e) => setMode(e.target.value)}>
                  {CONTRIBUTION_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="ctb-flabel">Availability <span className="ctb-flabel__hint">optional</span></label>
                <input className="ctb-field" type="text" value={availability} onChange={(e) => setAvailability(e.target.value)} maxLength={200} placeholder="weekends, 1 hr/week…" />
              </div>
            </div>
          ) : (
            <>
              <label className="ctb-flabel">Availability <span className="ctb-flabel__hint">optional</span></label>
              <input className="ctb-field" type="text" value={availability} onChange={(e) => setAvailability(e.target.value)} maxLength={200} placeholder="e.g. openings every January" />
            </>
          )}

          <label className="ctb-flabel">Related link <span className="ctb-flabel__hint">optional</span></label>
          <input className="ctb-field" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
        </div>

        <div className="ctb-composer__foot">
          <p className="ctb-composer__note">Reviewed by staff before it appears publicly.</p>
          <div className="ctb-composer__btns">
            <button className="ctb-btn ctb-btn--ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button className="ctb-btn ctb-btn--primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Contribute

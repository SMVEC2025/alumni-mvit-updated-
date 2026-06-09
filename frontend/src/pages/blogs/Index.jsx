import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import { HiThumbUp, HiOutlineThumbUp, HiX, HiOutlineShare, HiOutlinePhotograph } from 'react-icons/hi'
import { verifySession, getUser } from '../../lib/auth'
import {
  fetchPosts,
  createPost,
  likePost,
  unlikePost,
  hidePost,
  unhidePost,
  uploadPostCover,
} from '../../lib/postsApi'
import { useProtectedImageUrl } from '../../hooks/useProtectedImageUrl'
import { useMyProfile } from '../../hooks/useMyProfile'
import './Index.css'

const PAGE_SIZE = 10

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function Blogs() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [viewer, setViewer] = useState(() => getUser())
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all') // all | mine
  const [composerOpen, setComposerOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    verifySession().then((user) => {
      if (!mounted) return
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      setViewer(user)
    })
    return () => { mounted = false }
  }, [navigate])

  const load = useCallback(async (nextPage, replace) => {
    setLoading(true)
    try {
      const data = await fetchPosts({
        page: nextPage,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        mine: tab === 'mine' || undefined,
      })
      setPosts((prev) => (replace ? data.rows : [...prev, ...data.rows]))
      setPage(data.page)
      setHasMore(data.hasMore)
    } catch (err) {
      enqueueSnackbar(err.message || 'Could not load posts.', { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [search, tab, enqueueSnackbar])

  useEffect(() => {
    const t = setTimeout(() => load(1, true), 250)
    return () => clearTimeout(t)
  }, [load])

  const handleLikeToggle = async (post) => {
    const optimistic = !post.liked
    setPosts((prev) => prev.map((p) => (
      p.id === post.id
        ? { ...p, liked: optimistic, like_count: p.like_count + (optimistic ? 1 : -1) }
        : p
    )))
    try {
      const res = optimistic ? await likePost(post.id) : await unlikePost(post.id)
      setPosts((prev) => prev.map((p) => (
        p.id === post.id ? { ...p, liked: res.liked, like_count: res.like_count } : p
      )))
    } catch (err) {
      enqueueSnackbar(err.message || 'Action failed.', { variant: 'error' })
      load(1, true)
    }
  }

  const handleModerate = async (post) => {
    try {
      const fn = post.is_hidden ? unhidePost : hidePost
      await fn(post.id)
      setPosts((prev) => prev.map((p) => (
        p.id === post.id ? { ...p, is_hidden: !post.is_hidden } : p
      )))
      enqueueSnackbar(post.is_hidden ? 'Post is now visible.' : 'Post hidden from feed.', { variant: 'success' })
    } catch (err) {
      enqueueSnackbar(err.message || 'Moderation failed.', { variant: 'error' })
    }
  }

  const handleShare = async (post) => {
    // Share the blog via the device's native share sheet (WhatsApp, etc.).
    // Points to the PUBLIC blog view so recipients can read it without logging in.
    const url = `${window.location.origin}/blog/${post.id}`
    const shareData = {
      title: post.title || 'Alumni Blog',
      text: `${post.title ? post.title + ' — ' : ''}${post.author?.name || 'An alumnus'} on SMVEC Alumni`,
      url,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(url)
        enqueueSnackbar('Link copied to clipboard.', { variant: 'success' })
      }
    } catch (err) {
      // User cancelling the share sheet throws AbortError — ignore it.
      if (err?.name !== 'AbortError') {
        enqueueSnackbar('Could not share this post.', { variant: 'error' })
      }
    }
  }

  const onCreated = (post) => {
    setComposerOpen(false)
    setPosts((prev) => [post, ...prev])
    enqueueSnackbar('Your blog has been published.', { variant: 'success' })
  }

  const { initial: viewerInitial, profileImageUrl: viewerImageUrl } = useMyProfile()

  return (
    <div className="blogs-page page-content">
      {/* Composer prompt card */}
      <div className="composer-card">
        <div className="composer-card__intro">
          <div>
            <span className="composer-card__eyebrow">Alumni Space</span>
            <h2>Share a thoughtful update</h2>
          </div>
          <button className="composer-card__post composer-card__post--top" onClick={() => setComposerOpen(true)}>Write a post</button>
        </div>
        <div className="composer-card__top">
          <div className="composer-card__avatar">
            {viewerImageUrl ? <img src={viewerImageUrl} alt="" /> : viewerInitial}
          </div>
          <button className="composer-card__prompt" onClick={() => setComposerOpen(true)}>
            Share an insight, milestone, memory, or opportunity with the alumni network.
          </button>
        </div>
      </div>

      <div className="blogs-tabs-row">
        <div className="blogs-tabs">
          <button className={`blogs-tab${tab === 'all' ? ' is-active' : ''}`} onClick={() => setTab('all')}>All posts</button>
          <button className={`blogs-tab${tab === 'mine' ? ' is-active' : ''}`} onClick={() => setTab('mine')}>My posts</button>
        </div>
      </div>

      {loading && posts.length === 0 && <div className="blogs-loading">Loading blogs…</div>}
      {!loading && posts.length === 0 && (
        <div className="blogs-empty">
          No blogs yet. Be the first to <strong>write one</strong>!
        </div>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onLike={() => handleLikeToggle(post)}
          onShare={() => handleShare(post)}
          onModerate={() => handleModerate(post)}
          onTagClick={(t) => setSearch(t)}
        />
      ))}

      {hasMore && !loading && (
        <button className="blogs-more" onClick={() => load(page + 1, false)}>Load more</button>
      )}

      {composerOpen && (
        <Composer
          viewer={viewer}
          onClose={() => setComposerOpen(false)}
          onCreated={onCreated}
          enqueueSnackbar={enqueueSnackbar}
        />
      )}
    </div>
  )
}

const BODY_CLAMP = 280

function PostCard({ post, onLike, onShare, onTagClick, onModerate }) {
  const coverUrl = useProtectedImageUrl(post.cover_image_url)
  const avatarUrl = useProtectedImageUrl(post.author?.profile_image_url)
  const initials = (post.author?.name || 'A').charAt(0).toUpperCase()
  const [expanded, setExpanded] = useState(false)

  const isLong = post.body.length > BODY_CLAMP
  const shownBody = expanded || !isLong ? post.body : `${post.body.slice(0, BODY_CLAMP).trimEnd()}…`

  // Deep-link to the author's directory profile when it's available (not for
  // disabled/missing profiles, where profile_id is null).
  const profileId = post.author?.profile_id
  const profileTo = profileId ? `/directory/alumni/${profileId}` : null

  return (
    <article className="post-card">
      {/* Author header: avatar + name + location/headline */}
      <div className="post-card__head">
        {profileTo ? (
          <Link to={profileTo} className="post-card__avatar post-card__avatar--link" aria-label={`View ${post.author?.name}'s profile`}>
            {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
          </Link>
        ) : (
          <div className="post-card__avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
          </div>
        )}
        <div className="post-card__head-info">
          {profileTo ? (
            <Link to={profileTo} className="post-card__author-name post-card__author-name--link">
              {post.author?.name}
            </Link>
          ) : (
            <div className="post-card__author-name">{post.author?.name}</div>
          )}
          {post.author?.headline && (
            <div className="post-card__author-headline">{post.author.headline}</div>
          )}
          <div className="post-card__time">
            {timeAgo(post.created_at)}
            {post.is_hidden && <span className="post-card__hidden-flag"> · Hidden</span>}
          </div>
        </div>
        {post.can_moderate && (
          <div className="post-card__head-menu">
            <button onClick={onModerate} title={post.is_hidden ? 'Unhide' : 'Hide'}>
              {post.is_hidden ? 'Unhide' : 'Hide'}
            </button>
          </div>
        )}
      </div>

      {/* Title */}
      {post.title && <div className="post-card__title">{post.title}</div>}

      {/* Image */}
      {coverUrl && <img className="post-card__cover" src={coverUrl} alt="" />}

      {/* Hashtags */}
      {post.tags?.length > 0 && (
        <div className="post-card__tags">
          {post.tags.map((t) => (
            <span key={t} className="post-card__tag" onClick={() => onTagClick(t)}>#{t}</span>
          ))}
        </div>
      )}

      {/* Description */}
      <div className="post-card__text">
        {shownBody}
        {isLong && !expanded && (
          <>
            {' '}
            <button className="post-card__more" onClick={() => setExpanded(true)}>more</button>
          </>
        )}
      </div>

      {/* Likes summary */}
      {post.like_count > 0 && (
        <div className="post-card__stats">
          <div className="post-card__stats-likes">
            <span className="post-card__reaction-icon"><HiThumbUp /></span>
            <span>{post.like_count} {post.like_count === 1 ? 'Like' : 'Likes'}</span>
          </div>
        </div>
      )}

      {/* Action bar: Like + Share */}
      <div className="post-card__actions">
        <button
          className={`post-card__action${post.liked ? ' is-liked' : ''}`}
          onClick={onLike}
        >
          {post.liked ? <HiThumbUp /> : <HiOutlineThumbUp />}
          <span>Like</span>
        </button>
        <button className="post-card__action" onClick={onShare}>
          <HiOutlineShare />
          <span>Share</span>
        </button>
      </div>
    </article>
  )
}

function Composer({ onClose, onCreated, enqueueSnackbar }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleCover = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      enqueueSnackbar('Cover image must be 3MB or less.', { variant: 'error' })
      return
    }
    setCoverFile(file)
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const clearCover = () => {
    setCoverFile(null)
    setCoverPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return '' })
  }

  const handleSubmit = async () => {
    if (title.trim().length < 3) { enqueueSnackbar('Title must be at least 3 characters.', { variant: 'error' }); return }
    if (!body.trim()) { enqueueSnackbar('Write something before posting.', { variant: 'error' }); return }

    setSubmitting(true)
    try {
      let coverImageUrl = null
      if (coverFile) coverImageUrl = await uploadPostCover(coverFile)

      const tags = tagsInput
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#+/, '').trim())
        .filter(Boolean)

      const post = await createPost({ title: title.trim(), body: body.trim(), coverImageUrl, tags })
      onCreated(post)
    } catch (err) {
      enqueueSnackbar(err.message || 'Could not publish post.', { variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="composer-overlay" onClick={onClose}>
      <div className="composer" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Write a blog</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><HiX size={20} /></button>
        </div>

        <label>Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="An engaging title" />

        <label>Your story</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} placeholder="Share your experience, advice, or milestone…" />

        <label>Tags (comma separated, up to 5)</label>
        <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="career, tech, internship" />
        <div className="composer__hint">e.g. #career #placement — letters, numbers, hyphens only.</div>

        <label>Cover image (optional)</label>
        {coverPreview ? (
          <div className="composer__cover">
            <img className="composer__cover-preview" src={coverPreview} alt="cover preview" />
            <button type="button" className="composer__cover-remove" onClick={clearCover} aria-label="Remove cover image">
              <HiX />
            </button>
            <label className="composer__cover-change">
              Change
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCover} hidden />
            </label>
          </div>
        ) : (
          <label className="composer__dropzone">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCover} hidden />
            <span className="composer__dropzone-icon"><HiOutlinePhotograph /></span>
            <span className="composer__dropzone-text">
              <strong>Click to upload</strong> a cover image
            </span>
            <span className="composer__dropzone-hint">JPG, PNG or WEBP · up to 3MB</span>
          </label>
        )}

        <div className="composer__actions">
          <button className="composer__cancel" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="composer__submit" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Blogs

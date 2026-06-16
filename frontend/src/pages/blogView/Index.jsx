import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { HiThumbUp, HiArrowLeft } from 'react-icons/hi'
import { fetchPublicPost } from '../../lib/postsApi'
import { useProtectedImageUrl } from '../../hooks/useProtectedImageUrl'
import { getUser, onAuthChange } from '../../lib/auth'
import '../blogs/Index.css'
import './Index.css'

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

// Public, no-login view of a single shared blog.
function BlogView() {
  const { id } = useParams()
  const [post, setPost] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | notfound | error
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(getUser()))

  useEffect(() => {
    let mounted = true
    fetchPublicPost(id)
      .then((p) => { if (mounted) { setPost(p); setState('ready') } })
      .catch((err) => {
        if (!mounted) return
        setState(err?.status === 404 ? 'notfound' : 'error')
      })
    return () => { mounted = false }
  }, [id])

  useEffect(() => onAuthChange((user) => setIsLoggedIn(Boolean(user))), [])

  return (
    <div className="blogview-page page-content">
      <div className="blogview-inner">
        <Link to={isLoggedIn ? '/blogs' : '/'} className="blogview-back">
          <HiArrowLeft /> {isLoggedIn ? 'Back to Blogs' : 'Home'}
        </Link>

        {state === 'loading' && <div className="blogs-loading">Loading…</div>}
        {state === 'notfound' && (
          <div className="blogs-empty">This blog is no longer available.</div>
        )}
        {state === 'error' && (
          <div className="blogs-empty">Something went wrong. Please try again.</div>
        )}

        {state === 'ready' && post && <PublicPostCard post={post} />}

        {state === 'ready' && !isLoggedIn && (
          <div className="blogview-cta">
            <p>Want to read more stories from SMVEC alumni?</p>
            <Link to="/login" className="blogview-cta-btn">Join the Alumni Network</Link>
          </div>
        )}
      </div>
    </div>
  )
}

function PublicPostCard({ post }) {
  const coverUrl = useProtectedImageUrl(post.cover_image_url)
  const avatarUrl = useProtectedImageUrl(post.author?.profile_image_url)
  const initials = (post.author?.name || 'A').charAt(0).toUpperCase()

  return (
    <article className="post-card">
      <div className="post-card__head">
        <div className="post-card__avatar">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
        </div>
        <div className="post-card__head-info">
          <div className="post-card__author-name">{post.author?.name}</div>
          {post.author?.headline && (
            <div className="post-card__author-headline">{post.author.headline}</div>
          )}
          <div className="post-card__time">{timeAgo(post.created_at)}</div>
        </div>
      </div>

      {post.title && <div className="post-card__title">{post.title}</div>}
      {coverUrl && <img className="post-card__cover" src={coverUrl} alt="" />}

      {post.tags?.length > 0 && (
        <div className="post-card__tags">
          {post.tags.map((t) => (
            <span key={t} className="post-card__tag">#{t}</span>
          ))}
        </div>
      )}

      <div className="post-card__text">{post.body}</div>

      {post.like_count > 0 && (
        <div className="post-card__stats">
          <div className="post-card__stats-likes">
            <span className="post-card__reaction-icon"><HiThumbUp /></span>
            <span>{post.like_count} {post.like_count === 1 ? 'Like' : 'Likes'}</span>
          </div>
        </div>
      )}
    </article>
  )
}

export default BlogView

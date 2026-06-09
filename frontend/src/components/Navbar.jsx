import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HiMenu, HiX, HiHome, HiUsers, HiClipboardList, HiMail, HiSearch, HiUserCircle, HiPencilAlt, HiBell, HiGift } from 'react-icons/hi'
import { getUser, onAuthChange, logout as authLogout } from '../lib/auth'
import { isStudentRegistered } from '../lib/studentRegistration'
import { fetchUnreadCount } from '../lib/notificationsApi'
import MobileSidebarMenu from './MobileSidebarMenu'
import NotificationDropdown from './notifications/NotificationDropdown'
import { safeLocalStorageGet, safeLocalStorageSet } from '../lib/safeStorage'
import { useMyProfile } from '../hooks/useMyProfile'

const UNREAD_POLL_MS = 60000

// Shared unread-count source. Polls the backend, re-checks on route change, and
// listens for `notifications:changed` so reads anywhere in the app reflect
// immediately. Returns 0 when logged out.
function useUnreadCount(enabled) {
  const [count, setCount] = useState(0)
  const location = useLocation()

  useEffect(() => {
    if (!enabled) return undefined
    let mounted = true
    const refresh = async () => {
      try {
        const n = await fetchUnreadCount()
        if (mounted) setCount(n)
      } catch {
        /* ignore — badge is best-effort */
      }
    }
    refresh()
    const interval = setInterval(refresh, UNREAD_POLL_MS)
    const onChanged = () => refresh()
    window.addEventListener('notifications:changed', onChanged)
    return () => {
      mounted = false
      clearInterval(interval)
      window.removeEventListener('notifications:changed', onChanged)
    }
  }, [enabled])

  // Re-check whenever the route changes (e.g. leaving the notifications page).
  useEffect(() => {
    if (!enabled) return
    fetchUnreadCount().then(setCount).catch(() => {})
  }, [location.pathname, enabled])

  // Derive 0 when logged out rather than syncing state inside the effect.
  return enabled ? count : 0
}

// Bell icon + unread badge. Clicking it opens the notification dropdown panel.
function NotificationBell({ count }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="navbar-bell-wrap">
      <button
        type="button"
        className={`navbar-bell${open ? ' is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <HiBell />
        {count > 0 && <span className="navbar-bell-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  )
}

const REG_STATUS_CACHE_PREFIX = 'smvec_reg_status_'

function getCachedRegistrationStatus(userId) {
  if (!userId) return null
  try {
    const raw = safeLocalStorageGet(`${REG_STATUS_CACHE_PREFIX}${userId}`)
    if (raw === '1') return true
    if (raw === '0') return false
    return null
  } catch {
    return null
  }
}

function setCachedRegistrationStatus(userId, registered) {
  if (!userId) return
  safeLocalStorageSet(`${REG_STATUS_CACHE_PREFIX}${userId}`, registered ? '1' : '0')
}

function hasReadableName(value) {
  return /[a-zA-Z]/.test(String(value || ''))
}

function UserProfileDropdown({
  user,
  isStaff,
  profilePath,
  profileImageUrl,
  profileName,
  batchLabel,
  triggerClassName,
  onLogout,
  loggingOut,
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className={`navbar-user-menu${open ? ' is-open' : ''}`} ref={menuRef}>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setOpen((current) => !current)}
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {profileImageUrl ? (
          <img src={profileImageUrl} alt="Profile" />
        ) : (
          <span>{profileName?.charAt(0)?.toUpperCase() || 'A'}</span>
        )}
      </button>

      <div className="navbar-user-dropdown" role="menu">
        <div className="navbar-profile-card">
          <Link to={profilePath} className="navbar-profile-avatar" aria-label="View profile" onClick={() => setOpen(false)}>
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="Profile" />
            ) : (
              <span>{profileName?.charAt(0)?.toUpperCase() || 'A'}</span>
            )}
          </Link>
          <div className="navbar-profile-copy">
            <strong>{profileName}</strong>
            <span>{isStaff ? 'Staff' : batchLabel}</span>
          </div>
        </div>

        <div className="navbar-profile-actions">
          <Link to={profilePath} className="navbar-profile-view-btn" onClick={() => setOpen(false)}>
            View profile
          </Link>
        </div>

        <div className="navbar-dropdown-section">
          <p>Account</p>
          <Link to="/settings-privacy" className="navbar-dropdown-link" onClick={() => setOpen(false)}>
            Settings & Privacy
          </Link>
          <Link to="/contact" className="navbar-dropdown-link" onClick={() => setOpen(false)}>
            Help
          </Link>
        </div>

        <div className="navbar-dropdown-section navbar-dropdown-section--last">
          {user && (
            <button
              type="button"
              className="navbar-dropdown-link navbar-dropdown-link--danger"
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              disabled={loggingOut}
            >
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Navbar({
  variant = 'default',
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search people, skills, companies...',
  mobileFilterNav = null,
  loading = false,
}) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState(() => getUser())
  const [loggingOut, setLoggingOut] = useState(false)
  const [isRegisteredAlumni, setIsRegisteredAlumni] = useState(() => getCachedRegistrationStatus(getUser()?.id))
  const [scrolled, setScrolled] = useState(false)
  const [navHidden, setNavHidden] = useState(false)
  const lastScrollY = useRef(0)
  const location = useLocation()
  // Global profile source — name + resolved avatar, shared with every page.
  const { alumni: profileInfo, name: profileNameFromHook, profileImageUrl: resolvedProfileImageUrl } = useMyProfile()
  const isDirectoryVariant = variant === 'directory'
  const unreadCount = useUnreadCount(Boolean(user))

  const isActive = (path) => path === '/directory'
    ? location.pathname.startsWith('/directory')
    : location.pathname === path
  const isLoginPage = location.pathname === '/login'
  const usesSolidNavbar =
    location.pathname === '/settings-privacy' ||
    location.pathname.startsWith('/alumni-space') ||
    location.pathname === '/contact' ||
    location.pathname === '/blogs' ||
    location.pathname === '/contribute' ||
    location.pathname === '/notifications'

  const isStaff = user?.role === 'staff'
  const profilePath = isStaff ? '/directory' : '/alumni-space'
  const profileName = profileNameFromHook || (hasReadableName(user?.name) ? user.name : 'Alumni SMVEC')
  const batchLabel = profileInfo?.year_of_completion
    ? `Batch ${profileInfo.year_of_completion}`
    : 'Batch not added'

  const baseLinks = [
    { path: '/', label: 'Home', icon: <HiHome /> },
    { path: '/directory', label: 'Explore Alumni', icon: <HiUsers /> },
    { path: '/contact', label: 'Contact Us', icon: <HiMail /> },
  ]

  const navLinks = (() => {
    if (!user) return baseLinks
    if (isStaff) {
      return [
        { path: '/', label: 'Home', icon: <HiHome /> },
        { path: '/directory', label: 'Explore Alumni', icon: <HiUsers /> },
        { path: '/blogs', label: 'Blogs', icon: <HiPencilAlt /> },
        { path: '/contribute', label: 'Contribute', icon: <HiGift /> },
        { path: '/contact', label: 'Contact Us', icon: <HiMail /> },
      ]
    }
    const alumniEntry = isRegisteredAlumni === null
      ? null
      : {
        path: isRegisteredAlumni ? '/alumni-space' : '/complete-profile',
        label: isRegisteredAlumni ? 'My Profile' : 'Alumni Registration',
        icon: isRegisteredAlumni ? <HiUserCircle /> : <HiClipboardList />,
      }
    return [
      { path: '/', label: 'Home', icon: <HiHome /> },
      { path: '/directory', label: 'Explore Alumni', icon: <HiUsers /> },
      { path: '/blogs', label: 'Blogs', icon: <HiPencilAlt /> },
      { path: '/contribute', label: 'Contribute', icon: <HiGift /> },
      ...(alumniEntry ? [alumniEntry] : []),
      { path: '/contact', label: 'Contact Us', icon: <HiMail /> },
    ]
  })()

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY
      const prev = lastScrollY.current

      setScrolled(currentY > 50)

      if (currentY < 50) {
        setNavHidden(false)
      } else if (currentY > prev) {
        setNavHidden(true)
      } else if (currentY < prev) {
        setNavHidden(false)
      }

      lastScrollY.current = currentY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Listen for auth changes
  useEffect(() => {
    const unsubscribe = onAuthChange((newUser) => {
      setUser(newUser)
    })
    return () => unsubscribe()
  }, [])

  // Check registration status. Re-runs on user/route change and whenever a
  // `registration:changed` event fires (the completion form dispatches this on a
  // successful submit) so the nav entry flips from "Alumni Registration" to "My
  // Profile" immediately, without waiting for a re-login or cache expiry.
  useEffect(() => {
    if (!user || isStaff) {
      setIsRegisteredAlumni(null)
      return undefined
    }

    let mounted = true
    const cached = getCachedRegistrationStatus(user.id)
    setIsRegisteredAlumni(cached !== null ? cached : null)

    const run = async () => {
      const { registered } = await isStudentRegistered(user)
      if (!mounted) return
      const next = Boolean(registered)
      setIsRegisteredAlumni(next)
      setCachedRegistrationStatus(user.id, next)
    }
    run()

    const onRegistrationChanged = () => run()
    window.addEventListener('registration:changed', onRegistrationChanged)
    return () => {
      mounted = false
      window.removeEventListener('registration:changed', onRegistrationChanged)
    }
  }, [user, isStaff, location.pathname])

  // Profile name + avatar now come from the shared useMyProfile() hook above.

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [menuOpen])

  const handleLogout = async () => {
    try {
      setLoggingOut(true)
      await authLogout()
      setMenuOpen(false)
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  if (isDirectoryVariant) {
    return (
      <>
        <header className="dir-sticky-header">
          <div className="dir-header-inner">
            <div className="dir-header-left">
              <Link to="/" className="dir-header-logo" aria-label="Go to home">
                <img src="/logo.png" alt="MVIT Alumni" />
              </Link>

              {loading ? (
                <div className="dir-search-box alumni-detail-skeleton-search" aria-hidden="true">
                  <span className="profile-skeleton-line profile-skeleton-line--search" />
                </div>
              ) : (
                <div className="dir-search-box">
                  <HiSearch className="dir-search-icon" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchValue}
                    onChange={(event) => onSearchChange?.(event.target.value)}
                    aria-label="Search alumni directory"
                  />
                </div>
              )}

              <button
                className="dir-mobile-menu-btn"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                aria-controls="mobile-sidebar-menu"
              >
                <HiMenu />
              </button>
            </div>

            <div className="dir-header-controls">
              <nav className="dir-top-nav" aria-label="Directory quick navigation">
                {loading ? (
                  <>
                    <span className="profile-skeleton-pill" />
                    <span className="profile-skeleton-pill profile-skeleton-pill--wide" />
                    <span className="profile-skeleton-pill" />
                  </>
                ) : (
                  navLinks.map((item) => (
                    <Link
                      key={`${item.label}-${item.path}`}
                      to={item.path}
                      className={`dir-top-link${isActive(item.path) ? ' active' : ''}`}
                    >
                      {item.label}
                    </Link>
                  ))
                )}
              </nav>

              {loading ? (
                <span className="profile-skeleton-avatar profile-skeleton-avatar--nav" aria-hidden="true" />
              ) : (
                <>
                  {user && <NotificationBell count={unreadCount} />}
                  <UserProfileDropdown
                    user={user}
                    isStaff={isStaff}
                    profilePath={profilePath}
                    profileImageUrl={resolvedProfileImageUrl}
                    profileName={profileName}
                    batchLabel={batchLabel}
                    triggerClassName="dir-header-avatar"
                    onLogout={handleLogout}
                    loggingOut={loggingOut}
                  />
                </>
              )}
            </div>
          </div>

          {mobileFilterNav}
        </header>

        <MobileSidebarMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          user={user}
          profileImageUrl={resolvedProfileImageUrl}
          isStaff={isStaff}
          profileName={profileName}
          navLinks={navLinks}
          isActive={isActive}
          onLogout={handleLogout}
          loggingOut={loggingOut}
          profilePath={isStaff ? '/directory' : '/alumni-space'}
          logoSrc="/img/logo/mvit-logo-darkk.png"
          unreadCount={unreadCount}
        />
      </>
    )
  }

  return (
    <>
      <nav className={`navbar${(scrolled || usesSolidNavbar) && !isLoginPage ? ' navbar--scrolled' : ''}${isLoginPage ? ' navbar--login' : ''}${navHidden ? ' navbar--hidden' : ''}`}>
        <div className="containerr navbar-inner">
          <Link to="/" className="navbar-logo">
            {isLoginPage ? (
              <picture>
                <source media="(min-width: 681px)" srcSet="/img/logo/mvit-logo-darkk.png" />
                <img
                  src="/img/logo/mvit-logo-light.png"
                  alt="MVIT Alumni"
                  className="navbar-logo-img"
                />
              </picture>
            ) : (
              <img
                src={(scrolled || usesSolidNavbar) ? '/img/logo/mvit-logo-light.png' : '/img/logo/mvit-logo-darkk.png'}
                alt="MVIT Alumni"
                className="navbar-logo-img"
              />
            )}
          </Link>

          <button
            className="navbar-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-sidebar-menu"
          >
            {menuOpen ? <HiX /> : <HiMenu />}
          </button>

          <div className="navbar-menu navbar-menu--desktop">
            <ul className="navbar-links">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className={isActive(link.path) ? 'active' : ''}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="navbar-actions">
              {user ? (
                <>
                  <NotificationBell count={unreadCount} />
                  <UserProfileDropdown
                    user={user}
                    isStaff={isStaff}
                    profilePath={profilePath}
                    profileImageUrl={resolvedProfileImageUrl}
                    profileName={profileName}
                    batchLabel={batchLabel}
                    triggerClassName="navbar-user-avatar"
                    onLogout={handleLogout}
                    loggingOut={loggingOut}
                  />
                </>
              ) : (
                <Link to="/login" className="btn btn-outline">
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <MobileSidebarMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        profileImageUrl={resolvedProfileImageUrl}
        isStaff={isStaff}
        profileName={profileName}
        navLinks={navLinks}
        isActive={isActive}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        profilePath={isStaff ? '/directory' : '/alumni-space'}
        logoSrc="/img/logo/mvit-logo-darkk.png"
      />
    </>
  )
}

export default Navbar

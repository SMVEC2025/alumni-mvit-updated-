import { Link } from 'react-router-dom'
import { HiLogout, HiX, HiBell } from 'react-icons/hi'

function MobileSidebarMenu({
  open,
  onClose,
  user,
  profileImageUrl,
  isStaff,
  profileName,
  navLinks,
  isActive,
  onLogout,
  loggingOut = false,
  profilePath = '/alumni-space',
  logoSrc = '/img/logo/mvit-logo-darkk.png',
  unreadCount = 0,
}) {
  return (
    <>
      <div
        className={`sidebar-overlay${open ? ' active' : ''}`}
        onClick={onClose}
      />

      <aside
        id="mobile-sidebar-menu"
        className={`sidebar-mobile${open ? ' open' : ''}`}
        aria-hidden={!open}
      >
        <div className="sidebar-mobile__header">
          <Link to="/" className="sidebar-mobile__logo" onClick={onClose}>
            <img src={logoSrc} alt="MVIT Alumni" />
          </Link>
          <button className="sidebar-mobile__close" onClick={onClose} aria-label="Close menu">
            <HiX />
          </button>
        </div>

        {user && (
          <Link to={profilePath} className="sidebar-mobile__profile" onClick={onClose}>
            <div className="sidebar-mobile__avatar">
              {profileImageUrl ? (
                <img src={profileImageUrl} alt="Profile" />
              ) : (
                <span>{profileName?.charAt(0)?.toUpperCase() || 'A'}</span>
              )}
            </div>
            <div className="sidebar-mobile__profile-info">
              <span className="sidebar-mobile__profile-role">{isStaff ? 'Staff' : 'Alumni'}</span>
            </div>
          </Link>
        )}

        <nav className="sidebar-mobile__nav">
          <ul>
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={`sidebar-mobile__link${isActive(link.path) ? ' active' : ''}`}
                  onClick={onClose}
                >
                  <span className="sidebar-mobile__link-icon">{link.icon}</span>
                  <span className="sidebar-mobile__link-label">{link.label}</span>
                </Link>
              </li>
            ))}
            {user && (
              <li>
                <Link
                  to="/notifications"
                  className={`sidebar-mobile__link${isActive('/notifications') ? ' active' : ''}`}
                  onClick={onClose}
                >
                  <span className="sidebar-mobile__link-icon"><HiBell /></span>
                  <span className="sidebar-mobile__link-label">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="sidebar-mobile__link-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="sidebar-mobile__footer">
          {user ? (
            <button
              className="sidebar-mobile__logout"
              onClick={onLogout}
              disabled={loggingOut}
            >
              <HiLogout />
              <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          ) : (
            <Link to="/login" className="sidebar-mobile__login" onClick={onClose}>
              Login
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}

export default MobileSidebarMenu

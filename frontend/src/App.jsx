import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import CustomToast from './components/CustomToast'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Preloader from './components/Preloader'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/home/Index'
import About from './pages/about/Index'
import Login from './pages/login/Index'
import CompleteProfile from './pages/completeProfile/Index'
import AlumniSpace from './pages/alumniSpace/Index'
import Directory from './pages/directory/Index'
import AlumniDetail from './pages/alumniDetail/Index'
import Blogs from './pages/blogs/Index'
import BlogView from './pages/blogView/Index'
import Contribute from './pages/contribute/Index'
import Notifications from './pages/notifications/Index'
import Contact from './pages/contact/Index'
import SettingsPrivacy from './pages/settingsPrivacy/Index'
import AdminMessages from './pages/adminMessages/Index'
import FacultyRegistration from './pages/facultyRegistration/Index'
import { onAuthChange, verifySession } from './lib/auth'
import { isStudentRegistered } from './lib/studentRegistration'
import { safeSessionStorageGet } from './lib/safeStorage'
import { DirectoryCacheProvider } from './context/DirectoryCacheContext'
import { NavbarProvider } from './context/NavbarProvider'
import { useNavbarContext } from './context/navbarState'
import { useInactivityLogout } from './hooks/useInactivityLogout'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000

function App() {
  return (
    <NavbarProvider>
      <AppContent />
    </NavbarProvider>
  )
}

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationType = useNavigationType()
  const isDirectoryDetailPath = location.pathname.startsWith('/directory/alumni/')
  const isDirectoryNavPath = location.pathname === '/directory' || isDirectoryDetailPath
  const { directoryNavbar } = useNavbarContext()
  const [user, setUser] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [isRegistered, setIsRegistered] = useState(null)
  const hasRecentRegistrationSuccess = () => safeSessionStorageGet('reg_success') === '1'

  useInactivityLogout(user, {
    navigate,
    timeoutMs: INACTIVITY_TIMEOUT_MS,
  })

  useEffect(() => {
    let mounted = true

    const hydrate = async () => {
      const verifiedUser = await verifySession()
      if (!mounted) return
      setUser(verifiedUser)
      setSessionChecked(true)
    }

    hydrate()

    const unsubscribe = onAuthChange((nextUser) => {
      if (!mounted) return
      setUser(nextUser)
      setIsRegistered(null)
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) return

    let mounted = true

    const checkRegistration = async () => {
      if (user.role === 'staff') {
        if (mounted) setIsRegistered(true)
        return
      }

      const { registered } = await isStudentRegistered(user)
      if (mounted) setIsRegistered(registered)
    }

    checkRegistration()
    return () => { mounted = false }
  }, [user])

  useEffect(() => {
    if (!user || user.role === 'staff' || isRegistered === true) return

    if (hasRecentRegistrationSuccess()) {
      const id = window.setTimeout(() => setIsRegistered(true), 0)
      return () => window.clearTimeout(id)
    }

    return undefined
  }, [user, isRegistered, location.pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'auto'
    }

    if (navigationType === 'POP') return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, navigationType])

  useEffect(() => {
    if (!sessionChecked || user) return

    const protectedPaths = ['/register', '/complete-profile', '/alumni-space', '/directory', '/settings-privacy']
    const isAlumniDetailPath = location.pathname.startsWith('/directory/alumni/')
    if (protectedPaths.includes(location.pathname) || isAlumniDetailPath) {
      navigate('/login', { replace: true })
    }
  }, [sessionChecked, user, location.pathname, navigate])

  useEffect(() => {
    if (!user || user.role !== 'staff') return

    if (location.pathname === '/register' || location.pathname === '/alumni-space') {
      navigate('/directory', { replace: true })
    }
  }, [user, location.pathname, navigate])

  useEffect(() => {
    if (!user || user.role === 'staff') return

    const isAlumniDetailPath = location.pathname.startsWith('/directory/alumni/')
    if ((location.pathname === '/directory' || isAlumniDetailPath) && isRegistered === false && !hasRecentRegistrationSuccess()) {
      navigate('/complete-profile', { replace: true })
    }
  }, [user, isRegistered, location.pathname, navigate])

  useEffect(() => {
    if (!user || user.role === 'staff') return

    // The old multi-step /register page is retired; the single completion form
    // at /complete-profile is the only registration screen now. Bounce anyone
    // who lands on /register (or finished registering) to the right place.
    if (location.pathname === '/register') {
      const done = isRegistered === true || hasRecentRegistrationSuccess()
      navigate(done ? '/alumni-space' : '/complete-profile', { replace: true })
    }
  }, [user, isRegistered, location.pathname, navigate])

  useEffect(() => {
    if (!user || user.role === 'staff' || isRegistered !== false) return

    if (location.pathname === '/alumni-space' && !hasRecentRegistrationSuccess()) {
      navigate('/complete-profile', { replace: true })
    }
  }, [user, isRegistered, location.pathname, navigate])

  // Keep unregistered alumni on the completion form — they can't navigate away
  // until they finish. (Mirrors the old /register lock, now on /complete-profile.)
  useEffect(() => {
    if (!user || user.role === 'staff' || isRegistered !== false) return
    if (location.pathname === '/complete-profile') return
    if (hasRecentRegistrationSuccess()) return

    const lockedFor = ['/directory', '/alumni-space', '/settings-privacy']
    const isAlumniDetailPath = location.pathname.startsWith('/directory/alumni/')
    if (lockedFor.includes(location.pathname) || isAlumniDetailPath) {
      navigate('/complete-profile', { replace: true })
    }
  }, [user, isRegistered, location.pathname, navigate])

  useEffect(() => {
    if (!user || location.pathname !== '/login') return

    if (user.role === 'staff') {
      navigate('/directory', { replace: true })
      return
    }

    if (isRegistered === true) {
      navigate('/alumni-space', { replace: true })
      return
    }

    if (isRegistered === false) {
      navigate('/complete-profile', { replace: true })
    }
  }, [user, isRegistered, location.pathname, navigate])

  return (
    <div>
      <Preloader />
      <SnackbarProvider
        maxSnack={4}
        autoHideDuration={4200}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        preventDuplicate
        Components={{
          success: CustomToast,
          error: CustomToast,
        }}
      >
        <DirectoryCacheProvider>
          <Navbar
            variant={isDirectoryNavPath ? 'directory' : 'default'}
            {...(isDirectoryNavPath ? directoryNavbar : {})}
          />
          <main className="app-main">
            {/* Keyed by path so navigating to another route clears a crashed
                page's error state and lets the new page mount cleanly. */}
            <ErrorBoundary key={location.pathname}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/login" element={<Login />} />
              {/* Old multi-step page retired — the single completion form is canonical. */}
              <Route path="/register" element={<Navigate to="/complete-profile" replace />} />
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/alumni-space" element={<AlumniSpace />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/directory/alumni/:id" element={<AlumniDetail />} />
              <Route path="/blogs" element={<Blogs />} />
              <Route path="/blog/:id" element={<BlogView />} />
              <Route path="/contribute" element={<Contribute />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/settings-privacy" element={<SettingsPrivacy />} />
              <Route path="/admin/messages" element={<AdminMessages />} />
              <Route path="/faculty-register" element={<FacultyRegistration />} />
            </Routes>
            </ErrorBoundary>
            <Footer />
          </main>
        </DirectoryCacheProvider>
      </SnackbarProvider>
    </div>
  )
}

export default App

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HiShieldCheck,
  HiSupport,
  HiEye,
  HiKey,
  HiLogout,
  HiClock,
  HiMail,
  HiExclamationCircle,
  HiDesktopComputer,
  HiDeviceMobile,
  HiPhone,
  HiLockClosed,
  HiUpload,
  HiTrash,
  HiUser,
} from 'react-icons/hi'
import { useSnackbar } from 'notistack'
import { changePassword, listSessions, logout, logoutAllDevices, revokeSession, verifySession } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { getMyRegistration, updateAlumni } from '../../lib/alumniApi'
import { useProtectedImageUrl } from '../../hooks/useProtectedImageUrl'
import { createStableUploadFile, uploadAlumniImage } from '../../lib/imageUpload'

const MAX_PROFILE_IMAGE_SIZE = 3 * 1024 * 1024

const ALUMNI_CELL_EMAIL = 'alumnicoordinator@smvec.ac.in'

const SETTINGS_SECTIONS = ['profile-photo', 'profile-visibility', 'account-security', 'help-support']

function SettingsPrivacy() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [staffName, setStaffName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [activeSection, setActiveSection] = useState('profile-photo')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const profileImageInputRef = useRef(null)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const profileName = useMemo(() => {
    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    return fullName || staffName || user?.mobile_number || 'Alumni SMVEC'
  }, [profile, staffName, user])

  const hasProfile = Boolean(profile?.id)
  const currentSession = sessions.find((session) => session.is_current) || null
  const otherSessions = sessions.filter((session) => !session.is_current)
  const isStaff = user?.role === 'staff'
  const requiresCurrentPassword = Boolean(user?.has_password)
  const accountInitial = profileName.trim().charAt(0).toUpperCase() || 'A'
  const resolvedAvatarUrl = useProtectedImageUrl(profile?.profile_image_url || '')
  const mobileLabel = user?.mobile_number ? `+91 ${user.mobile_number}` : 'Mobile not available'
  useEffect(() => {
    let mounted = true

    const load = async () => {
      const verifiedUser = await verifySession()
      if (!mounted) return

      if (!verifiedUser) {
        navigate('/login', { replace: true })
        return
      }

      setUser(verifiedUser)

      if (!isSupabaseConfigured) {
        setLoading(false)
        return
      }

      if (verifiedUser.role === 'staff') {
        if (!mounted) return
        setStaffName(verifiedUser.mobile_number ? 'Staff' : '')
        setLoading(false)
        return
      }

      try {
        const { alumni } = await getMyRegistration()
        if (!mounted) return
        setProfile(alumni || null)
      } catch (error) {
        if (mounted) enqueueSnackbar(error.message || 'Unable to load settings.', { variant: 'error' })
      }
      if (mounted) setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [enqueueSnackbar, navigate])

  useEffect(() => {
    if (loading) return undefined

    const elements = SETTINGS_SECTIONS
      .map((id) => document.getElementById(id))
      .filter(Boolean)
    if (elements.length === 0) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActiveSection(visible.target.id)
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [loading])

  useEffect(() => {
    let mounted = true

    const loadSessions = async () => {
      try {
        const data = await listSessions()
        if (!mounted) return
        setSessions(Array.isArray(data?.sessions) ? data.sessions : [])
      } catch (error) {
        if (mounted) {
          enqueueSnackbar(error.message || 'Unable to load active devices.', { variant: 'error' })
        }
      } finally {
        if (mounted) setSessionsLoading(false)
      }
    }

    loadSessions()
    return () => { mounted = false }
  }, [enqueueSnackbar])

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    if (passwordForm.newPassword.length < 8) {
      enqueueSnackbar('New password must be at least 8 characters.', { variant: 'error' })
      return
    }
    if (requiresCurrentPassword && !passwordForm.currentPassword) {
      enqueueSnackbar('Enter your current password to set a new one.', { variant: 'error' })
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      enqueueSnackbar('Passwords do not match.', { variant: 'error' })
      return
    }

    setSaving(true)
    try {
      const data = await changePassword(
        requiresCurrentPassword ? passwordForm.currentPassword : '',
        passwordForm.newPassword,
      )
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setUser((prev) => data?.user || (prev ? { ...prev, has_password: true } : prev))
      enqueueSnackbar('Password updated successfully.', { variant: 'success' })
    } catch (error) {
      enqueueSnackbar(error.message || 'Unable to update password.', { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleLogoutCurrent = async () => {
    setSaving(true)
    try {
      await logout()
    } catch (error) {
      // logout() already clears the local session even if the server call fails,
      // so we proceed to the login page regardless; surface the hiccup if any.
      enqueueSnackbar(error?.message || 'Logged out locally.', { variant: 'error' })
    } finally {
      setSaving(false)
      navigate('/login', { replace: true })
    }
  }

  const handleLogoutAll = async () => {
    setSaving(true)
    try {
      await logoutAllDevices()
      navigate('/login', { replace: true })
    } catch (error) {
      enqueueSnackbar(error.message || 'Unable to logout all devices.', { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleRevokeSession = async (sessionId) => {
    setSaving(true)
    try {
      const data = await revokeSession(sessionId)
      if (data?.revoked_current) {
        navigate('/login', { replace: true })
        return
      }
      setSessions((prev) => prev.filter((session) => session.id !== sessionId))
      enqueueSnackbar('Device logged out successfully.', { variant: 'success' })
    } catch (error) {
      enqueueSnackbar(error.message || 'Unable to logout selected device.', { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleProfileImageButtonClick = () => {
    profileImageInputRef.current?.click()
  }

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      enqueueSnackbar('Please upload a valid image file.', { variant: 'error' })
      return
    }
    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      enqueueSnackbar('Profile image must be 3MB or less.', { variant: 'error' })
      return
    }

    if (!profile?.id) {
      enqueueSnackbar('Unable to update profile photo right now.', { variant: 'error' })
      return
    }

    setUploadingPhoto(true)
    try {
      const stableFile = await createStableUploadFile(file)
      const uploadResult = await uploadAlumniImage(stableFile, 'profile')
      const persistedUrl = uploadResult?.publicUrl
      if (!persistedUrl) throw new Error('Could not resolve uploaded image URL.')

      await updateAlumni(profile.id, { profile_image_url: persistedUrl })

      setProfile((prev) => (prev ? { ...prev, profile_image_url: persistedUrl } : prev))
      enqueueSnackbar('Profile photo updated.', { variant: 'success' })
    } catch (err) {
      enqueueSnackbar(err.message || 'Could not update profile photo.', { variant: 'error' })
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleProfileImageRemove = async () => {
    if (!profile?.id) {
      enqueueSnackbar('Unable to remove profile photo right now.', { variant: 'error' })
      return
    }
    if (!profile.profile_image_url) return

    setUploadingPhoto(true)
    try {
      await updateAlumni(profile.id, { profile_image_url: null })

      setProfile((prev) => (prev ? { ...prev, profile_image_url: null } : prev))
      enqueueSnackbar('Profile photo removed.', { variant: 'success' })
    } catch (err) {
      enqueueSnackbar(err.message || 'Could not remove profile photo.', { variant: 'error' })
    } finally {
      setUploadingPhoto(false)
    }
  }

  const supportMail = (subject, body) => {
    const params = new URLSearchParams({
      subject,
      body: `${body}\n\nName: ${profileName}\nMobile: ${user?.mobile_number || ''}\nProfile ID: ${profile?.id || 'Not registered'}`,
    })
    window.location.href = `mailto:${ALUMNI_CELL_EMAIL}?${params.toString()}`
  }

  if (loading) {
    return (
      <div className="settings-page page-content">
        <div className="settings-shell">
          <div className="settings-loading">Loading settings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-page page-content">
      <div className="settings-shell">
        <div className="settings-workspace">
          <aside className="settings-sidebar">
            <div className="settings-sidebar-head">
              <div className="settings-avatar" aria-hidden="true">
                {resolvedAvatarUrl ? (
                  <img src={resolvedAvatarUrl} alt="" />
                ) : (
                  <span>{accountInitial}</span>
                )}
              </div>
              <div className="settings-sidebar-identity">
                <strong>{profileName}</strong>
                <small>{user?.role === 'staff' ? 'Staff account' : 'Alumni account'}</small>
              </div>
            </div>
            <nav className="settings-sidebar-nav" aria-label="Settings sections">
              {!isStaff && (
                <>
                  <a href="#profile-photo" className={activeSection === 'profile-photo' ? 'is-active' : undefined}><HiUser /> Profile</a>
                  <a href="#profile-visibility" className={activeSection === 'profile-visibility' ? 'is-active' : undefined}><HiEye /> Privacy</a>
                </>
              )}
              <a href="#account-security" className={activeSection === 'account-security' ? 'is-active' : undefined}><HiShieldCheck /> Security</a>
              <a href="#help-support" className={activeSection === 'help-support' ? 'is-active' : undefined}><HiSupport /> Support</a>
            </nav>
            <div className="settings-sidebar-meta">
              <span><HiPhone /> {mobileLabel}</span>
              <span><HiLockClosed /> {requiresCurrentPassword ? 'Password protected' : 'OTP login enabled'}</span>
            </div>
          </aside>

          <main className="settings-main">
            <div className="settings-main-head">
              <div>
                <h1>Settings</h1>
                <p>Manage privacy, password access, devices, and alumni support.</p>
              </div>
              {saving && (
                <span className="settings-saving" role="status" aria-live="polite">
                  Saving changes
                </span>
              )}
            </div>

            {!isStaff && (
            <section id="profile-photo" className="settings-panel">
              <div className="settings-panel-heading">
                <div>
                  <h2>Profile Picture</h2>
                  <p>This photo appears on your alumni profile and directory listing.</p>
                </div>
              </div>

              {!hasProfile && user?.role !== 'staff' ? (
                <div className="settings-note">
                  Complete alumni registration to upload a profile photo.
                </div>
              ) : (
                <div className="settings-photo-row">
                  <div className="settings-photo-preview" aria-hidden="true">
                    {resolvedAvatarUrl ? (
                      <img src={resolvedAvatarUrl} alt="" />
                    ) : (
                      <span>{accountInitial}</span>
                    )}
                  </div>
                  <div className="settings-photo-actions">
                    <div className="settings-photo-buttons">
                      <button
                        type="button"
                        className="settings-btn settings-btn--primary"
                        onClick={handleProfileImageButtonClick}
                        disabled={uploadingPhoto || !hasProfile}
                      >
                        <HiUpload /> {uploadingPhoto ? 'Uploading…' : 'Upload Image'}
                      </button>
                      <button
                        type="button"
                        className="settings-btn settings-btn--ghost"
                        onClick={handleProfileImageRemove}
                        disabled={uploadingPhoto || !profile?.profile_image_url}
                      >
                        <HiTrash /> Remove
                      </button>
                    </div>
                    <small className="settings-photo-hint">
                      We support PNGs, JPEGs and GIFs under 3MB.
                    </small>
                  </div>
                  <input
                    ref={profileImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleProfileImageChange}
                  />
                </div>
              )}
            </section>
            )}

            {!isStaff && (
            <section id="profile-visibility" className="settings-panel">
              <div className="settings-panel-heading">
                <div>
                  <h2>Profile Visibility</h2>
                  <p>How your contact information is shared.</p>
                </div>
              </div>

              <div className="settings-note">
                🔒 Your phone number and email address are private. They are never
                shown to other alumni in the directory — only you and the alumni
                office (staff) can see them.
              </div>
            </section>
            )}

            <section id="account-security" className="settings-panel">
              <div className="settings-panel-heading">
                <div>
                  <h2>Account Security</h2>
                  <p>Update your password and control active sessions.</p>
                </div>
              </div>

              <form
                className={`settings-password-form${requiresCurrentPassword ? '' : ' settings-password-form--new-only'}`}
                onSubmit={handlePasswordSubmit}
              >
                {requiresCurrentPassword && (
                  <label>
                    <span>Current password</span>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                      placeholder="Enter current password"
                      autoComplete="current-password"
                    />
                  </label>
                )}
                <label>
                  <span>New password</span>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  <span>Confirm new password</span>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                </label>
                <button type="submit" disabled={saving}>
                  <HiKey /> Change password
                </button>
              </form>

              <div className="settings-action-list">
                <div className="settings-session-info">
                  <HiClock />
                  <span>
                    <strong>Session timeout info</strong>
                    <small>You are automatically logged out after 30 minutes of inactivity. Backend sessions expire after 30 days.</small>
                  </span>
                </div>
              </div>

              <div className="settings-devices">
                <div className="settings-devices-header">
                  <strong>Logged in devices</strong>
                  <small>Select a device and sign it out individually.</small>
                </div>

                {sessionsLoading ? (
                  <div className="settings-note">Loading active devices...</div>
                ) : (
                  <>
                    {currentSession && (
                      <SessionCard
                        session={currentSession}
                        isCurrent
                        disabled={saving}
                        onLogout={() => handleRevokeSession(currentSession.id)}
                      />
                    )}
                    {otherSessions.length > 0 ? (
                      otherSessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          disabled={saving}
                          onLogout={() => handleRevokeSession(session.id)}
                        />
                      ))
                    ) : (
                      <div className="settings-note settings-note--soft">
                        No other active devices found.
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="settings-action-list">
                <button type="button" onClick={handleLogoutCurrent} disabled={saving}>
                  <HiLogout />
                  <span>
                    <strong>Logout from current device</strong>
                    <small>End only this browser session immediately.</small>
                  </span>
                </button>
                <button type="button" onClick={handleLogoutAll} disabled={saving}>
                  <HiLogout />
                  <span>
                    <strong>Logout from all devices</strong>
                    <small>End every active MVIT Alumni session at once.</small>
                  </span>
                </button>
              </div>
            </section>

            <section id="help-support" className="settings-panel">
              <div className="settings-panel-heading">
                <div>
                  <h2>Help & Support</h2>
                  <p>Get help with incorrect records, official contact, and policy documents.</p>
                </div>
              </div>

              <div className="settings-action-list">
                <button
                  type="button"
                  onClick={() => supportMail('Incorrect alumni information report', 'I found incorrect information in the alumni directory:')}
                >
                  <HiExclamationCircle />
                  <span>
                    <strong>Report incorrect information</strong>
                    <small>Notify the team about a wrong or outdated profile.</small>
                  </span>
                </button>
                <a href={`mailto:${ALUMNI_CELL_EMAIL}`}>
                  <HiMail />
                  <span>
                    <strong>Contact alumni cell</strong>
                    <small>{ALUMNI_CELL_EMAIL}</small>
                  </span>
                </a>
              </div>

              <div className="settings-docs">
                <article>
                  <h3>Privacy policy</h3>
                  <p>MVIT Alumni uses your profile information to maintain the alumni directory, enable verified community access, and support official alumni communication.</p>
                  <p>Contact details are shown based on your visibility preferences and directory access rules.</p>
                </article>
                <article>
                  <h3>Terms of use</h3>
                  <p>Use the directory respectfully, keep your profile accurate, and do not misuse alumni contact information for spam, scraping, or unrelated solicitation.</p>
                  <p>Staff may moderate records to protect data quality and community trust.</p>
                </article>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

function SessionCard({ session, isCurrent = false, disabled, onLogout }) {
  const isMobile = /iphone|ipad|android/i.test(String(session?.platform || ''))
  const Icon = isMobile ? HiDeviceMobile : HiDesktopComputer
  const lastSeenLabel = formatSessionTime(session?.last_seen_at || session?.created_at)

  return (
    <div className={`settings-session-card${isCurrent ? ' is-current' : ''}`}>
      <div className="settings-session-icon">
        <Icon />
      </div>
      <div className="settings-session-copy">
        <div className="settings-session-title-row">
          <strong>{session?.device_name || 'Unknown device'}</strong>
          {isCurrent && <span>Current device</span>}
        </div>
        <small>Last active {lastSeenLabel}</small>
      </div>
      <button type="button" onClick={onLogout} disabled={disabled}>
        Logout
      </button>
    </div>
  )
}

function formatSessionTime(value) {
  if (!value) return 'recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default SettingsPrivacy

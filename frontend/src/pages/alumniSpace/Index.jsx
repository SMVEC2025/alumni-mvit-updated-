import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HiBell, HiCheckCircle, HiExclamationCircle, HiUser, HiAcademicCap,
  HiLocationMarker, HiPlus, HiTrash, HiArrowRight, HiPencil,
  HiBriefcase, HiGlobe, HiCalendar, HiCamera,
  HiOutlineOfficeBuilding, HiExternalLink, HiUserGroup
} from 'react-icons/hi'
import { FaLinkedinIn } from "react-icons/fa";

import { useSnackbar } from 'notistack'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { getMyRegistration, updateAlumni } from '../../lib/alumniApi'
import { verifySession } from '../../lib/auth'
import CompanyLogo from '../../components/CompanyLogo'
import { createStableUploadFile, uploadAlumniImage } from '../../lib/imageUpload'
import { isValidLinkedInUrl, normalizeLinkedInUrl } from '../../lib/profileLinks'
import { NO_AUTOFILL } from '../../lib/noAutofill'
import { useProtectedImageUrl } from '../../hooks/useProtectedImageUrl'
import {
  safeSessionStorageGet,
  safeSessionStorageSet,
  safeSessionStorageRemove,
} from '../../lib/safeStorage'

const emptyExperience = { company: '', designation: '', industry: '', experience: '' }
const MAX_PROFILE_IMAGE_SIZE = 3 * 1024 * 1024
const MAX_COVER_IMAGE_SIZE = 3 * 1024 * 1024
const ALUMNI_SPACE_CACHE_PREFIX = 'smvec_alumni_space_cache_'
const ALUMNI_SPACE_CACHE_TTL_MS = 2 * 60 * 1000

const departmentOptionsByDegree = {
  'B.Tech': [
    'Artificial Intelligence and Machine Learning',
    'CSE – IoT and Cyber Security including Blockchain Technology',
    'Computer Science & Engineering',
    'Electrical and Electronics Engineering',
    'Electronics and Communication Engineering',
    'Food Technology',
    'Information Technology',
    'Mechanical Engineering',
    'Robotics and Automation',
  ],
  'M.Tech': [
    'Computer Science & Engineering',
    'Electronics and Communication Engineering',
  ],
  'Ph.D': ['Electronics and Communication Engineering'],
  'MBA': ['Master of Business Administration'],
  'BBA': ['Bachelor of Business Administration'],
  'MCA': ['Master of Computer Applications'],
  'BCA': ['Bachelor of Computer Applications'],
}
const degrees = Object.keys(departmentOptionsByDegree)

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  linkedinUrl: '',
  phone: '',
  showPhone: false,
  degree: '',
  department: '',
  yearOfCompletion: '',
  address: '',
  city: '',
  state: '',
  country: '',
  pincode: '',
}

function withImageCacheBust(url) {
  if (!url) return ''
  const join = url.includes('?') ? '&' : '?'
  return `${url}${join}t=${Date.now()}`
}

function AlumniSpace() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const profileImageInputRef = useRef(null)
  const coverImageInputRef = useRef(null)
  const isConfigMissing = !isSupabaseConfigured
  const [form, setForm] = useState(initialForm)
  const [workExperiences, setWorkExperiences] = useState([{ ...emptyExperience }])
  const [registrationId, setRegistrationId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('')
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [profileImagePreview, setProfileImagePreview] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [isDisabled, setIsDisabled] = useState(false)
  const resolvedProfileImageUrl = useProtectedImageUrl(profileImageUrl)
  const resolvedCoverImageUrl = useProtectedImageUrl(coverImageUrl)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => {
      if (name === 'degree') {
        const nextDepartmentOptions = departmentOptionsByDegree[value] || []
        const nextDepartment = nextDepartmentOptions.includes(prev.department) ? prev.department : ''
        return { ...prev, degree: value, department: nextDepartment }
      }
      return { ...prev, [name]: value }
    })
  }

  const availableDepartments = form.degree ? (departmentOptionsByDegree[form.degree] || []) : []

  const updateCachedProfileRow = (userId, updates) => {
    if (!userId) return
    const cacheKey = `${ALUMNI_SPACE_CACHE_PREFIX}${userId}`
    try {
      const raw = safeSessionStorageGet(cacheKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed?.row) return
      safeSessionStorageSet(cacheKey, JSON.stringify({
        cachedAt: Date.now(),
        row: { ...parsed.row, ...updates },
      }))
    } catch {
      // Ignore cache write issues.
    }
  }

  const handleExperienceChange = (index, field, value) => {
    setWorkExperiences((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addExperience = () => {
    setWorkExperiences((prev) => [...prev, { ...emptyExperience }])
  }

  const removeExperience = (index) => {
    setWorkExperiences((prev) => prev.filter((_, i) => i !== index))
  }

  const hydrateProfile = (row, userId) => {
    setCurrentUserId(userId)
    setRegistrationId(row.id)
    setIsDisabled(Boolean(row.is_disabled))
    setProfileImageUrl(withImageCacheBust(row.profile_image_url || ''))
    setCoverImageUrl(withImageCacheBust(row.cover_image_url || ''))
    setForm({
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      email: row.email || '',
      linkedinUrl: row.linkedin_url || '',
      phone: row.phone || '',
      showPhone: Boolean(row.show_phone),
      degree: row.degree || '',
      department: row.department || '',
      yearOfCompletion: row.year_of_completion ? String(row.year_of_completion) : '',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      country: row.country || '',
      pincode: row.pincode || '',
    })

    if (Array.isArray(row.work_experiences) && row.work_experiences.length > 0) {
      setWorkExperiences(row.work_experiences.map((w) => ({
        company: w.company || '',
        designation: w.designation || '',
        industry: w.industry || '',
        experience: w.experience != null ? String(w.experience) : '',
      })))
      return
    }

    if (row.company || row.designation) {
      setWorkExperiences([{
        company: row.company || '',
        designation: row.designation || '',
        industry: row.industry || '',
        experience: row.experience != null ? String(row.experience) : '',
      }])
      return
    }

    setWorkExperiences([{ ...emptyExperience }])
  }

  useEffect(() => {
    if (isConfigMissing) return

    let mounted = true

    const loadProfile = async () => {
      const user = await verifySession()

      if (!user) {
        navigate('/login', { replace: true })
        return
      }

      if (user.role === 'staff') {
        navigate('/directory', { replace: true })
        return
      }

      const cacheKey = `${ALUMNI_SPACE_CACHE_PREFIX}${user.id}`
      let hasCachedProfile = false
      try {
        const raw = safeSessionStorageGet(cacheKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (
            parsed?.row &&
            Date.now() - Number(parsed?.cachedAt || 0) <= ALUMNI_SPACE_CACHE_TTL_MS
          ) {
            hasCachedProfile = true
            if (mounted) {
              hydrateProfile(parsed.row, user.id)
              setIsLoading(false)
            }
          }
        }
      } catch {
        // Ignore cache parse errors.
      }

      let row = null
      try {
        const { alumni } = await getMyRegistration()
        row = alumni
      } catch (err) {
        if (!mounted) return
        if (!hasCachedProfile) {
          setError(err.message || 'Unable to load profile.')
          setIsLoading(false)
        }
        return
      }

      if (!row) {
        if (!hasCachedProfile) {
          // No profile yet → finish the pic/LinkedIn/employment step.
          navigate('/complete-profile', { replace: true })
        }
        return
      }

      if (mounted) {
        hydrateProfile(row, user.id)
        safeSessionStorageSet(cacheKey, JSON.stringify({
          cachedAt: Date.now(),
          row,
        }))
        setIsLoading(false)
      }
    }

    loadProfile()

    return () => { mounted = false }
  }, [navigate, isConfigMissing])

  useEffect(() => {
    if (safeSessionStorageGet('reg_success') !== '1') return
    setShowRegistrationSuccess(true)
  }, [])

  useEffect(() => () => {
    if (profileImagePreview) {
      URL.revokeObjectURL(profileImagePreview)
    }
  }, [profileImagePreview])

  const selectSection = (key) => setActiveSection(key)

  const handleNotificationClick = () => {
    navigate('/notifications')
  }

  const handleProfileImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.')
      return
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      setError('Profile image must be 3MB or less.')
      return
    }

    if (!registrationId || !currentUserId) {
      setError('Unable to update profile photo right now.')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setError('')
    if (profileImagePreview) {
      URL.revokeObjectURL(profileImagePreview)
    }
    setProfileImagePreview(previewUrl)
    setIsSaving(true)

    try {
      const stableFile = await createStableUploadFile(file)
      const uploadResult = await uploadAlumniImage(stableFile, 'profile')
      const persistedProfileImageUrl = uploadResult.publicUrl
      if (!persistedProfileImageUrl) {
        throw new Error('Could not resolve profile image URL after upload.')
      }

      await updateAlumni(registrationId, { profile_image_url: persistedProfileImageUrl })

      setProfileImageUrl(withImageCacheBust(persistedProfileImageUrl))
      updateCachedProfileRow(currentUserId, { profile_image_url: persistedProfileImageUrl })
      enqueueSnackbar('Profile photo updated successfully.', { variant: 'success' })
    } catch (err) {
      setError(err.message || 'Could not update profile photo.')
    } finally {
      URL.revokeObjectURL(previewUrl)
      setProfileImagePreview('')
      setIsSaving(false)
    }
  }

  const handleCoverImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.')
      return
    }

    if (file.size > MAX_COVER_IMAGE_SIZE) {
      setError('Cover image must be 3MB or less.')
      return
    }

    if (!registrationId || !currentUserId) {
      setError('Unable to update cover photo right now.')
      return
    }

    setCoverUploading(true)
    setError('')

    try {
      const stableFile = await createStableUploadFile(file)
      const uploadResult = await uploadAlumniImage(stableFile, 'cover')
      const persistedCoverUrl = uploadResult.publicUrl
      if (!persistedCoverUrl) throw new Error('Could not resolve cover image URL.')

      await updateAlumni(registrationId, { cover_image_url: persistedCoverUrl })

      setCoverImageUrl(withImageCacheBust(persistedCoverUrl))
      updateCachedProfileRow(currentUserId, { cover_image_url: persistedCoverUrl })
      enqueueSnackbar('Cover photo updated successfully.', { variant: 'success' })
    } catch (err) {
      setError(err.message || 'Could not update cover photo.')
    } finally {
      setCoverUploading(false)
    }
  }

  const handleProfileImageClick = () => {
    profileImageInputRef.current?.click()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!registrationId) {
      setError('Unable to update profile right now.')
      return
    }

    const normalizedLinkedinUrl = normalizeLinkedInUrl(form.linkedinUrl)
    if (!isValidLinkedInUrl(normalizedLinkedinUrl)) {
      setError('Please enter a valid LinkedIn URL.')
      return
    }

    const workExpPayload = workExperiences
      .filter((w) => w.company.trim() || w.designation.trim())
      .map((w) => ({
        company: w.company.trim(),
        designation: w.designation.trim(),
        industry: w.industry.trim(),
        experience: w.experience ? Number(w.experience) : null,
      }))

    setIsSaving(true)
    const payload = {
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      linkedin_url: normalizedLinkedinUrl || null,
      show_phone: Boolean(form.showPhone),
      degree: form.degree || null,
      department: form.department || null,
      year_of_completion: form.yearOfCompletion ? Number(form.yearOfCompletion) : null,
      work_experiences: workExpPayload.length > 0 ? workExpPayload : null,
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      country: form.country.trim(),
      pincode: form.pincode.trim(),
    }

    try {
      await updateAlumni(registrationId, payload)
    } catch (updateError) {
      setIsSaving(false)
      setError(updateError.message || 'Could not update profile.')
      return
    }

    setIsSaving(false)
    enqueueSnackbar('Profile updated successfully.', { variant: 'success' })
  }

  const getFullName = () => `${form.firstName} ${form.lastName}`.trim() || 'Alumni User'
  const getInitials = (person) => {
    const first = ((person?.first_name ?? person?.firstName ?? form.firstName) || '').charAt(0).toUpperCase()
    return first || '?'
  }

  const getLocation = () => {
    return [form.city, form.state, form.country].filter(Boolean).join(', ')
  }

  const getHeadline = () => {
    const validExps = workExperiences.filter(w => w.designation || w.company)
    if (validExps.length > 0) {
      const latest = validExps[0]
      return (latest.designation || '') + (latest.company ? ` | ${latest.company}` : '')
    }
    if (form.department) return `${form.degree || ''} - ${form.department}`
    return ''
  }

  if (isConfigMissing) {
    return (
      <div className="alumni-space-page page-content">
        <div className="alumni-space-container">
          <div className="alumni-space-main-card">
            <p className="alumni-space-fallback">Supabase is not configured.</p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="alumni-space-loading">
        <div className="alumni-loading-spinner" aria-hidden="true" />
      </div>
    )
  }

  // Get current job for display
  const validExps = workExperiences.filter(w => w.designation || w.company)
  const currentJob = validExps.length > 0 ? validExps[0] : null

  return (
    <div className="alumni-space-page page-content">
      <div className="alumni-space-container">

        {/* ── Sidebar ── */}
        <aside className="alumni-space-sidebar">
          <div className="sidebar-profile-banner">
            <div className="profile-avatar-wrap">
              <button type="button" className="profile-avatar profile-avatar-btn" onClick={handleProfileImageClick} aria-label="Update profile photo">
                {(profileImagePreview || resolvedProfileImageUrl) ? (
                  <img src={profileImagePreview || resolvedProfileImageUrl} alt="Profile" />
                ) : (
                  <span className="profile-avatar-fallback">{getInitials()}</span>
                )}
              </button>
              <button
                type="button"
                className="profile-avatar-edit"
                onClick={handleProfileImageClick}
                aria-label="Upload profile photo"
              >
                <HiPencil />
              </button>
            </div>
            <input
              ref={profileImageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleProfileImageChange}
              style={{ display: 'none' }}
            />
            <h3 className="sidebar-name">
              {getFullName()}
            </h3>
            <p className="sidebar-email">{form.email}</p>
            <span className={`sidebar-badge${isDisabled ? ' sidebar-badge--disabled' : ''}`}>
              {isDisabled ? <HiExclamationCircle size={10} /> : <HiCheckCircle size={10} />}
              {isDisabled ? 'Disabled Alumni' : 'Verified Alumni'}
            </span>
          </div>

          <p className="sidebar-nav-label">Profile Sections</p>

          <div className="sidebar-sections">
            <button
              type="button"
              className={activeSection === '' ? 'active' : ''}
              onClick={() => selectSection('')}
            >
              <HiUser />
              My Profile
            </button>
            <button
              type="button"
              className={activeSection === 'personal' ? 'active' : ''}
              onClick={() => selectSection('personal')}
            >
              <HiPencil />
              Edit Personal Info
            </button>
            <button
              type="button"
              className={activeSection === 'education' ? 'active' : ''}
              onClick={() => selectSection('education')}
            >
              <HiAcademicCap />
              Edit Education & Work
            </button>
            <button
              type="button"
              className={activeSection === 'address' ? 'active' : ''}
              onClick={() => selectSection('address')}
            >
              <HiLocationMarker />
              Edit Address
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <section className="alumni-space-main-card">
          <div className="alumni-space-topbar">
            <div>
              <h1>Alumni Space</h1>
              <p>Manage your profile — keep your details up to date for the MVIT alumni network.</p>
            </div>
            <button type="button" className="notify-btn" onClick={handleNotificationClick}>
              <HiBell />
              Notifications
            </button>
          </div>

          {error && <p className="state-error">{error}</p>}

          <form
            onSubmit={handleSubmit}
            className={`alumni-space-form${activeSection ? ' alumni-space-form--editing' : ''}`}
          >

            {/* ── Profile View (Default / No section selected) ── */}
            {!activeSection && (
              <div className="alumni-profile-view">

                {/* Cover Photo */}
                <div
                  className="apv-cover"
                  style={resolvedCoverImageUrl ? { backgroundImage: `url(${resolvedCoverImageUrl})` } : {}}
                >
                  <button
                    type="button"
                    className="apv-cover-edit-btn"
                    onClick={() => coverImageInputRef.current?.click()}
                    disabled={coverUploading}
                  >
                    <HiCamera /> {coverUploading ? 'Uploading...' : 'Edit cover photo'}
                  </button>
                  <input
                    ref={coverImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleCoverImageChange}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Avatar on cover */}
                <div className="apv-avatar-wrapper">
                  <button type="button" className="apv-avatar" onClick={handleProfileImageClick}>
                    {(profileImagePreview || resolvedProfileImageUrl) ? (
                      <img src={profileImagePreview || resolvedProfileImageUrl} alt="Profile" />
                    ) : (
                      <div className="apv-avatar-fallback">{getInitials()}</div>
                    )}
                  </button>
                </div>

                {/* Core Info */}
                <div className="apv-core-info">
                  <div className="apv-info-left">
                    <h2 className="apv-name">{getFullName()}</h2>
                    <p className="apv-headline">{getHeadline()}</p>
                    {getLocation() && (
                      <p className="apv-location"><HiLocationMarker /> {getLocation()}</p>
                    )}
                    {normalizeLinkedInUrl(form.linkedinUrl) && (
                      <a href={normalizeLinkedInUrl(form.linkedinUrl)} target="_blank" rel="noopener noreferrer" className="apv-linkedin-link">
                        <HiExternalLink /> LinkedIn Profile
                      </a>
                    )}
                  </div>
                  <div className="apv-info-right">
                    {currentJob && currentJob.company && (
                      <div className="apv-org-item">
                        <div className="apv-org-logo apv-org-logo--company">
                          <CompanyLogo
                            company={currentJob.company}
                            className="apv-company-logo-img"
                            fallback={<HiBriefcase />}
                          />
                        </div>
                        <span>{currentJob.company}</span>
                      </div>
                    )}
                    <div className="apv-org-item">
                      <div className="apv-org-logo apv-org-logo--edu">
                        <HiAcademicCap />
                      </div>
                      <span>Manakula Vinayagar Institute of Technology</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="apv-action-bar">
                  <button type="button" className="apv-btn apv-btn-primary" onClick={() => selectSection('personal')}>
                    <HiPencil /> Edit Profile
                  </button>
                  <button type="button" className="apv-btn apv-btn-outline" onClick={() => navigate('/directory')}>
                    <HiUserGroup /> Explore Alumni
                  </button>
                </div>

                {/* Profile Content Grid */}
                <div className="apv-content-grid">
                  {/* Left Column */}
                  <div className="apv-main-col">

                    {/* Highlights */}
                    <div className="apv-card">
                      <h3 className="apv-section-title">Highlights</h3>
                      <div className="apv-highlights-grid">
                        {form.department && (
                          <div className="apv-highlight-item">
                            <div className="apv-highlight-icon"><HiAcademicCap /></div>
                            <div>
                              <strong>{form.department}</strong>
                              <span>{form.degree} - Batch of {form.yearOfCompletion || 'N/A'}</span>
                            </div>
                          </div>
                        )}
                        {workExperiences[0]?.industry && (
                          <div className="apv-highlight-item">
                            <div className="apv-highlight-icon"><FaLinkedinIn /></div>
                            <div>
                              <strong>{workExperiences[0].industry}</strong>
                              <span>Industry</span>
                            </div>
                          </div>
                        )}

                        {workExperiences[0]?.experience && (
                          <div className="apv-highlight-item">
                            <div className="apv-highlight-icon"><HiCalendar /></div>
                            <div>
                              <strong>{workExperiences[0].experience} years</strong>
                              <span>Experience</span>
                            </div>
                          </div>
                        )}
                        {form.yearOfCompletion && (
                          <div className="apv-highlight-item">
                            <div className="apv-highlight-icon"><HiUserGroup /></div>
                            <div>
                              <strong>Batch of {form.yearOfCompletion}</strong>
                              <span>MVIT Alumni</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Experience */}
                    <div className="apv-card">
                      <h3 className="apv-section-title"><HiBriefcase /> Experience</h3>
                      {validExps.length > 0 ? (
                        <div className="apv-exp-list">
                          {validExps.map((exp, idx) => (
                            <div className="apv-exp-item" key={idx}>
                              <div className="apv-exp-logo">
                                <CompanyLogo
                                  company={exp.company}
                                  className="apv-company-logo-img apv-company-logo-img--lg"
                                  fallback={<HiOutlineOfficeBuilding />}
                                />
                              </div>
                              <div className="apv-exp-details">
                                <h4>{exp.designation || 'Role not specified'}</h4>
                                <p className="apv-exp-company">{exp.company || 'Company not specified'}</p>
                                {exp.industry && <p className="apv-exp-meta">{exp.industry}</p>}
                                {exp.experience && <p className="apv-exp-meta">{exp.experience} years experience</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="apv-text-muted">No professional experience listed. <button type="button" className="apv-inline-link" onClick={() => selectSection('education')}>Add experience</button></p>
                      )}
                    </div>

                    {/* Education */}
                    <div className="apv-card">
                      <h3 className="apv-section-title"><HiAcademicCap /> Education</h3>
                      <div className="apv-exp-list">
                        <div className="apv-exp-item">
                          <div className="apv-exp-logo apv-edu-logo"><HiAcademicCap /></div>
                          <div className="apv-exp-details">
                            <h4>Manakula Vinayagar Institute of Technology</h4>
                            <p className="apv-exp-company">{form.degree} in {form.department}</p>
                            {form.yearOfCompletion && (
                              <p className="apv-exp-meta">Batch of {form.yearOfCompletion}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {activeSection === 'personal' && (
              <section className="alumni-section">
                <h3>Personal Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email / Mobile</label>
                    <input type="text" name="email" value={form.email} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="tel" name="phone" value={form.phone} readOnly />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>LinkedIn URL</label>
                    <input
                      type="url"
                      name="linkedinUrl"
                      value={form.linkedinUrl}
                      onChange={handleChange}
                      placeholder="https://www.linkedin.com/in/your-profile"
                    />
                  </div>
                  <div className="form-group" />
                </div>
                <label className="profile-phone-consent">
                  <input
                    type="checkbox"
                    checked={Boolean(form.showPhone)}
                    onChange={(e) => setForm((prev) => ({ ...prev, showPhone: e.target.checked }))}
                  />
                  <span>I consent to make my phone number visible to other alumni and staff.</span>
                </label>
              </section>
            )}

            {activeSection === 'education' && (
              <section className="alumni-section">
                <h3>Education &amp; Work</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Degree</label>
                    <select name="degree" value={form.degree} onChange={handleChange} required>
                      <option value="">Select Degree</option>
                      {degrees.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select name="department" value={form.department} onChange={handleChange} required>
                      <option value="">Select Department</option>
                      {availableDepartments.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Year of Completion</label>
                    <input
                      type="number"
                      name="yearOfCompletion"
                      value={form.yearOfCompletion}
                      onChange={handleChange}
                      min="1990"
                      max="2026"
                      required
                    />
                  </div>
                  <div className="form-group" />
                </div>

                <h4 style={{ marginTop: '24px', marginBottom: '12px', fontFamily: "'Futura PT', sans-serif" }}>Work Experiences</h4>
                {workExperiences.map((exp, index) => (
                  <div key={index} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', marginBottom: '16px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontFamily: "'Futura PT', sans-serif" }}>Experience {index + 1}</span>
                      {workExperiences.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeExperience(index)}
                          style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
                        >
                          <HiTrash /> Remove
                        </button>
                      )}
                    </div>
                    <div className="form-row" >
                      <div className="form-group">
                        <label>Company / Organization</label>
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => handleExperienceChange(index, 'company', e.target.value)}

                        />
                      </div>
                      <div className="form-group">
                        <label>Designation</label>
                        <input
                          type="text"
                          value={exp.designation}
                          onChange={(e) => handleExperienceChange(index, 'designation', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Industry</label>
                        <input
                          type="text"
                          value={exp.industry}
                          onChange={(e) => handleExperienceChange(index, 'industry', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Years of Experience</label>
                        <input
                          type="number"
                          value={exp.experience}
                          onChange={(e) => handleExperienceChange(index, 'experience', e.target.value)}
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addExperience}
                  className='experience-add-btn'
                >
                  <HiPlus /> Add More Experience
                </button>
              </section>
            )}

            {activeSection === 'address' && (
              <section className="alumni-section">
                <h3>Address</h3>
                <div className="form-group">
                  <label>Street Address</label>
                  <textarea name="address" value={form.address} onChange={handleChange} rows={3} required {...NO_AUTOFILL} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input type="text" name="city" value={form.city} onChange={handleChange} required {...NO_AUTOFILL} />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input type="text" name="state" value={form.state} onChange={handleChange} required {...NO_AUTOFILL} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Country</label>
                    <input type="text" name="country" value={form.country} onChange={handleChange} required {...NO_AUTOFILL} />
                  </div>
                  <div className="form-group">
                    <label>PIN Code</label>
                    <input type="text" name="pincode" value={form.pincode} onChange={handleChange} required {...NO_AUTOFILL} />
                  </div>
                </div>
              </section>
            )}

            {activeSection && (
              <div className="form-actions">
                <button type="button" className="back-to-profile-btn" onClick={() => selectSection('')}>
                  Back to Profile
                </button>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>
        </section>

      </div>

      {showRegistrationSuccess && (
        <div className="alumni-success-overlay" role="dialog" aria-modal="true" aria-labelledby="alumni-success-title">
          <div className="alumni-success-modal">
            <div className="alumni-success-icon">
              <HiCheckCircle />
            </div>
            <p className="alumni-success-kicker">Registration Complete</p>
            <h2 id="alumni-success-title">You have successfully registered</h2>
            <p className="alumni-success-message">
              Welcome to Alumni Space. Explore alumni, build meaningful connections, and keep your profile up to date.
            </p>
            <div className="alumni-success-actions">
              <button
                type="button"
                className="alumni-success-btn alumni-success-btn-primary"
                onClick={() => {
                  safeSessionStorageRemove('reg_success')
                  setShowRegistrationSuccess(false)
                  navigate('/directory')
                }}
              >
                Explore Alumni Space
                <HiArrowRight />
              </button>
              <button
                type="button"
                className="alumni-success-btn alumni-success-btn-secondary"
                onClick={() => {
                  safeSessionStorageRemove('reg_success')
                  setShowRegistrationSuccess(false)
                  setActiveSection('')
                }}
              >
                Continue to Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AlumniSpace

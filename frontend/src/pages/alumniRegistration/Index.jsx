import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import { HiUser, HiCamera, HiAcademicCap, HiLocationMarker, HiPlus, HiTrash } from 'react-icons/hi'
import { useSnackbar } from 'notistack'
import { Country, State, City } from 'country-state-city'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { verifySession } from '../../lib/auth'
import { isStudentRegistered } from '../../lib/studentRegistration'
import { getMyRegistration, createAlumni, updateAlumni } from '../../lib/alumniApi'
import CustomSelect from '../../components/CustomSelect'
import AutoSuggestInput from '../../components/AutoSuggestInput'
import { companies, designations, industries } from '../../data/suggestions'
import { safeSessionStorageSet } from '../../lib/safeStorage'
import { createStableUploadFile, uploadAlumniImage } from '../../lib/imageUpload'
import { isValidLinkedInUrl, normalizeLinkedInUrl } from '../../lib/profileLinks'
import { NO_AUTOFILL } from '../../lib/noAutofill'
import companyFilterOptions from '../../../company-filter-options.json'

const allCountriesData = Country.getAllCountries()
const countryNameOptions = allCountriesData.map((c) => c.name)

const emptyExperience = { company: '', designation: '', industry: '', experience: '', isStartup: false, startupName: '', startupType: '' }
const EXPERIENCE_COLLAPSE_MS = 260
const MAX_PROFILE_IMAGE_SIZE = 3 * 1024 * 1024
const SUPPORTED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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
  profileImage: null,
}

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
const completionYears = Array.from({ length: new Date().getFullYear() - 2011 + 1 }, (_, i) => String(new Date().getFullYear() - i))
const companySuggestions = mergeCompanySuggestions(companies, companyFilterOptions.companies)

function normalizeSuggestionLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function getSuggestionLabel(item) {
  return typeof item === 'string' ? item : item?.label
}

function mergeCompanySuggestions(primarySuggestions, directoryCompanyNames = []) {
  const suggestionMap = new Map()

  primarySuggestions.forEach((item) => {
    const label = getSuggestionLabel(item)
    const key = normalizeSuggestionLabel(label)
    if (!key) return
    suggestionMap.set(key, item)
  })

  directoryCompanyNames.forEach((label) => {
    const key = normalizeSuggestionLabel(label)
    if (!key || suggestionMap.has(key)) return
    suggestionMap.set(key, label)
  })

  return [...suggestionMap.values()]
}

async function validateProfileImageFile(file) {
  if (!file) {
    throw new Error('Profile photo is required.')
  }

  if (!SUPPORTED_PROFILE_IMAGE_TYPES.has(file.type)) {
    throw new Error('Please upload a valid JPG, PNG, or WEBP image.')
  }

  if (file.size > MAX_PROFILE_IMAGE_SIZE) {
    throw new Error('Profile image must be 3MB or less.')
  }
}

function Registration() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const bypassBlockerRef = useRef(false)
  const formCardRef = useRef(null)
  const experienceIdRef = useRef(1)
  const profileImageValidationIdRef = useRef(0)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [workExperiences, setWorkExperiences] = useState([{ id: experienceIdRef.current, ...emptyExperience }])
  const [collapsingExperienceIds, setCollapsingExperienceIds] = useState([])
  const [preview, setPreview] = useState(null)
  const [lockedPhone, setLockedPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isValidatingProfileImage, setIsValidatingProfileImage] = useState(false)
  const [skipEmployment, setSkipEmployment] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !bypassBlockerRef.current && isDirty && currentLocation.pathname !== nextLocation.pathname
  )

  const navigateWithoutPrompt = useCallback((to, options) => {
    bypassBlockerRef.current = true
    setIsDirty(false)
    navigate(to, options)
  }, [navigate])

  useEffect(() => {
    let mounted = true

    const hydrateUser = async () => {
      const user = await verifySession()
      if (!mounted) return

      if (!user) {
        navigateWithoutPrompt('/login', { replace: true })
        return
      }

      // Staff don't register
      if (user.role === 'staff') {
        navigateWithoutPrompt('/directory', { replace: true })
        return
      }

      const { registered } = await isStudentRegistered(user)
      if (!mounted) return

      if (registered) {
        navigateWithoutPrompt('/alumni-space', { replace: true })
        return
      }

      setCurrentUser(user)
      const mobile = user.mobile_number || ''
      setLockedPhone(mobile)
      setForm((prev) => ({ ...prev, phone: mobile }))
      setIsChecking(false)
    }

    hydrateUser()

    return () => { mounted = false }
  }, [navigateWithoutPrompt])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const handleChange = (e) => {
    const { name, value } = e.target
    setIsDirty(true)
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

  const selectedCountry = useMemo(
    () => allCountriesData.find((c) => c.name === form.country) || null,
    [form.country],
  )

  const stateOptionsForCountry = useMemo(() => {
    if (!selectedCountry) return []
    return State.getStatesOfCountry(selectedCountry.isoCode)
  }, [selectedCountry])

  const stateNameOptions = useMemo(
    () => stateOptionsForCountry.map((s) => s.name),
    [stateOptionsForCountry],
  )

  const selectedState = useMemo(() => {
    if (!selectedCountry) return null
    return stateOptionsForCountry.find((s) => s.name === form.state) || null
  }, [selectedCountry, stateOptionsForCountry, form.state])

  const cityNameOptions = useMemo(() => {
    if (!selectedCountry || !selectedState) return []
    return City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode).map((c) => c.name)
  }, [selectedCountry, selectedState])

  // Clear children only when the resolved parent truly changes — not during mid-typing
  const lastResolvedCountryIsoRef = useRef(null)
  useEffect(() => {
    const currentIso = selectedCountry?.isoCode || null
    const prevIso = lastResolvedCountryIsoRef.current
    if (prevIso) {
      const switchedCountry = currentIso && currentIso !== prevIso
      const clearedCountry = !currentIso && form.country === ''
      if (switchedCountry || clearedCountry) {
        setForm((prev) => ({ ...prev, state: '', city: '' }))
      }
    }
    if (currentIso) {
      lastResolvedCountryIsoRef.current = currentIso
    } else if (form.country === '') {
      lastResolvedCountryIsoRef.current = null
    }
  }, [selectedCountry, form.country])

  const lastResolvedStateIsoRef = useRef(null)
  useEffect(() => {
    const currentIso = selectedState?.isoCode || null
    const prevIso = lastResolvedStateIsoRef.current
    if (prevIso) {
      const switchedState = currentIso && currentIso !== prevIso
      const clearedState = !currentIso && form.state === ''
      if (switchedState || clearedState) {
        setForm((prev) => ({ ...prev, city: '' }))
      }
    }
    if (currentIso) {
      lastResolvedStateIsoRef.current = currentIso
    } else if (form.state === '') {
      lastResolvedStateIsoRef.current = null
    }
  }, [selectedState, form.state])

  const handleExperienceChange = (index, field, value) => {
    setIsDirty(true)
    setWorkExperiences((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addExperience = () => {
    experienceIdRef.current += 1
    setWorkExperiences((prev) => [...prev, { id: experienceIdRef.current, ...emptyExperience }])
  }

  const removeExperience = (id) => {
    setCollapsingExperienceIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setTimeout(() => {
      setWorkExperiences((prev) => prev.filter((exp) => exp.id !== id))
      setCollapsingExperienceIds((prev) => prev.filter((itemId) => itemId !== id))
    }, EXPERIENCE_COLLAPSE_MS)
  }

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validationId = profileImageValidationIdRef.current + 1
    profileImageValidationIdRef.current = validationId
    setError('')
    setMessage('')
    setIsValidatingProfileImage(true)
    setForm((prev) => ({ ...prev, profileImage: null }))
    setPreview(null)

    try {
      await validateProfileImageFile(file)
      const stableFile = await createStableUploadFile(file)
      if (profileImageValidationIdRef.current !== validationId) return

      setIsDirty(true)
      setForm((prev) => ({ ...prev, profileImage: stableFile }))
      setPreview(URL.createObjectURL(stableFile))
      enqueueSnackbar('Profile photo added successfully.', { variant: 'success' })
    } catch (imageError) {
      if (profileImageValidationIdRef.current !== validationId) return
      e.target.value = ''
      setForm((prev) => ({ ...prev, profileImage: null }))
      setPreview(null)
      const imageMessage = imageError?.message || 'Please upload a valid profile photo.'
      setError(imageMessage)
      enqueueSnackbar(imageMessage, { variant: 'error' })
    } finally {
      if (profileImageValidationIdRef.current === validationId) {
        setIsValidatingProfileImage(false)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    // Guard against accidental submit events before final step (for example Enter key).
    if (step < 3) {
      const err = validateStep()
      if (err) {
        setError(err)
      } else {
        setStep((s) => Math.min(s + 1, 3))
        requestAnimationFrame(() => {
          formCardRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
          formCardRef.current?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' })
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        })
      }
      return
    }

    if (!isSupabaseConfigured) {
      setError('Service is not configured.')
      return
    }

    if (!currentUser) {
      setError('Please login first to complete alumni registration.')
      navigateWithoutPrompt('/login')
      return
    }

    const normalizedLinkedinUrl = normalizeLinkedInUrl(form.linkedinUrl)
    if (!isValidLinkedInUrl(normalizedLinkedinUrl)) {
      setError('Please enter a valid LinkedIn URL.')
      return
    }

    let profileImageUrl = null

    // Build work_experiences JSON
    const workExpPayload = skipEmployment
      ? null
      : workExperiences
        .filter((w) => (w.isStartup ? w.startupName.trim() : (w.company.trim() || w.designation.trim())))
        .map((w) => (
          w.isStartup
            ? {
                is_startup: true,
                startup_name: w.startupName.trim(),
                startup_type: w.startupType.trim(),
                company: null,
                designation: null,
                industry: null,
                experience: null,
              }
            : {
                is_startup: false,
                company: w.company.trim(),
                designation: w.designation.trim(),
                industry: w.industry.trim(),
                experience: w.experience ? Number(w.experience) : null,
                startup_name: null,
                startup_type: null,
              }
        ))

    const payload = {
      user_id: currentUser.id,
      email: form.email.trim(),
      linkedin_url: normalizedLinkedinUrl || null,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      phone: currentUser.mobile_number,
      show_phone: Boolean(form.showPhone),
      degree: form.degree || null,
      department: form.department || null,
      year_of_completion: form.yearOfCompletion ? Number(form.yearOfCompletion) : null,
      roll_number: null,
      company: null,
      designation: null,
      industry: null,
      experience: null,
      work_experiences: workExpPayload && workExpPayload.length > 0 ? workExpPayload : null,
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      country: form.country.trim(),
      pincode: form.pincode.trim(),
      profile_image_url: null,
    }

    setIsSubmitting(true)

    // Find any existing profile for this user (the backend allows one per user).
    let existing = null
    try {
      const reg = await getMyRegistration()
      existing = reg.alumni || null
    } catch {
      // Treat lookup failure as "no existing profile"; create will 409 if it exists.
    }
    const existingId = existing?.id || null

    if (form.profileImage) {
      try {
        const uploadResult = await uploadAlumniImage(form.profileImage, 'profile')
        profileImageUrl = uploadResult.publicUrl || null
      } catch (uploadError) {
        setError(uploadError?.message || 'Could not upload profile image.')
        setIsSubmitting(false)
        return
      }
    } else if (existing) {
      profileImageUrl = existing.profile_image_url || null
    }

    payload.profile_image_url = profileImageUrl

    try {
      if (existingId) {
        await updateAlumni(existingId, payload)
      } else {
        await createAlumni(payload)
      }
    } catch (saveError) {
      setIsSubmitting(false)
      if (saveError?.code === 'CONFLICT') {
        const msg = String(saveError.message || '')
        if (/email/i.test(msg)) {
          enqueueSnackbar('This email is already registered. Please use a different email.', { variant: 'error' })
        } else {
          setError('You already have a registration profile. Please open My Profile and edit your details there.')
        }
      } else if (saveError?.code === 'VALIDATION_ERROR') {
        setError(saveError.details?.[0]?.message || saveError.message || 'Please check your details.')
      } else if (saveError?.status === 401) {
        setError('Your session expired. Please login again.')
        navigateWithoutPrompt('/login', { replace: true })
      } else {
        setError(saveError?.message || 'Unable to save registration.')
      }
      return
    }

    setIsSubmitting(false)
    safeSessionStorageSet('reg_success', '1')
    navigateWithoutPrompt('/alumni-space', { replace: true })
  }

  const validateStep = () => {
    if (step === 1) {
      if (isValidatingProfileImage) return 'Please wait while we validate your profile photo.'
      if (!form.profileImage) return 'Profile photo is required. Please upload a valid image.'
      if (!form.firstName.trim()) return 'First name is required.'
      if (!form.lastName.trim()) return 'Last name is required.'
      if (!form.email.trim()) return 'Email address is required.'
      if (!form.phone.trim()) return 'Phone number is required.'
    }
    if (step === 2) {
      if (!form.degree) return 'Please select a degree.'
      if (!form.department) return 'Please select a department.'
      if (!form.yearOfCompletion) return 'Year of completion is required.'
      if (!skipEmployment) {
        const hasAtLeastOne = workExperiences.some((w) => w.company.trim() || (w.isStartup && w.startupName.trim()))
        if (!hasAtLeastOne) return 'Please add at least one work experience or check "Currently not working".'
        for (let i = 0; i < workExperiences.length; i++) {
          const w = workExperiences[i]
          if (w.isStartup) {
            if (!w.startupName.trim()) {
              return `Business / startup name is required for experience #${i + 1}.`
            }
          } else if (w.company.trim() && !w.designation.trim()) {
            return `Designation is required for experience #${i + 1}.`
          }
        }
      }
    }
    if (step === 3) {
      if (!form.address.trim()) return 'Address is required.'
      if (!selectedCountry) return 'Please select a valid country.'
      if (!selectedState) return 'Please select a valid state.'
      if (!form.city.trim()) return 'City is required.'
      const cityExistsInState = cityNameOptions.some(
        (city) => city.toLowerCase() === form.city.trim().toLowerCase(),
      )
      if (cityNameOptions.length > 0 && !cityExistsInState) {
        return 'Please select a valid city.'
      }
      if (!/^\d{6}$/.test(form.pincode.trim())) return 'PIN code must be 6 digits.'
    }
    return null
  }

  const nextStep = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setError('')
    setStep((s) => Math.min(s + 1, 3))
    requestAnimationFrame(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
      formCardRef.current?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' })
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    })
  }

  const prevStep = () => setStep((s) => Math.max(s - 1, 1))

  if (isChecking) {
    return (
      <div className="reg-page-loading">
        <div className="reg-page-spinner" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="registration-page page-content">
      <div className="registration-container">
        <div className="registration-header">
          <h1>Alumni Registration</h1>
          <p>Join the MVIT alumni network by completing your profile</p>
        </div>

        <div className="registration-progress">
          <div className={`step ${step >= 1 ? (step > 1 ? 'completed' : 'active') : ''}`}>
            <span className="step-num"><HiUser /></span>
            Personal Info
          </div>
          <div className={`step-line ${step > 1 ? 'active' : ''}`} />
          <div className={`step ${step >= 2 ? (step > 2 ? 'completed' : 'active') : ''}`}>
            <span className="step-num"><HiAcademicCap /></span>
            Education & Work
          </div>
          <div className={`step-line ${step > 2 ? 'active' : ''}`} />
          <div className={`step ${step >= 3 ? 'active' : ''}`}>
            <span className="step-num"><HiLocationMarker /></span>
            Address
          </div>
        </div>

        <div ref={formCardRef} className="registration-card">
          {error && <p style={{ color: '#e74c3c', marginBottom: '12px' }}>{error}</p>}
          {message && <p style={{ color: '#27ae60', marginBottom: '12px' }}>{message}</p>}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <>
                <h3 className="section-title">Personal Information</h3>

                <div className="photo-upload">
                  <div className="photo-preview">
                    {preview ? (
                      <img src={preview} alt="Profile" />
                    ) : (
                      <HiUser />
                    )}
                  </div>
                  <div className="photo-actions">
                    <label className="upload-btn">
                      <HiCamera /> {isValidatingProfileImage ? 'Verifying...' : 'Upload Photo *'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageChange}
                        disabled={isValidatingProfileImage}
                        required
                      />
                    </label>
                    <p>JPG, PNG, or WEBP, max 3MB.</p>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      placeholder="First name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>LinkedIn URL</label>
                    <input
                      type="text"
                      name="linkedinUrl"
                      value={form.linkedinUrl}
                      onChange={handleChange}
                      placeholder="https://www.linkedin.com/in/your-profile"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={(e) => {
                        if (lockedPhone) return
                        const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 10)
                        handleChange({ target: { name: 'phone', value: onlyDigits } })
                      }}
                      placeholder="10-digit mobile number"
                      inputMode="numeric"
                      maxLength={10}
                      readOnly={Boolean(lockedPhone)}
                      aria-readonly={Boolean(lockedPhone)}
                      title={lockedPhone ? 'This is the mobile number you signed in with and cannot be changed.' : undefined}
                      style={lockedPhone ? { background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' } : undefined}
                      required
                    />
                    {lockedPhone && (
                      <small style={{ display: 'block', marginTop: 4, color: '#6b7280' }}>
                        🔒 Linked to your login mobile number — cannot be edited.
                      </small>
                    )}
                  </div>
                  <div className="form-group" />
                </div>

              </>
            )}

            {step === 2 && (
              <>
                <h3 className="section-title">Education Details</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Degree *</label>
                    <CustomSelect
                      name="degree"
                      value={form.degree}
                      onChange={handleChange}
                      options={degrees}
                      placeholder="Select Degree"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Department *</label>
                    <CustomSelect
                      name="department"
                      value={form.department}
                      onChange={handleChange}
                      options={availableDepartments}
                      placeholder="Select Department"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Year of Completion *</label>
                    <CustomSelect
                      name="yearOfCompletion"
                      value={form.yearOfCompletion}
                      onChange={handleChange}
                      options={completionYears}
                      placeholder="Select Year"
                      required
                    />
                  </div>
                  <div className="form-group" />
                </div>

                <h3 className="section-title section-title--spaced">Work Experience</h3>

                <label className="skip-employment-check">
                  <input
                    type="checkbox"
                    checked={skipEmployment}
                    onChange={(e) => setSkipEmployment(e.target.checked)}
                  />
                  <span>Currently not working / I prefer not to mention</span>
                </label>

                {!skipEmployment && (
                  <>
                    <div className="work-experience-list">
                      {workExperiences.map((exp, index) => (
                        <div
                          key={exp.id}
                          className={`experience-entry-shell ${collapsingExperienceIds.includes(exp.id) ? 'is-collapsing' : ''}`}
                        >
                          <div className="experience-entry">
                            <div className="experience-entry-head">
                              <strong className="experience-entry-title">Experience {index + 1}</strong>
                              {workExperiences.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeExperience(exp.id)}
                                  className="experience-remove-btn"
                                >
                                  <HiTrash />
                                </button>
                              )}
                            </div>

                            <label className="startup-experience-check">
                              <input
                                type="checkbox"
                                checked={Boolean(exp.isStartup)}
                                onChange={(e) => handleExperienceChange(index, 'isStartup', e.target.checked)}
                              />
                              <span>Startup / Own business</span>
                            </label>

                            {exp.isStartup ? (
                              <div className="form-row">
                                <div className="form-group">
                                  <label>Business / Startup Name *</label>
                                  <input
                                    type="text"
                                    value={exp.startupName}
                                    onChange={(e) => handleExperienceChange(index, 'startupName', e.target.value)}
                                    placeholder="Your business or startup name"
                                  />
                                </div>
                                <div className="form-group">
                                  <label>Type of Business / Startup</label>
                                  <input
                                    type="text"
                                    value={exp.startupType}
                                    onChange={(e) => handleExperienceChange(index, 'startupType', e.target.value)}
                                    placeholder="e.g. SaaS, D2C, Consulting"
                                  />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="form-row">
                                  <div className="form-group">
                                    <label>Company / Organization *</label>
                                    <AutoSuggestInput
                                      value={exp.company}
                                      onChange={(val) => handleExperienceChange(index, 'company', val)}
                                      suggestions={companySuggestions}
                                      placeholder="Current employer"
                                      renderIcon
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>Designation *</label>
                                    <AutoSuggestInput
                                      value={exp.designation}
                                      onChange={(val) => handleExperienceChange(index, 'designation', val)}
                                      suggestions={designations}
                                      placeholder="Your job title"
                                    />
                                  </div>
                                </div>

                                <div className="form-row">
                                  <div className="form-group">
                                    <label>Industry</label>
                                    <AutoSuggestInput
                                      value={exp.industry}
                                      onChange={(val) => handleExperienceChange(index, 'industry', val)}
                                      suggestions={industries}
                                      placeholder="e.g. IT, Healthcare"
                                      showOnFocus
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>Years of Experience</label>
                                    <input
                                      type="number"
                                      value={exp.experience}
                                      onChange={(e) => handleExperienceChange(index, 'experience', e.target.value)}
                                      placeholder="e.g. 5"
                                      min="0"
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addExperience}
                      className="experience-add-btn"
                    >
                      <HiPlus /> Add More Experience
                    </button>
                  </>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <h3 className="section-title">Present Residential Details</h3>

                <div className="form-group">
                  <label>Address *</label>
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Street address"
                    rows={3}
                    {...NO_AUTOFILL}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Country *</label>
                    <AutoSuggestInput
                      value={form.country}
                      onChange={(val) => {
                        setIsDirty(true)
                        setForm((prev) => ({ ...prev, country: val }))
                      }}
                      suggestions={countryNameOptions}
                      placeholder="Country"
                      required
                      strict
                    />
                  </div>
                  <div className="form-group">
                    <label>State *</label>
                    <AutoSuggestInput
                      value={form.state}
                      onChange={(val) => {
                        setIsDirty(true)
                        // First try matching against the current country's states (already handled
                        // by AutoSuggestInput's strict-snap when the canonical name comes through).
                        // Fall back to a global lookup so Chrome-autofilled state names from any
                        // country snap correctly and auto-fill the parent country.
                        const trimmed = String(val || '').trim()
                        if (trimmed) {
                          const inCurrent = stateOptionsForCountry.find(
                            (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
                          )
                          if (inCurrent) {
                            setForm((prev) => ({ ...prev, state: inCurrent.name }))
                            return
                          }
                          const globalMatch = State.getAllStates().find(
                            (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
                          )
                          if (globalMatch) {
                            const matchedCountry = allCountriesData.find(
                              (c) => c.isoCode === globalMatch.countryCode,
                            )
                            if (matchedCountry) {
                              setForm((prev) => ({
                                ...prev,
                                country: matchedCountry.name,
                                state: globalMatch.name,
                              }))
                              return
                            }
                          }
                        }
                        setForm((prev) => ({ ...prev, state: val }))
                      }}
                      suggestions={stateNameOptions}
                      placeholder={selectedCountry ? 'State / Province' : 'Select country first'}
                      required
                      strict
                      disabled={!selectedCountry}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City *</label>
                    <AutoSuggestInput
                      value={form.city}
                      onChange={(val) => {
                        setIsDirty(true)
                        // Same defensive pattern as the state field — match cities globally and
                        // auto-fill country/state when an autofill brings a recognized city name.
                        const trimmed = String(val || '').trim()
                        if (trimmed && selectedCountry && selectedState) {
                          const inCurrent = City.getCitiesOfState(
                            selectedCountry.isoCode,
                            selectedState.isoCode,
                          ).find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
                          if (inCurrent) {
                            setForm((prev) => ({ ...prev, city: inCurrent.name }))
                            return
                          }
                        }
                        setForm((prev) => ({ ...prev, city: val }))
                      }}
                      suggestions={cityNameOptions}
                      placeholder={selectedState ? 'City' : 'Select state first'}
                      required
                      strict
                      disabled={!selectedState}
                    />
                  </div>
                  <div className="form-group">
                    <label>PIN Code *</label>
                    <input
                      type="text"
                      name="pincode"
                      value={form.pincode}
                      onChange={(e) => {
                        const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 6)
                        handleChange({ target: { name: 'pincode', value: onlyDigits } })
                      }}
                      placeholder="PIN / ZIP code"
                      inputMode="numeric"
                      maxLength={6}
                      {...NO_AUTOFILL}
                      required
                    />
                  </div>
                </div>

              </>
            )}

            <div className="form-actions">
              {step > 1 ? (
                <button type="button" className="btn btn-outline" onClick={prevStep}>
                  Previous
                </button>
              ) : (
                <span />
              )}

              {step < 3 ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={nextStep}
                  disabled={isValidatingProfileImage}
                >
                  {isValidatingProfileImage ? 'Verifying Photo...' : 'Next Step'}
                </button>
              ) : (
                <button type="submit" className="btn btn-primary" disabled={isSubmitting || isValidatingProfileImage}>
                  {isSubmitting ? 'Saving...' : 'Submit Registration'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {blocker.state === 'blocked' && (
        <div className="reg-leave-overlay">
          <div className="reg-leave-modal">
            <h3>Leave registration?</h3>
            <p>Your progress will not be saved. Are you sure you want to leave this page?</p>
            <div className="reg-leave-actions">
              <button className="btn btn-outline" onClick={() => blocker.reset()}>Stay</button>
              <button className="btn btn-primary" onClick={() => blocker.proceed()}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Registration

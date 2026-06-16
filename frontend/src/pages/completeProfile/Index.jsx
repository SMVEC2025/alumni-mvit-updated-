import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiUser, HiCamera, HiPlus, HiTrash } from 'react-icons/hi'
import { useSnackbar } from 'notistack'
import { Country, State, City } from 'country-state-city'
import { verifySession, getProfilePrefill, clearProfilePrefill, getUser } from '../../lib/auth'
import { isStudentRegistered } from '../../lib/studentRegistration'
import { completeRegistration } from '../../lib/alumniApi'
import CustomSelect from '../../components/CustomSelect'
import AutoSuggestInput from '../../components/AutoSuggestInput'
import { companies, designations, industries } from '../../data/suggestions'
import { createStableUploadFile, uploadAlumniImage } from '../../lib/imageUpload'
import { isValidLinkedInUrl, normalizeLinkedInUrl } from '../../lib/profileLinks'
import { NO_AUTOFILL } from '../../lib/noAutofill'
import { safeSessionStorageSet, safeLocalStorageSet } from '../../lib/safeStorage'

const MAX_PROFILE_IMAGE_SIZE = 3 * 1024 * 1024
const SUPPORTED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const emptyExperience = { company: '', designation: '', industry: '', experience: '', isStartup: false, startupName: '', startupType: '' }

const allCountriesData = Country.getAllCountries()
const countryNameOptions = allCountriesData.map((c) => c.name)

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
  'M.Tech': ['Computer Science & Engineering', 'Electronics and Communication Engineering'],
  'Ph.D': ['Electronics and Communication Engineering'],
  'M.B.A': ['Master of Business Administration'],
  'MBA': ['Master of Business Administration'],
  'BBA': ['Bachelor of Business Administration'],
  'MCA': ['Master of Computer Applications'],
  'BCA': ['Bachelor of Computer Applications'],
}
const degrees = Object.keys(departmentOptionsByDegree).filter((d) => d !== 'MBA')
const completionYears = Array.from(
  { length: new Date().getFullYear() + 1 - 2011 + 1 },
  (_, i) => String(new Date().getFullYear() + 1 - i)
)

async function validateProfileImageFile(file) {
  if (!file) throw new Error('Profile photo is required.')
  if (!SUPPORTED_PROFILE_IMAGE_TYPES.has(file.type)) throw new Error('Please upload a valid JPG, PNG, or WEBP image.')
  if (file.size > MAX_PROFILE_IMAGE_SIZE) throw new Error('Profile image must be 3MB or less.')
}

// Map the seed work_experiences (snake_case) into the form's experience rows.
function prefillExperiences(work, nextId) {
  if (!Array.isArray(work) || work.length === 0) return [{ id: nextId(), ...emptyExperience }]
  return work.map((w) => ({
    id: nextId(),
    company: w.company || '',
    designation: w.designation || '',
    industry: w.industry || '',
    experience: w.experience != null ? String(w.experience) : '',
    isStartup: Boolean(w.is_startup || w.isStartup),
    startupName: w.startup_name || w.startupName || '',
    startupType: w.startup_type || w.startupType || '',
  }))
}

// Single profile-completion form for the mobile-OTP flow. Shows the user their
// existing details (pre-filled from login when available) and forces them to
// complete every field including LinkedIn and work experience, then submits a
// verified registration. Brand-new users see the same form, empty.
function CompleteProfile() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const experienceIdRef = useRef(0)
  const nextExperienceId = useCallback(() => {
    experienceIdRef.current += 1
    return experienceIdRef.current
  }, [])
  const profileImageValidationIdRef = useRef(0)

  const [isChecking, setIsChecking] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidatingProfileImage, setIsValidatingProfileImage] = useState(false)
  const [error, setError] = useState('')

  // Identity fields.
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [degree, setDegree] = useState('')
  const [department, setDepartment] = useState('')
  const [yearOfCompletion, setYearOfCompletion] = useState('')
  const [rollNumber, setRollNumber] = useState('')

  // Address.
  const [addressLine, setAddressLine] = useState('')
  const [country, setCountry] = useState('')
  const [stateName, setStateName] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')

  // Media + optional.
  const [existingImageUrl, setExistingImageUrl] = useState(null) // pre-filled from seed
  const [profileImage, setProfileImage] = useState(null) // newly chosen File
  const [preview, setPreview] = useState(null)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [skipEmployment, setSkipEmployment] = useState(false)
  const [workExperiences, setWorkExperiences] = useState([{ id: 1, ...emptyExperience }])

  useEffect(() => {
    let mounted = true
    const hydrate = async () => {
      const user = await verifySession()
      if (!mounted) return
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      if (user.role === 'staff') {
        navigate('/directory', { replace: true })
        return
      }
      const { registered } = await isStudentRegistered(user)
      if (!mounted) return
      if (registered) {
        navigate('/alumni-space', { replace: true })
        return
      }

      // Pre-fill from the data captured at login (recovered accounts). New users
      // get an empty form. Either way the required rules are identical.
      const prefill = getProfilePrefill()?.prefill
      if (prefill) {
        setName(prefill.name || '')
        setEmail(prefill.email || '')
        setDegree(degrees.includes(prefill.degree) ? prefill.degree : prefill.degree || '')
        setDepartment(prefill.department || '')
        setYearOfCompletion(prefill.yearOfCompletion != null ? String(prefill.yearOfCompletion) : '')
        setRollNumber(prefill.rollNumber || '')
        setAddressLine(prefill.address?.line1 || '')
        setCountry(prefill.address?.country || '')
        setStateName(prefill.address?.state || '')
        setCity(prefill.address?.city || '')
        setPincode(prefill.address?.pincode || '')
        setLinkedinUrl(prefill.linkedinUrl || '')
        if (prefill.image) setExistingImageUrl(prefill.image)
        const exps = prefillExperiences(prefill.workExperiences, nextExperienceId)
        setWorkExperiences(exps)
      } else {
        experienceIdRef.current = 1
        setWorkExperiences([{ id: 1, ...emptyExperience }])
      }
      setIsChecking(false)
    }
    hydrate()
    return () => { mounted = false }
  }, [navigate, nextExperienceId])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  // ── Country / state / city option chains ──
  const selectedCountry = useMemo(
    () => allCountriesData.find((c) => c.name === country) || null,
    [country]
  )
  const stateOptionsForCountry = useMemo(
    () => (selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : []),
    [selectedCountry]
  )
  const stateNameOptions = useMemo(() => stateOptionsForCountry.map((s) => s.name), [stateOptionsForCountry])
  const selectedState = useMemo(
    () => (selectedCountry ? stateOptionsForCountry.find((s) => s.name === stateName) || null : null),
    [selectedCountry, stateOptionsForCountry, stateName]
  )
  const cityNameOptions = useMemo(() => {
    if (!selectedCountry || !selectedState) return []
    return City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode).map((c) => c.name)
  }, [selectedCountry, selectedState])

  const availableDepartments = degree ? (departmentOptionsByDegree[degree] || []) : []

  const handleDegreeChange = (e) => {
    const value = e.target.value
    setDegree(value)
    const opts = departmentOptionsByDegree[value] || []
    setDepartment((prev) => (opts.includes(prev) ? prev : ''))
  }

  const handleImageChange = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validationId = profileImageValidationIdRef.current + 1
    profileImageValidationIdRef.current = validationId
    setError('')
    setIsValidatingProfileImage(true)
    setProfileImage(null)
    setPreview(null)
    try {
      await validateProfileImageFile(file)
      const stableFile = await createStableUploadFile(file)
      if (profileImageValidationIdRef.current !== validationId) return
      setProfileImage(stableFile)
      setPreview(URL.createObjectURL(stableFile))
      enqueueSnackbar('Profile photo added successfully.', { variant: 'success' })
    } catch (imageError) {
      if (profileImageValidationIdRef.current !== validationId) return
      e.target.value = ''
      setProfileImage(null)
      setPreview(null)
      const msg = imageError?.message || 'Please upload a valid profile photo.'
      setError(msg)
      enqueueSnackbar(msg, { variant: 'error' })
    } finally {
      if (profileImageValidationIdRef.current === validationId) setIsValidatingProfileImage(false)
    }
  }, [enqueueSnackbar])

  const handleExperienceChange = (index, field, value) => {
    setWorkExperiences((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }
  const addExperience = () => setWorkExperiences((prev) => [...prev, { id: nextExperienceId(), ...emptyExperience }])
  const removeExperience = (id) =>
    setWorkExperiences((prev) => (prev.length > 1 ? prev.filter((exp) => exp.id !== id) : prev))

  const buildWorkPayload = () => {
    if (skipEmployment) return []
    return workExperiences
      .filter((w) => (w.isStartup ? w.startupName.trim() : (w.company.trim() || w.designation.trim())))
      .map((w) =>
        w.isStartup
          ? { isStartup: true, startupName: w.startupName.trim(), startupType: w.startupType.trim(), company: null, designation: null, industry: null, experience: null }
          : { isStartup: false, company: w.company.trim(), designation: w.designation.trim(), industry: w.industry.trim(), experience: w.experience ? Number(w.experience) : null, startupName: null, startupType: null }
      )
  }

  // Returns an error string for the first unmet REQUIRED field, or null.
  const validate = () => {
    if (isValidatingProfileImage) return 'Please wait while we validate your profile photo.'
    if (!profileImage && !existingImageUrl) return 'Profile photo is required. Please upload a valid image.'
    if (!name.trim()) return 'Full name is required.'
    if (!degree) return 'Please select your degree.'
    if (!department) return 'Please select your department.'
    if (!yearOfCompletion) return 'Year of completion is required.'
    if (!rollNumber.trim()) return 'Roll number is required.'
    if (!addressLine.trim()) return 'Address is required.'
    if (!country.trim()) return 'Country is required.'
    if (!stateName.trim()) return 'State is required.'
    if (!city.trim()) return 'City is required.'
    if (!/^\d{6}$/.test(pincode.trim())) return 'PIN code must be 6 digits.'
    if (!linkedinUrl.trim()) return 'LinkedIn profile URL is required.'
    const normalizedLinkedin = normalizeLinkedInUrl(linkedinUrl)
    if (!isValidLinkedInUrl(normalizedLinkedin)) return 'Please enter a valid LinkedIn URL.'
    if (!skipEmployment) {
      const hasAtLeastOne = workExperiences.some((w) => w.company.trim() || (w.isStartup && w.startupName.trim()))
      if (!hasAtLeastOne) return 'Please add at least one work experience or check "Currently not working".'
      for (let i = 0; i < workExperiences.length; i++) {
        const w = workExperiences[i]
        if (w.isStartup) {
          if (!w.startupName.trim()) return `Business / startup name is required for experience #${i + 1}.`
        } else if (w.company.trim() && !w.designation.trim()) {
          return `Designation is required for experience #${i + 1}.`
        }
      }
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      enqueueSnackbar(validationError, { variant: 'error' })
      return
    }

    setIsSubmitting(true)

    // Upload a newly chosen photo; otherwise reuse the existing (seed) image.
    let imageUrl = existingImageUrl
    if (profileImage) {
      try {
        const uploadResult = await uploadAlumniImage(profileImage, 'profile')
        imageUrl = uploadResult.publicUrl || null
      } catch (uploadError) {
        setError(uploadError?.message || 'Could not upload profile image.')
        setIsSubmitting(false)
        return
      }
    }

    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      degree,
      department,
      yearOfCompletion: Number(yearOfCompletion),
      rollNumber: rollNumber.trim(),
      address: {
        line1: addressLine.trim(),
        city: city.trim(),
        state: stateName.trim(),
        country: country.trim(),
        pincode: pincode.trim(),
      },
      image: imageUrl,
      linkedinUrl: normalizeLinkedInUrl(linkedinUrl) || null,
      workExperiences: buildWorkPayload(),
    }

    try {
      await completeRegistration(payload)
    } catch (saveError) {
      setIsSubmitting(false)
      if (saveError?.status === 401) {
        setError('Your session expired. Please login again.')
        navigate('/login', { replace: true })
        return
      }
      const msg = saveError?.details?.[0]?.message || saveError?.message || 'Unable to save your profile.'
      setError(msg)
      enqueueSnackbar(msg, { variant: 'error' })
      return
    }

    setIsSubmitting(false)
    clearProfilePrefill()
    // Mark success so the app-level guards let us through to the dashboard while
    // the registration flag refreshes in the background.
    safeSessionStorageSet('reg_success', '1')
    // Flip the navbar's cached registration flag now and tell it to re-check, so
    // the nav entry switches from "Alumni Registration" → "My Profile"
    // immediately instead of staying stale until a re-login. (Cache key must
    // match REG_STATUS_CACHE_PREFIX in Navbar.jsx.)
    const userId = getUser()?.id
    if (userId) safeLocalStorageSet(`smvec_reg_status_${userId}`, '1')
    window.dispatchEvent(new Event('registration:changed'))
    enqueueSnackbar('Successfully verified', { variant: 'success' })
    setTimeout(() => navigate('/alumni-space', { replace: true }), 1200)
  }

  if (isChecking) {
    return (
      <div className="reg-page-loading">
        <div className="reg-page-spinner" aria-hidden="true" />
      </div>
    )
  }

  const photoSrc = preview || existingImageUrl || null

  return (
    <div className="registration-page page-content">
      <div className="registration-container">
        <div className="registration-header">
          <h1>Complete Your Profile</h1>
          <p>Review your details and fill in anything that's missing to continue.</p>
        </div>

        <div className="registration-card">
          {error && <p style={{ color: '#e74c3c', marginBottom: '12px' }}>{error}</p>}

          <form onSubmit={handleSubmit} noValidate>
            {/* ── Profile photo ── */}
            <h3 className="section-title">Profile Photo</h3>
            <div className="photo-upload">
              <div className="photo-preview">
                {photoSrc ? <img src={photoSrc} alt="Profile" /> : <HiUser />}
              </div>
              <div className="photo-actions">
                <label className="upload-btn">
                  <HiCamera /> {isValidatingProfileImage ? 'Verifying...' : (photoSrc ? 'Change Photo' : 'Upload Photo *')}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} disabled={isValidatingProfileImage} />
                </label>
                <p>JPG, PNG, or WEBP, max 3MB.</p>
              </div>
            </div>

            {/* ── Personal ── */}
            <h3 className="section-title section-title--spaced">Personal Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
              </div>
            </div>

            {/* ── Education ── */}
            <h3 className="section-title section-title--spaced">Education Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Degree *</label>
                <CustomSelect name="degree" value={degree} onChange={handleDegreeChange} options={degrees} placeholder="Select Degree" required />
              </div>
              <div className="form-group">
                <label>Department *</label>
                <CustomSelect name="department" value={department} onChange={(e) => setDepartment(e.target.value)} options={availableDepartments} placeholder="Select Department" required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Year of Completion *</label>
                <CustomSelect name="yearOfCompletion" value={yearOfCompletion} onChange={(e) => setYearOfCompletion(e.target.value)} options={completionYears} placeholder="Select Year" required />
              </div>
              <div className="form-group">
                <label>Roll Number *</label>
                <input type="text" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="Your roll / enrolment number" required />
              </div>
            </div>

            {/* ── Address ── */}
            <h3 className="section-title section-title--spaced">Present Residential Details</h3>
            <div className="form-group">
              <label>Address *</label>
              <textarea value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="Street address" rows={3} {...NO_AUTOFILL} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Country *</label>
                <AutoSuggestInput
                  value={country}
                  onChange={(val) => { setCountry(val); setStateName(''); setCity('') }}
                  suggestions={countryNameOptions}
                  placeholder="Country"
                  required
                  strict
                />
              </div>
              <div className="form-group">
                <label>State *</label>
                <AutoSuggestInput
                  value={stateName}
                  onChange={(val) => { setStateName(val); setCity('') }}
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
                  value={city}
                  onChange={(val) => setCity(val)}
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
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="PIN / ZIP code"
                  inputMode="numeric"
                  maxLength={6}
                  {...NO_AUTOFILL}
                  required
                />
              </div>
            </div>

            {/* ── Work (optional) ── */}
            <h3 className="section-title section-title--spaced">Work Experience</h3>
            <label className="skip-employment-check">
              <input type="checkbox" checked={skipEmployment} onChange={(e) => setSkipEmployment(e.target.checked)} />
              <span>Currently not working / I prefer not to mention</span>
            </label>

            {!skipEmployment && (
              <>
                <div className="work-experience-list">
                  {workExperiences.map((exp, index) => (
                    <div key={exp.id} className="experience-entry-shell">
                      <div className="experience-entry">
                        <div className="experience-entry-head">
                          <strong className="experience-entry-title">Experience {index + 1}</strong>
                          {workExperiences.length > 1 && (
                            <button type="button" onClick={() => removeExperience(exp.id)} className="experience-remove-btn">
                              <HiTrash />
                            </button>
                          )}
                        </div>

                        <label className="startup-experience-check">
                          <input type="checkbox" checked={Boolean(exp.isStartup)} onChange={(e) => handleExperienceChange(index, 'isStartup', e.target.checked)} />
                          <span>Startup / Own business</span>
                        </label>

                        {exp.isStartup ? (
                          <div className="form-row">
                            <div className="form-group">
                              <label>Business / Startup Name</label>
                              <input type="text" value={exp.startupName} onChange={(e) => handleExperienceChange(index, 'startupName', e.target.value)} placeholder="Your business or startup name" />
                            </div>
                            <div className="form-group">
                              <label>Type of Business / Startup</label>
                              <input type="text" value={exp.startupType} onChange={(e) => handleExperienceChange(index, 'startupType', e.target.value)} placeholder="e.g. SaaS, D2C, Consulting" />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="form-row">
                              <div className="form-group">
                                <label>Company / Organization</label>
                                <AutoSuggestInput value={exp.company} onChange={(val) => handleExperienceChange(index, 'company', val)} suggestions={companies} placeholder="Current employer" renderIcon />
                              </div>
                              <div className="form-group">
                                <label>Designation</label>
                                <AutoSuggestInput value={exp.designation} onChange={(val) => handleExperienceChange(index, 'designation', val)} suggestions={designations} placeholder="Your job title" />
                              </div>
                            </div>
                            <div className="form-row">
                              <div className="form-group">
                                <label>Industry</label>
                                <AutoSuggestInput value={exp.industry} onChange={(val) => handleExperienceChange(index, 'industry', val)} suggestions={industries} placeholder="e.g. IT, Healthcare" showOnFocus />
                              </div>
                              <div className="form-group">
                                <label>Years of Experience</label>
                                <input type="number" value={exp.experience} onChange={(e) => handleExperienceChange(index, 'experience', e.target.value)} placeholder="e.g. 5" min="0" />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addExperience} className="experience-add-btn">
                  <HiPlus /> Add More Experience
                </button>
              </>
            )}

            {/* ── LinkedIn (optional) ── */}
            <h3 className="section-title section-title--spaced">LinkedIn</h3>
            <div className="form-group">
              <label>LinkedIn URL</label>
              <input type="text" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://www.linkedin.com/in/your-profile" />
            </div>

            <div className="form-actions">
              <span />
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || isValidatingProfileImage}>
                {isSubmitting ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  )
}

export default CompleteProfile

import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import {
    HiLocationMarker,
    HiMail,
    HiPhone,
    HiBriefcase,
    HiAcademicCap,
    HiArrowLeft,
    HiOutlineOfficeBuilding,
    HiCamera,
    HiGlobe,
    HiUserGroup,
    HiExternalLink,
} from 'react-icons/hi'
import { FaLinkedinIn } from "react-icons/fa";

import { getAlumniById, setAlumniDisabled, updateAlumni } from '../../lib/alumniApi'
import { fetchDirectoryPage } from '../../lib/directoryApi'
import { verifySession } from '../../lib/auth'
import { isStudentRegistered } from '../../lib/studentRegistration'
import CompanyLogo from '../../components/CompanyLogo'
import { useDirectoryNavbar } from '../../context/navbarState'
import { uploadAlumniImage } from '../../lib/imageUpload'
import { normalizeLinkedInUrl } from '../../lib/profileLinks'
import { useProtectedImageUrl, useProtectedImageUrls } from '../../hooks/useProtectedImageUrl'
import './Index.css'

const MAX_COVER_IMAGE_SIZE = 3 * 1024 * 1024

function SuggestedAlumniItem({
    person,
    alumniDepartment,
    getCurrentRole,
    getEmploymentSummary,
    getFullNameOf,
    getInitials,
    protectedProfileImageUrl,
}) {
    const suggestedRole = getCurrentRole(person)
    const suggestedSummary = getEmploymentSummary(person)

    return (
        <Link
            to={`/directory/alumni/${person.id}`}
            className="suggested-item"
        >
            <div className="suggested-avatar">
                {protectedProfileImageUrl ? (
                    <img src={protectedProfileImageUrl} alt={getFullNameOf(person)} />
                ) : (
                    <div className="suggested-avatar-fallback">{getInitials(person)}</div>
                )}
            </div>
            <div className="suggested-info">
                <h4>{getFullNameOf(person)}</h4>
                {suggestedSummary ? (
                    <p className="suggested-company-line">
                        <span className="suggested-company-logo-wrap">
                            <CompanyLogo
                                company={suggestedRole?.company}
                                className="company-logo-img"
                                fallback={<HiOutlineOfficeBuilding />}
                            />
                        </span>
                        <span>{suggestedSummary}</span>
                    </p>
                ) : (
                    <p>{person.department || 'Alumni'}</p>
                )}
                {person.department === alumniDepartment && (
                    <span className="suggested-badge">Same Department</span>
                )}
            </div>
        </Link>
    )
}

function AlumniDetail() {
    const { id } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { enqueueSnackbar } = useSnackbar()
    const [alumni, setAlumni] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [authResolved, setAuthResolved] = useState(false)
    const [currentUser, setCurrentUser] = useState(null)
    const [viewerHasDirectoryAccess, setViewerHasDirectoryAccess] = useState(false)
    const [isOwnProfile, setIsOwnProfile] = useState(false)
    const [coverUploading, setCoverUploading] = useState(false)
    const [suggestedAlumni, setSuggestedAlumni] = useState([])
    const [searchInput, setSearchInput] = useState('')
    const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)
    const [statusMutating, setStatusMutating] = useState(false)
    const [statusError, setStatusError] = useState('')
    const coverInputRef = useRef(null)
    const lastAvatarTapRef = useRef(0)

    const isStaff = currentUser?.role === 'staff'
    const resolvedCoverImageUrl = useProtectedImageUrl(alumni?.cover_image_url)
    const resolvedAlumniProfileImageUrl = useProtectedImageUrl(alumni?.profile_image_url)
    const suggestedImageSources = useMemo(
        () => suggestedAlumni.map((person) => person.profile_image_url).filter(Boolean),
        [suggestedAlumni],
    )
    const protectedSuggestedImageUrls = useProtectedImageUrls(suggestedImageSources)

    useEffect(() => {
        let mounted = true

        const init = async () => {
            const user = await verifySession()
            if (!mounted) return

            setCurrentUser(user)

            if (!user) {
                setViewerHasDirectoryAccess(false)
                setAuthResolved(true)
                navigate('/login', { replace: true })
                return
            }

            if (user.role === 'staff') {
                setViewerHasDirectoryAccess(true)
                setAuthResolved(true)
                return
            }

            const { registered } = await isStudentRegistered(user)
            if (!mounted) return
            setViewerHasDirectoryAccess(Boolean(registered))
            setAuthResolved(true)
        }

        init()
        return () => { mounted = false }
    }, [navigate])

    useEffect(() => {
        document.body.style.overflow = avatarPreviewOpen ? 'hidden' : ''
        return () => {
            document.body.style.overflow = ''
        }
    }, [avatarPreviewOpen])

    useEffect(() => {
        if (!avatarPreviewOpen) return undefined

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setAvatarPreviewOpen(false)
            }
        }

        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [avatarPreviewOpen])

    useEffect(() => {
        let mounted = true
        if (!authResolved || !id) return undefined

        const fetchAlumniDetail = async () => {
            setLoading(true)
            setError('')

            let data
            try {
                data = await getAlumniById(id)
            } catch (fetchError) {
                if (!mounted) return
                setLoading(false)
                if (fetchError?.status === 404) {
                    setAlumni(null)
                    setError('This alumni profile is currently hidden by staff.')
                } else {
                    setError(fetchError.message || 'Unable to load profile.')
                }
                return
            }

            if (!mounted) return
            setLoading(false)

            if (!data) {
                setError('Profile not found.')
                return
            }

            const viewerIsOwner = Boolean(currentUser && data.user_id === currentUser.id)
            setIsOwnProfile(viewerIsOwner)

            setAlumni(data)

            // Fetch suggested alumni (same department, different person)
            fetchSuggestedAlumni(data)
        }

        const fetchSuggestedAlumni = async (currentAlumni) => {
            try {
                const page = await fetchDirectoryPage({
                    user: currentUser,
                    page: 1,
                    limit: 20,
                    filters: currentAlumni.department ? { dept: currentAlumni.department } : {},
                    departmentTerm: currentAlumni.department || '',
                })
                if (!mounted) return
                const suggested = (page.rows || [])
                    .filter((a) => a.id !== id)
                    .slice(0, 5)
                setSuggestedAlumni(suggested)
            } catch {
                // Suggestions are best-effort.
            }
        }

        fetchAlumniDetail()

        return () => { mounted = false }
    }, [id, currentUser, authResolved])

    const handleCoverUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file || !alumni) return
        if (!currentUser || !isOwnProfile) return
        if (file.size > MAX_COVER_IMAGE_SIZE) {
            enqueueSnackbar('Cover image must be 3MB or less.', { variant: 'error' })
            return
        }

        setCoverUploading(true)

        let coverUrl = ''
        try {
            const uploadResult = await uploadAlumniImage(file, 'cover')
            coverUrl = uploadResult.publicUrl || ''
        } catch (uploadError) {
            setCoverUploading(false)
            enqueueSnackbar(uploadError?.message || 'Failed to upload cover photo.', { variant: 'error' })
            return
        }

        if (!coverUrl) {
            setCoverUploading(false)
            enqueueSnackbar('Failed to upload cover photo. Please try again.', { variant: 'error' })
            return
        }

        try {
            await updateAlumni(alumni.id, { cover_image_url: coverUrl })
        } catch (updateError) {
            setCoverUploading(false)
            enqueueSnackbar(updateError?.message || 'Failed to update cover photo.', { variant: 'error' })
            return
        }

        setCoverUploading(false)
        setAlumni(prev => ({ ...prev, cover_image_url: coverUrl }))
        enqueueSnackbar('Cover photo updated.', { variant: 'success' })
    }

    const handleBackToDirectory = () => {
        if (location.state?.fromDirectory && window.history.length > 1) {
            navigate(-1)
            return
        }

        navigate('/directory')
    }

    const handleToggleProfileStatus = async () => {
        if (!isStaff || !alumni) return

        setStatusError('')
        setStatusMutating(true)
        const nextDisabledState = !alumni.is_disabled

        let updatedRow
        try {
            updatedRow = await setAlumniDisabled(alumni.id, nextDisabledState)
        } catch (updateError) {
            setStatusMutating(false)
            setStatusError(updateError.message || 'Unable to update alumni visibility.')
            return
        }

        setStatusMutating(false)
        setAlumni((prev) => (prev ? { ...prev, is_disabled: Boolean(updatedRow?.is_disabled) } : prev))
    }

    const openAvatarPreview = () => {
        if (!alumni?.profile_image_url) return
        setAvatarPreviewOpen(true)
    }

    const handleAvatarTouchEnd = (event) => {
        if (!alumni?.profile_image_url) return
        const now = Date.now()
        const DOUBLE_TAP_MS = 280

        if (now - lastAvatarTapRef.current <= DOUBLE_TAP_MS) {
            event.preventDefault()
            openAvatarPreview()
            lastAvatarTapRef.current = 0
            return
        }

        lastAvatarTapRef.current = now
    }

    useDirectoryNavbar({
        searchValue: searchInput,
        onSearchChange: setSearchInput,
        loading,
    })

    if (loading) {
        return (
            <AlumniDetailSkeleton />
        )
    }

    if (error || !alumni) {
        return (
            <div className="alumni-detail-page page-content">
                <div className="container">
                    <div className="directory-error" style={{ marginTop: '50px' }}>
                        {error || 'Alumni not found.'}
                    </div>
                    <button type="button" onClick={handleBackToDirectory} className="btn btn-primary" style={{ marginTop: '20px' }}>
                        <HiArrowLeft className="icon-mr" /> Back to Directory
                    </button>
                </div>
            </div>
        )
    }

    const getFullName = () => [alumni.first_name, alumni.last_name].filter(Boolean).join(' ') || 'Unknown'
    const getInitials = (person = alumni) => {
        const first = (person.first_name ?? '').charAt(0).toUpperCase()
        return first || '?'
    }
    const getFullNameOf = (person) => [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unknown'

    const getLocation = () => {
        return [alumni.city, alumni.state, alumni.country].filter(Boolean).join(', ')
    }

    const getHeadline = () => {
        const parts = []
        if (alumni.designation) parts.push(alumni.designation)
        if (alumni.industry) parts.push(alumni.industry)
        if (alumni.department) parts.push(alumni.department)

        if (Array.isArray(alumni.work_experiences) && alumni.work_experiences.length > 0) {
            const latest = alumni.work_experiences[0]
            if (latest.is_startup) {
                const name = latest.startup_name || 'Own business'
                const type = latest.startup_type ? ` | ${latest.startup_type}` : ''
                return `Founder, ${name}${type}`
            }
            if (latest.designation) {
                const headline = latest.designation + (latest.company ? ` | ${latest.company}` : '')
                return headline
            }
        }

        if (parts.length > 0) return parts.join(' | ')
        return alumni.degree ? `${alumni.degree} - ${alumni.department}` : ''
    }

    const currentJob = () => {
        if (Array.isArray(alumni.work_experiences) && alumni.work_experiences.length > 0) {
            return alumni.work_experiences[0]
        }
        if (alumni.company || alumni.designation) {
            return {
                company: alumni.company,
                designation: alumni.designation,
                from_year: alumni.experience ? 'Past' : '',
            }
        }
        return null
    }

    const previousJobs = () => {
        if (Array.isArray(alumni.work_experiences) && alumni.work_experiences.length > 1) {
            return alumni.work_experiences.slice(1)
        }
        return []
    }

    const job = currentJob()
    const past = previousJobs()
    const canShowPhone = Boolean(alumni.phone) && (
        isOwnProfile || (alumni.show_phone && viewerHasDirectoryAccess)
    )
    const linkedInUrl = normalizeLinkedInUrl(alumni.linkedin_url)

    const getEmploymentSummary = (row) => {
        if (Array.isArray(row.work_experiences) && row.work_experiences.length > 0) {
            const latest = row.work_experiences[0]
            if (latest.company && latest.designation) return `${latest.designation} @ ${latest.company}`
            return latest.company || latest.designation || null
        }
        if (row.company && row.designation) return `${row.designation} @ ${row.company}`
        return row.company || row.designation || null
    }

    const getCurrentRole = (row) => {
        if (Array.isArray(row.work_experiences) && row.work_experiences.length > 0) {
            const latest = row.work_experiences[0]
            if (!latest) return null
            return {
                company: latest.company || '',
                designation: latest.designation || '',
            }
        }
        if (row.company || row.designation) {
            return {
                company: row.company || '',
                designation: row.designation || '',
            }
        }
        return null
    }

    return (
        <div className="alumni-detail-page page-content">
            {/* <div className="alumni-detail-header-bg"></div> */}

            <div className="container">
                <button type="button" onClick={handleBackToDirectory} className="back-link">
                    <HiArrowLeft /> Back to Directory
                </button>

                <div className="profile-linkedin-layout">
                    {/* Main Column */}
                    <div className="profile-main-column">

                        {/* Top Card - Cover, Avatar, Core Info */}
                        <div className="profile-top-card card">
                            {/* Cover Photo */}
                            <div
                                className="profile-cover"
                                style={resolvedCoverImageUrl ? { backgroundImage: `url(${resolvedCoverImageUrl})` } : {}}
                            >
                                {isOwnProfile && (
                                    <button
                                        className="cover-upload-btn"
                                        onClick={() => coverInputRef.current?.click()}
                                        disabled={coverUploading}
                                    >
                                        <HiCamera /> {coverUploading ? 'Uploading...' : 'Edit cover photo'}
                                    </button>
                                )}
                                <input
                                    type="file"
                                    ref={coverInputRef}
                                    onChange={handleCoverUpload}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                />
                            </div>

                            {/* Avatar */}
                            <div
                                className={`profile-avatar-wrapper${resolvedAlumniProfileImageUrl ? ' profile-avatar-wrapper--zoomable' : ''}`}
                                onDoubleClick={openAvatarPreview}
                                onTouchEnd={handleAvatarTouchEnd}
                                role={resolvedAlumniProfileImageUrl ? 'button' : undefined}
                                tabIndex={resolvedAlumniProfileImageUrl ? 0 : undefined}
                                aria-label={resolvedAlumniProfileImageUrl ? 'Double tap to preview profile photo' : undefined}
                                onKeyDown={(event) => {
                                    if (!resolvedAlumniProfileImageUrl) return
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        openAvatarPreview()
                                    }
                                }}
                            >
                                {resolvedAlumniProfileImageUrl ? (
                                    <img src={resolvedAlumniProfileImageUrl} alt={getFullName()} className="profile-avatar-img" />
                                ) : (
                                    <div className="profile-avatar-fallback">{getInitials()}</div>
                                )}
                            </div>

                            {/* Core Info */}
                            <div className="profile-core-info">
                                <div className="profile-info-left">
                                    <h1 className="profile-name">{getFullName()}</h1>
                                    {isStaff && alumni.is_disabled === true && (
                                        <span className="profile-status-chip">Disabled</span>
                                    )}
                                    <p className="profile-headline">{getHeadline()}</p>
                                    {getLocation() && (
                                        <p className="profile-location">
                                            <HiLocationMarker /> {getLocation()}
                                        </p>
                                    )}
                                    {linkedInUrl && (
                                        <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className="profile-linkedin-link">
                                            <HiExternalLink /> LinkedIn Profile
                                        </a>
                                    )}
                                </div>

                                <div className="profile-info-right">
                                    {isStaff && (
                                        <button
                                            type="button"
                                            className={`profile-status-btn ${alumni.is_disabled === true ? 'profile-status-btn--enable' : 'profile-status-btn--disable'}${statusMutating ? ' profile-status-btn--loading' : ''}`}
                                            onClick={handleToggleProfileStatus}
                                            disabled={statusMutating}
                                        >
                                            {statusMutating ? (
                                                alumni.is_disabled === true ? 'Enabling...' : 'Disabling...'
                                            ) : (
                                                alumni.is_disabled === true ? 'Enable Alumni' : 'Disable Alumni'
                                            )}
                                        </button>
                                    )}
                                    {statusError && <p className="profile-status-error">{statusError}</p>}
                                    {job && (job.is_startup ? job.startup_name : job.company) && (
                                        <div className="profile-org-item">
                                            <div className="org-logo org-logo--company">
                                                <CompanyLogo
                                                    company={job.is_startup ? job.startup_name : job.company}
                                                    className="company-logo-img"
                                                    fallback={<HiBriefcase />}
                                                />
                                            </div>
                                            <span>{job.is_startup ? job.startup_name : job.company}</span>
                                        </div>
                                    )}
                                    <div className="profile-org-item">
                                        <div className="org-logo org-logo--edu">
                                            <HiAcademicCap />
                                        </div>
                                        <span>Manakula Vinayagar Institute of Technology</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            {/* <div className="profile-action-bar">
                                {linkedInUrl && (
                                    <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className="btn-profile btn-profile-primary">
                                        <HiExternalLink /> View LinkedIn Profile
                                    </a>
                                )}
                            </div> */}
                        </div>

                        {/* Highlights Card */}
                        <div className="profile-section-card card">
                            <h3 className="section-heading">Highlights</h3>
                            <div className="highlights-grid">
                                {alumni.department && (
                                    <div className="highlight-item">
                                        <div className="highlight-icon-wrap highlight-icon-wrap--education">
                                            <HiAcademicCap />
                                        </div>
                                        <div className="highlight-text">
                                            <strong>{alumni.department}</strong>
                                            <span>{alumni.degree} - Batch of {alumni.year_of_completion || 'N/A'}</span>
                                        </div>
                                    </div>
                                )}
                                {alumni.industry && (
                                    <div className="highlight-item">
                                        <div className="highlight-icon-wrap highlight-icon-wrap--industry">
                                            <HiOutlineOfficeBuilding />
                                        </div>
                                        <div className="highlight-text">
                                            <strong>{alumni.industry}</strong>
                                            <span>Industry</span>
                                        </div>
                                    </div>
                                )}
                                {alumni.experience && (
                                    <div className="highlight-item">
                                        <div className="highlight-icon-wrap highlight-icon-wrap--experience">
                                            <HiBriefcase />
                                        </div>
                                        <div className="highlight-text">
                                            <strong>{alumni.experience}</strong>
                                            <span>Experience</span>
                                        </div>
                                    </div>
                                )}
                                {alumni.year_of_completion && (
                                    <div className="highlight-item">
                                        <div className="highlight-icon-wrap highlight-icon-wrap--batch">
                                            <HiUserGroup />
                                        </div>
                                        <div className="highlight-text">
                                            <strong>Batch of {alumni.year_of_completion}</strong>
                                            <span>MVIT Alumni</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* About Card */}
                        {(alumni.about || alumni.bio) && (
                            <div className="profile-section-card card">
                                <h3 className="section-heading">About</h3>
                                <p className="about-text">{alumni.about || alumni.bio}</p>
                            </div>
                        )}

                        {/* Experience Card */}
                        <div className="profile-section-card card">
                            <h3 className="section-heading"><HiBriefcase /> Experience</h3>

                            {job ? (
                                <div className="experience-list">
                                    <div className="experience-item">
                                        <div className="exp-logo">
                                            <CompanyLogo
                                                company={job.is_startup ? job.startup_name : job.company}
                                                className="company-logo-img company-logo-img--lg"
                                                fallback={<HiOutlineOfficeBuilding />}
                                            />
                                        </div>
                                        <div className="exp-details">
                                            <h4>
                                                {job.is_startup
                                                    ? (job.startup_name || 'Own business')
                                                    : (job.designation || 'Role not specified')}
                                                {job.is_startup && <span className="exp-startup-tag">Startup / Own Business</span>}
                                            </h4>
                                            <p className="exp-company">
                                                {job.is_startup
                                                    ? (job.startup_type ? `Type: ${job.startup_type}` : 'Founder')
                                                    : (job.company || 'Company not specified')}
                                            </p>
                                            {(job.from_year || job.to_year) && (
                                                <p className="exp-dates">
                                                    {job.from_year || ''} - {job.to_year || 'Present'}
                                                </p>
                                            )}
                                            {job.description && <p className="exp-desc">{job.description}</p>}
                                        </div>
                                    </div>

                                    {past.map((prevJob, idx) => (
                                        <div className="experience-item" key={idx}>
                                            <div className="exp-logo">
                                                <CompanyLogo
                                                    company={prevJob.is_startup ? prevJob.startup_name : prevJob.company}
                                                    className="company-logo-img company-logo-img--lg"
                                                    fallback={<HiOutlineOfficeBuilding />}
                                                />
                                            </div>
                                            <div className="exp-details">
                                                <h4>
                                                    {prevJob.is_startup
                                                        ? (prevJob.startup_name || 'Own business')
                                                        : (prevJob.designation || 'Role not specified')}
                                                    {prevJob.is_startup && <span className="exp-startup-tag">Startup / Own Business</span>}
                                                </h4>
                                                <p className="exp-company">
                                                    {prevJob.is_startup
                                                        ? (prevJob.startup_type ? `Type: ${prevJob.startup_type}` : 'Founder')
                                                        : (prevJob.company || 'Company not specified')}
                                                </p>
                                                {(prevJob.from_year || prevJob.to_year) && (
                                                    <p className="exp-dates">
                                                        {prevJob.from_year || ''} - {prevJob.to_year || 'Present'}
                                                    </p>
                                                )}
                                                {prevJob.description && <p className="exp-desc">{prevJob.description}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted">No professional experience listed.</p>
                            )}
                        </div>

                        {/* Education Card */}
                        <div className="profile-section-card card">
                            <h3 className="section-heading"><HiAcademicCap /> Education</h3>

                            <div className="experience-list">
                                <div className="experience-item">
                                    <div className="exp-logo edu-logo">
                                        <HiAcademicCap />
                                    </div>
                                    <div className="exp-details">
                                        <h4>Manakula Vinayagar Institute of Technology</h4>
                                        <p className="exp-company">{alumni.degree} in {alumni.department}</p>
                                        {alumni.year_of_completion && (
                                            <p className="exp-dates">Batch of {alumni.year_of_completion}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Sidebar */}
                    <div className="profile-sidebar-column">

                        {/* Contact Card */}
                        <div className="sidebar-card card">
                            <h3 className="sidebar-title">Contact Information</h3>
                            <ul className="contact-list">
                                {alumni.email && (isOwnProfile || alumni.show_email !== false) && (
                                    <li>
                                        <HiMail className="contact-icon" />
                                        <div className="contact-info">
                                            <span className="contact-label">Email</span>
                                            <a href={`mailto:${alumni.email}`}>{alumni.email}</a>
                                        </div>
                                    </li>
                                )}
                                {canShowPhone && (
                                    <li>
                                        <HiPhone className="contact-icon" />
                                        <div className="contact-info">
                                            <span className="contact-label">Phone</span>
                                            <a href={`tel:${alumni.phone}`}>{alumni.phone}</a>
                                        </div>
                                    </li>
                                )}
                                {getLocation() && (
                                    <li>
                                        <HiLocationMarker className="contact-icon" />
                                        <div className="contact-info">
                                            <span className="contact-label">Location</span>
                                            <span>{getLocation()}</span>
                                        </div>
                                    </li>
                                )}
                                {/* {linkedInUrl && (
                                    <li>
                                        <HiGlobe className="contact-icon" />
                                        <div className="contact-info">
                                            <span className="contact-label">LinkedIn</span>
                                            <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">View Profile</a>
                                        </div>
                                    </li>
                                )} */}
                            </ul>
                        </div>

                        {/* Suggested Alumni Card */}
                        {suggestedAlumni.length > 0 && (
                            <div className="sidebar-card card">
                                <h3 className="sidebar-title">Suggested Alumni for You</h3>
                                <div className="suggested-list">
                                    {suggestedAlumni.map((person) => (
                                        <SuggestedAlumniItem
                                            key={person.id}
                                            person={person}
                                            protectedProfileImageUrl={protectedSuggestedImageUrls[person.profile_image_url] || ''}
                                            alumniDepartment={alumni.department}
                                            getCurrentRole={getCurrentRole}
                                            getEmploymentSummary={getEmploymentSummary}
                                            getFullNameOf={getFullNameOf}
                                            getInitials={getInitials}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {avatarPreviewOpen && resolvedAlumniProfileImageUrl && (
                <div
                    className="avatar-preview-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Profile photo preview"
                    onClick={() => setAvatarPreviewOpen(false)}
                >
                    <button
                        type="button"
                        className="avatar-preview-close"
                        onClick={() => setAvatarPreviewOpen(false)}
                        aria-label="Close photo preview"
                    >
                        ×
                    </button>
                    <div className="avatar-preview-frame" onClick={(event) => event.stopPropagation()}>
                        <img src={resolvedAlumniProfileImageUrl} alt={getFullName()} />
                    </div>
                </div>
            )}
        </div>
    )
}

function AlumniDetailSkeleton() {
    return (
        <div className="alumni-detail-page alumni-detail-page--loading page-content">
            <div className="container">
                <div className="back-link profile-skeleton-back" aria-hidden="true">
                    <span className="profile-skeleton-line profile-skeleton-line--back" />
                </div>

                <div className="profile-linkedin-layout">
                    <div className="profile-main-column">
                        <div className="profile-top-card card profile-skeleton-card">
                            <div className="profile-skeleton-cover" />
                            <div className="profile-skeleton-avatar" />
                            <div className="profile-skeleton-content">
                                <span className="profile-skeleton-line profile-skeleton-line--title" />
                                <span className="profile-skeleton-line profile-skeleton-line--subtitle" />
                                <span className="profile-skeleton-line profile-skeleton-line--short" />
                            </div>
                        </div>

                        <div className="profile-section-card card profile-skeleton-section">
                            <span className="profile-skeleton-line profile-skeleton-line--heading" />
                            <div className="profile-skeleton-grid">
                                <span />
                                <span />
                                <span />
                                <span />
                            </div>
                        </div>

                        <div className="profile-section-card card profile-skeleton-section">
                            <span className="profile-skeleton-line profile-skeleton-line--heading" />
                            <span className="profile-skeleton-line" />
                            <span className="profile-skeleton-line profile-skeleton-line--subtitle" />
                            <span className="profile-skeleton-line profile-skeleton-line--short" />
                        </div>
                    </div>

                    <div className="profile-sidebar-column">
                        <div className="sidebar-card card profile-skeleton-section">
                            <span className="profile-skeleton-line profile-skeleton-line--heading" />
                            <span className="profile-skeleton-line" />
                            <span className="profile-skeleton-line profile-skeleton-line--subtitle" />
                            <span className="profile-skeleton-line profile-skeleton-line--short" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AlumniDetail

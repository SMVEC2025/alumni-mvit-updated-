import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  checkMobileStatus,
  login,
  normalizeMobile,
  sendOtp,
  setPassword,
  verifyOtp,
  verifySession,
} from '../../lib/auth'
import { isStudentRegistered } from '../../lib/studentRegistration'
import { useSnackbar } from 'notistack'

const OTP_LENGTH = 6
const OTP_RESEND_SECONDS = 59
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

// Cloudflare Turnstile widget. Renders explicitly so React owns its lifecycle.
// Calls onVerify(token) when solved, onExpire()/onError() to clear a stale token.
// The parent gets a reset() handle (via ref) to refresh the single-use token
// after each OTP send. Renders nothing when no site key is configured, so the
// login flow still works in environments without Turnstile set up.
const TurnstileWidget = forwardRef(function TurnstileWidget(
  { onVerify, onExpire, onError },
  ref
) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)

  useImperativeHandle(ref, () => ({
    reset() {
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.reset(widgetIdRef.current)
      }
    },
  }), [])

  // Keep the latest callbacks in a ref so the render effect can stay [] — it must
  // run exactly ONCE. Re-running it would render a second widget (double-solve).
  const cbRef = useRef({ onVerify, onExpire, onError })
  useEffect(() => {
    cbRef.current = { onVerify, onExpire, onError }
  }, [onVerify, onExpire, onError])

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined

    let cancelled = false
    // The render is deferred by a tick. In React 18 StrictMode (dev), the effect
    // runs twice with a synchronous mount→unmount→remount: deferring lets the
    // first pass's cleanup cancel its pending render BEFORE it fires, so the
    // widget is created exactly once — no double "Verifying…". The delay also
    // covers the async/defer Turnstile script not being ready yet.
    let rendering = false
    const render = () => {
      // Guard against a second render: once one widget exists (or one is being
      // created) never call render() again — that's what showed two challenges.
      if (cancelled || rendering || widgetIdRef.current !== null) return
      if (!window.turnstile || !containerRef.current) {
        timer = setTimeout(render, 150)
        return
      }
      rendering = true
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action: 'turnstile-spin-v1',
        appearance: 'always', // always show the widget (the "I'm not a robot" box)
        callback: (token) => cbRef.current.onVerify?.(token),
        'expired-callback': () => cbRef.current.onExpire?.(),
        'error-callback': () => cbRef.current.onError?.(),
      })
    }
    let timer = setTimeout(render, 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
    // Empty deps: render once on mount. Callbacks are read from cbRef.
  }, [])

  if (!TURNSTILE_SITE_KEY) return null
  return <div className="turnstile-widget" ref={containerRef} />
})

async function getRedirectPath(user) {
  if (user?.role === 'staff') {
    return '/directory'
  }

  // Registered users (registered_alumni exists) go to the alumni space; anyone
  // who verified but hasn't finished the profile step (pic/LinkedIn/employment)
  // is sent to /complete-profile to finish it.
  const { registered } = await isStudentRegistered(user)
  return registered ? '/alumni-space' : '/complete-profile'
}

// Turn an OTP-send failure into a clean, user-friendly message. The provider's
// raw rate-limit text ("OTP limit reached Pls try after 24hrs") is replaced with
// proper copy; network errors get a connectivity hint; anything else falls back
// to the backend's message.
function otpSendErrorMessage(err) {
  const status = err?.status
  const code = err?.code
  const raw = String(err?.message || '')

  if (status === 429 || code === 'RATE_LIMITED' || /limit reached|try after|too many/i.test(raw)) {
    return 'You\'ve requested too many OTPs for this number. Please wait a while and try again.'
  }
  if (status === 0 || code === 'NETWORK') {
    return 'Couldn\'t reach the server. Check your connection and try again.'
  }
  return raw || 'Failed to send OTP. Please try again.'
}

function Login() {
  const navigate = useNavigate()
  const otpRefs = useRef([])
  const { enqueueSnackbar } = useSnackbar()

  const [step, setStep] = useState('mobile')
  const [otpPurpose, setOtpPurpose] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [detectedRole, setDetectedRole] = useState('')
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [otpToken, setOtpToken] = useState('')
  const [password, setPasswordState] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [error, setError] = useState('')
  const [, setMessage] = useState('')
  const [otpResendSeconds, setOtpResendSeconds] = useState(0)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef(null)
  const isBusy = isLoading || isBootstrapping

  // Stable callbacks so the Turnstile widget isn't torn down on every render.
  const handleTurnstileVerify = useCallback((token) => setTurnstileToken(token || ''), [])
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(''), [])
  const handleTurnstileError = useCallback(() => setTurnstileToken(''), [])

  // The Turnstile token is single-use: after each send (success OR failure) the
  // backend consumes it, so reset the widget and clear local state to force a
  // fresh challenge for the next attempt.
  const resetTurnstile = useCallback(() => {
    setTurnstileToken('')
    turnstileRef.current?.reset()
  }, [])

  useEffect(() => {
    let mounted = true

    const checkExistingSession = async () => {
      try {
        const user = await verifySession()
        if (!mounted) return
        if (user) {
          const redirectPath = await getRedirectPath(user)
          navigate(redirectPath, { replace: true })
          return
        }
      } finally {
        if (mounted) setIsBootstrapping(false)
      }
    }

    checkExistingSession()
    return () => { mounted = false }
  }, [navigate])

  useEffect(() => {
    if (!/^\d{10}$/.test(mobileNumber)) {
      setDetectedRole('')
      return undefined
    }

    let active = true
    const timer = setTimeout(async () => {
      try {
        const status = await checkMobileStatus(mobileNumber)
        if (!active) return
        setDetectedRole(status?.role || '')
      } catch {
        if (!active) return
        setDetectedRole('')
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [mobileNumber])

  useEffect(() => {
    if (step !== 'otp' || isBusy) return
    const timer = setTimeout(() => focusOtpInput(0), 0)
    return () => clearTimeout(timer)
  }, [step, isBusy])

  useEffect(() => {
    if (step !== 'otp' || otpResendSeconds <= 0) return undefined

    const intervalId = setInterval(() => {
      setOtpResendSeconds((seconds) => (seconds <= 1 ? 0 : seconds - 1))
    }, 1000)

    return () => clearInterval(intervalId)
  }, [step, otpResendSeconds])

  const resetMessages = () => {
    setError('')
    setMessage('')
  }

  const resetOtp = () => {
    setOtpDigits(Array(OTP_LENGTH).fill(''))
  }

  const focusOtpInput = (index) => {
    const target = otpRefs.current[index]
    if (target) target.focus()
  }

  const handleMobileChange = (value) => {
    setMobileNumber(normalizeMobile(value))
  }

  const loadMobileStatus = async () => {
    const cleaned = normalizeMobile(mobileNumber)
    if (!/^\d{10}$/.test(cleaned)) {
      throw new Error('Please enter a valid 10-digit mobile number.')
    }

    const status = await checkMobileStatus(cleaned)
    setDetectedRole(status?.role || '')
    return status
  }

  const startOtpFlow = async (purpose, successMessage, captchaToken) => {
    const cleaned = normalizeMobile(mobileNumber)
    if (!/^\d{10}$/.test(cleaned)) {
      setError('Please enter a valid 10-digit mobile number.')
      return
    }

    // Send the OTP FIRST, then advance to the OTP screen only on success — so a
    // failure (e.g. rate limit) keeps the user on the number step with the error
    // visible, instead of flashing the OTP screen and bouncing back.
    setError('')
    setIsSendingOtp(true)
    try {
      const response = await sendOtp(cleaned, captchaToken)

      setOtpPurpose(purpose)
      setOtpDigits(Array(OTP_LENGTH).fill(''))
      setOtpToken(response?.challengeToken || '')
      setOtpResendSeconds(OTP_RESEND_SECONDS)
      setStep('otp')
      setMessage(successMessage || `OTP sent to ${cleaned}.`)
      setTimeout(() => focusOtpInput(0), 0)
      // Success: we leave the mobile step and the widget unmounts, so do NOT
      // reset it here — resetting would trigger a second, pointless "Verifying…".
    } catch (err) {
      setError(otpSendErrorMessage(err))
      // Failure: we stay on the mobile step. The Turnstile token is single-use
      // and already consumed by the attempt, so mint a fresh one for the retry.
      resetTurnstile()
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleContinue = async (e) => {
    e.preventDefault()
    resetMessages()

    // Require the captcha to be solved before requesting an OTP (when configured).
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Please complete the captcha to continue.')
      return
    }

    setIsLoading(true)
    try {
      const status = await loadMobileStatus()
      const purpose = status.has_password ? 'otp-login' : 'create-password'
      const successMessage = status.has_password
        ? 'OTP sent successfully. Verify OTP to login.'
        : 'OTP sent successfully. Verify OTP to continue.'
      setIsLoading(false)
      await startOtpFlow(purpose, successMessage, turnstileToken)
    } catch (err) {
      setError(err.message || 'Unable to continue right now.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoginViaOtp = async () => {
    resetMessages()

    setIsLoading(true)
    try {
      const status = await loadMobileStatus()
      setIsLoading(false)

      const purpose = status.has_password ? 'otp-login' : 'create-password'
      await startOtpFlow(purpose, 'OTP sent successfully.')
    } catch (err) {
      setError(err.message || 'Unable to send OTP.')
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    resetMessages()

    // Reachable from the mobile step (captcha visible) and the password step
    // (already captcha-verified via the pass cookie). Require a solved captcha
    // only when on the mobile step with the widget showing and no token yet.
    if (TURNSTILE_SITE_KEY && step === 'mobile' && !turnstileToken) {
      setError('Please complete the captcha to continue.')
      return
    }

    setIsLoading(true)
    try {
      const status = await loadMobileStatus()
      if (!status.user_exists || !status.has_password) {
        setError('No password found for this mobile number. Continue with OTP login.')
        setIsLoading(false)
        return
      }

      setIsLoading(false)
      await startOtpFlow('forgot-password', 'OTP sent for password reset.', turnstileToken)
    } catch (err) {
      setError(err.message || 'Unable to start forgot password flow.')
      setIsLoading(false)
    }
  }

  const handleUsePasswordLogin = () => {
    resetMessages()
    setStep('password')
    setMessage('Enter your password to continue. You can also switch back to OTP login.')
  }

  const handleOtpInputChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    if (!digit && value) return

    setOtpDigits((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })

    if (digit && index < OTP_LENGTH - 1) {
      focusOtpInput(index + 1)
    }
  }

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      focusOtpInput(index - 1)
    }
  }

  const handleOtpPaste = (event) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return

    const nextDigits = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((digit, index) => {
      nextDigits[index] = digit
    })

    setOtpDigits(nextDigits)
    const lastFilled = Math.min(pasted.length, OTP_LENGTH) - 1
    focusOtpInput(lastFilled >= 0 ? lastFilled : 0)
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    resetMessages()

    if (isSendingOtp) {
      setError('Please wait. OTP is being sent.')
      return
    }

    const enteredOtp = otpDigits.join('')
    if (!/^\d{6}$/.test(enteredOtp)) {
      setError('Please enter the 6-digit OTP.')
      return
    }


    const cleaned = normalizeMobile(mobileNumber)

    setIsLoading(true)
    try {
      // Verifying the OTP against the provider also logs the user in and
      // returns the authenticated session. The challenge token issued by
      // /send-otp is echoed back so verification is stateless. The response
      // also tells us whether this account has finished registration and (for
      // not-yet-registered accounts) carries any pre-fill captured silently.
      const verifyResult = await verifyOtp(enteredOtp, cleaned, otpToken)

      // Password reset always lands on the set-password screen.
      if (otpPurpose === 'forgot-password') {
        setStep('create-password')
        setPasswordState('')
        setConfirmPassword('')
        setMessage('OTP verified. Set a new password.')
        return
      }

      // New or recovered accounts (no completed registration) go straight to the
      // single completion form, which shows their pre-filled details. Already
      // registered users go to their normal destination.
      if (!verifyResult.registered) {
        navigate('/complete-profile', { replace: true })
        return
      }

      const redirectPath = await getRedirectPath(verifyResult.user)
      navigate(redirectPath, { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please check and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    resetMessages()

    if (!password) {
      setError('Please enter your password.')
      return
    }

    setIsLoading(true)
    try {
      const result = await login(mobileNumber, password)
      const redirectPath = await getRedirectPath(result.user)
      navigate(redirectPath, { replace: true })
    } catch (err) {
      setError(err.message || 'Unable to login with password.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSavePassword = async (e) => {
    e.preventDefault()
    resetMessages()

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      enqueueSnackbar(`Passwords do not match.`, { variant: 'error' })

      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      enqueueSnackbar(`Passwords do not match.`, { variant: 'error' })

      return
    }

    setIsLoading(true)
    try {
      const result = await setPassword(mobileNumber, password)
      const redirectPath = await getRedirectPath(result.user)
      navigate(redirectPath, { replace: true })
    } catch (err) {
      enqueueSnackbar(`${err.message || 'Could not save password.'}`, { variant: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkipPassword = async () => {
    resetMessages()

    if (otpPurpose === 'forgot-password') {

      enqueueSnackbar(`Skip is unavailable during password reset.`, { variant: 'error' })
      return
    }

    setIsLoading(true)
    try {
      // The user is already authenticated from the OTP verification step.
      const result = await verifySession()
      const redirectPath = await getRedirectPath(result)
      navigate(redirectPath, { replace: true })
    } catch (err) {
      enqueueSnackbar(`${err.message || 'Unable to continue with OTP login.'}`, { variant: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangeMobile = () => {
    resetMessages()
    resetOtp()
    setOtpToken('')
    setIsSendingOtp(false)
    setOtpResendSeconds(0)
    setPasswordState('')
    setConfirmPassword('')
    setOtpPurpose('')
    setDetectedRole('')
    setStep('mobile')
  }

  const loginTitle =
    detectedRole === 'staff'
      ? 'Staff Login / Register'
      : detectedRole === 'alumni'
        ? 'Alumni Login / Register'
        : 'Login / Register'


  const handleResendOtp = async () => {
    if (isSendingOtp || otpResendSeconds > 0) return
    resetMessages()
    await startOtpFlow(otpPurpose, 'OTP resent successfully.')
  }

  const formatOtpCountdown = (seconds) => `00:${String(seconds).padStart(2, '0')}`

  return (
    <div className="login-page page-content">
      <div className="login-container">
        <div className="login-brand-panel">
          <img className='login-overlay-image' src="/img/background/grain1.png" alt="" />
          {/* <img className='login-flower-image' src="/img/background/flower.png" alt="" /> */}
          {/* <div className="brand-arcs">
            <span className="arc arc-1" />
            <span className="arc arc-2" />
            <span className="arc arc-3" />
            <span className="arc arc-4" />
            <span className="arc arc-5" />
          </div> */}
          <div className="brand-content">
            <span className="brand-asterisk">✳</span>
            {/* <svg opacity={0.8} width="36" height="35" viewBox="0 0 36 35" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clip-path="url(#clip0_318_5)">
                <path d="M18.0751 0C16.1531 2.49688 13.4622 9.34907 18.0751 16.7828C19.7039 13.9067 21.9842 6.52349 18.0751 0Z" fill="#D8A228" />
                <path d="M2.149 8.48713C3.18839 10.8588 7.11203 15.5799 14.4914 15.4914C13.0516 13.1643 8.56723 8.50553 2.149 8.48713Z" fill="#D8A228" />
                <path d="M33.4333 9.19242C30.8226 8.75177 24.6173 9.38912 20.6813 15.4638C23.4713 15.5531 29.9277 14.424 33.4333 9.19242Z" fill="#D8A228" />
                <path d="M27.0638 2.58843C25.3494 3.38679 21.7866 6.28412 21.2498 11.4866C22.966 10.407 26.5314 7.11588 27.0638 2.58843Z" fill="#D8A228" />
                <path d="M8.45624 2.58843C10.1706 3.38679 13.7335 6.28412 14.2702 11.4866C12.5541 10.407 8.98865 7.11588 8.45624 2.58843Z" fill="#D8A228" />
                <path d="M5.02807 4.90077C5.93017 4.93824 7.88024 5.60117 8.46376 7.95317C7.54366 7.78316 5.56839 6.93466 5.02807 4.90077Z" fill="#D8A228" />
                <path d="M12.9887 0.24036C13.7603 0.696735 15.1396 2.193 14.4844 4.52705C13.7628 3.94613 12.4534 2.2755 12.9887 0.24036Z" fill="#D8A228" />
                <path d="M0.484659 12.9894C1.30495 12.6222 3.35106 12.3463 4.97314 14.1802C4.07468 14.4374 1.91914 14.5594 0.484659 12.9894Z" fill="#D8A228" />
                <path d="M30.8906 5.28114C29.9885 5.31861 28.0385 5.98154 27.4549 8.33354C28.375 8.16353 30.3503 7.31503 30.8906 5.28114Z" fill="#D8A228" />
                <path d="M22.9297 0.62122C22.1582 1.07759 20.7789 2.57386 21.4341 4.90791C22.1557 4.32699 23.465 2.65636 22.9297 0.62122Z" fill="#D8A228" />
                <path d="M35.4338 13.3693C34.6135 13.0021 32.5674 12.7262 30.9453 14.5601C31.8438 14.8173 33.9993 14.9392 35.4338 13.3693Z" fill="#D8A228" />
                <path d="M16.9435 34.5853C11.6107 34.5225 8.39528 32.5201 7.45418 31.5267L12.2381 26.7428C13.932 27.9976 16.2377 28.3113 17.1788 28.3113L16.9435 34.5853Z" fill="white" />
                <path d="M11.4538 26.2723L6.74836 30.8993C3.23495 28.5152 1.67692 25.1482 1.33708 23.7627H9.41479C9.79123 24.8293 10.931 25.8802 11.4538 26.2723Z" fill="white" />
                <path d="M8.86582 22.7432C7.9735 21.112 7.81434 18.9788 7.8463 18.1162H8.63036C8.94405 23.5118 12.1595 25.9586 13.7279 26.5076V17.3319H0.00386681C-0.0588727 19.7787 0.657403 21.9589 1.02338 22.7432H8.86582Z" fill="white" />
                <path d="M14.5906 26.7428V17.3319C14.5906 17.3319 17.0216 17.1751 17.1002 19.7631C17.1788 22.351 17.1002 27.2918 17.1002 27.2918C16.0336 27.4173 14.9827 26.9781 14.5906 26.7428Z" fill="white" />
                <path d="M18.1981 34.5068C23.5309 34.444 26.7463 32.4416 27.6874 31.4482L22.9035 26.6643C21.2096 27.9191 18.9039 28.2328 17.9628 28.2328L18.1981 34.5068Z" fill="white" />
                <path d="M23.6878 26.1938L28.3932 30.8208C31.9067 28.4367 33.4647 25.0697 33.8045 23.6842H25.7268C25.3504 24.7508 24.2106 25.8017 23.6878 26.1938Z" fill="white" />
                <path d="M26.2758 22.6647C27.1681 21.0335 27.3273 18.9003 27.2953 18.0377H26.5112C26.1975 23.4333 22.9821 25.8801 21.4137 26.4291V17.2534H35.1377C35.2005 19.7003 34.4842 21.8805 34.1182 22.6647H26.2758Z" fill="white" />
                <path d="M20.551 26.6643V17.2534C20.551 17.2534 18.0414 17.5671 18.0414 19.6846V27.2133C19.108 27.3388 20.1589 26.8996 20.551 26.6643Z" fill="white" />
              </g>
              <defs>
                <clipPath id="clip0_318_5">
                  <rect width="35.6049" height="34.6636" fill="white" />
                </clipPath>
              </defs>
            </svg> */}

            <h2 className="brand-title">
              <span>Hello</span>
              <br />MVIT Alumni
            </h2>
            <p className="brand-subtitle">
              Connect, network and grow with the MVIT alumni community. Your journey continues here.
            </p>
          </div>
          <div className="brand-footer">
            <p>© {new Date().getFullYear()} MVIT. All rights reserved.</p>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-card">
            <div className="login-header">
              <h2>
                {step === 'enroll' && 'Alumni Login / Register'}
                {step === 'enroll-channel' && 'Verify Your Identity'}
                {step === 'enroll-forgot' && 'Find Enrolment Number'}
                {step === 'mobile' && loginTitle}
                {step === 'password' && loginTitle}
                {step === 'otp' && loginTitle}
                {step === 'create-password' && 'Create Password'}
              </h2>
              {/* <p>{loginSubtitle}</p> */}
            </div>

            {isBusy ? (
              <div className="auth-common-loader">
                <div className="auth-common-spinner" aria-hidden="true" />
              </div>
            ) : (
              <>
                {error && <p className="auth-inline auth-inline--error">{error}</p>}

                {step === 'mobile' && (
                  <form className="login-form" onSubmit={handleContinue} noValidate>
                    <div className="form-group">
                      <label htmlFor="login-mobile">Mobile Number</label>
                      <input
                        id="login-mobile"
                        type="tel"
                        value={mobileNumber}
                        onChange={(event) => handleMobileChange(event.target.value)}
                        placeholder="Enter mobile number"
                        autoComplete="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        maxLength={10}
                        disabled={isLoading}
                        required
                      />
                    </div>

                    {/* Captcha appears once a full 10-digit number is entered,
                        and must be solved before an OTP can be requested. */}
                    {TURNSTILE_SITE_KEY && /^\d{10}$/.test(mobileNumber) && (
                      <div className="form-group turnstile-group">
                        <TurnstileWidget
                          ref={turnstileRef}
                          onVerify={handleTurnstileVerify}
                          onExpire={handleTurnstileExpire}
                          onError={handleTurnstileError}
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn-submit"
                      disabled={isLoading || (TURNSTILE_SITE_KEY && /^\d{10}$/.test(mobileNumber) && !turnstileToken)}
                    >
                      Continue
                    </button>

                    <div className="forgot-inline-wrap">
                      <button type="button" className="forgot-inline-link" disabled={isLoading} onClick={handleForgotPassword}>
                        Forgot password?
                      </button>
                    </div>
                  </form>
                )}

                {step === 'password' && (
                  <form className="login-form" onSubmit={handlePasswordLogin} noValidate>
                    <div className="form-group">
                      <label htmlFor="login-password">Password</label>
                      <div className="password-wrapper">
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => setPasswordState(event.target.value)}
                          placeholder="Enter password"
                          autoComplete="current-password"
                          disabled={isLoading}
                          required
                        />
                        <button
                          type="button"
                          className="eye-toggle"
                          onClick={() => setShowPassword((value) => !value)}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                    </div>

                    <button type="submit" className="btn-submit" disabled={isLoading}>
                      Login with Password
                    </button>
                    <div className="auth-link-row">
                      <button type="button" className="forgot-inline-link" disabled={isLoading} onClick={handleChangeMobile}>
                        Change Mobile Number
                      </button>
                      <button type="button" className="forgot-inline-link" disabled={isLoading} onClick={handleForgotPassword}>
                        Forgot password?
                      </button>
                    </div>
                    <div className="auth-separator"><span>OR</span></div>
                    <div className="alt-login-panel">
                      <div className="alt-login-copy">
                        <h4>Use OTP Instead</h4>
                        <p>Recommended for quick sign in without typing password.</p>
                      </div>
                      <button
                        type="button"
                        className="btn-alt-login"
                        disabled={isLoading}
                        onClick={handleLoginViaOtp}
                      >
                        Send OTP Login
                      </button>
                    </div>
                  </form>
                )}

                {step === 'otp' && (
                  <form className="login-form" onSubmit={handleVerifyOtp} noValidate>
                    <label className="otp-label">Enter OTP</label>
                    <div className="otp-inputs" onPaste={handleOtpPaste}>
                      {otpDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(element) => {
                            otpRefs.current[index] = element
                          }}
                          value={digit}
                          onChange={(event) => handleOtpInputChange(index, event.target.value)}
                          onKeyDown={(event) => handleOtpKeyDown(index, event)}
                          maxLength={1}
                          inputMode="numeric"
                          className="otp-slot"
                          autoFocus={index === 0}
                        // disabled={isLoading || isSendingOtp}
                        />
                      ))}
                    </div>

                    <button type="submit" className="btn-submit"
                    // disabled={isLoading || isSendingOtp || !serverOtp}
                    >
                      Verify OTP
                    </button>
                    <div className="otp-link-row">

                      <button
                        type="button"
                        className="forgot-inline-link"
                        disabled={isLoading || isSendingOtp || otpResendSeconds > 0}
                        onClick={handleResendOtp}
                      >
                        {otpResendSeconds > 0
                          ? `Resend OTP (${formatOtpCountdown(otpResendSeconds)})`
                          : 'Resend OTP'}
                      </button>
                      <button type="button" className="forgot-inline-link"
                        disabled={isLoading} onClick={handleChangeMobile}>
                        Change Mobile Number
                      </button>

                    </div>
                    {otpPurpose === 'otp-login' && (
                      <>
                        <div className="auth-separator"><span>OR</span></div>
                        <div className="alt-login-panel">
                          <div className="alt-login-copy">
                            <h4>Prefer Password Login?</h4>
                            <p>Use password as an alternate method for this account.</p>
                          </div>
                          <button
                            type="button"
                            className="btn-alt-login"
                            onClick={handleUsePasswordLogin}
                          >
                            Login with Password
                          </button>
                        </div>
                      </>
                    )}
                  </form>
                )}

                {step === 'create-password' && (
                  <form className="login-form" onSubmit={handleSavePassword} noValidate>
                    <div className="form-group">
                      <label htmlFor="create-password">New Password</label>
                      <input
                        id="create-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPasswordState(event.target.value)}
                        placeholder="Enter password (min 8 characters)"
                        autoComplete="new-password"
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="confirm-password">Confirm Password</label>
                      <input
                        id="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Confirm password"
                        autoComplete="new-password"
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <button type="submit" className="btn-submit" disabled={isLoading}>
                      Save Password
                    </button>
                    <button type="button" className="btn-submit btn-outline" disabled={isLoading} onClick={handleSkipPassword}>
                      Skip for now
                    </button>
                    <button type="button" className="btn-submit btn-outline" disabled={isLoading} onClick={handleChangeMobile}>
                      Cancel
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

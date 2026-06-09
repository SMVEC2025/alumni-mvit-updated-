import { forwardRef, useCallback } from 'react'
import { useSnackbar, SnackbarContent } from 'notistack'
import { HiCheckCircle, HiExclamationCircle, HiX } from 'react-icons/hi'

const CustomToast = forwardRef(({ id, message, variant = 'success', className, ...other }, ref) => {
  const { closeSnackbar } = useSnackbar()

  const handleDismiss = useCallback(() => {
    closeSnackbar(id)
  }, [id, closeSnackbar])

  const isError = variant === 'error'

  return (
    <SnackbarContent
      ref={ref}
      role="alert"
      className={`custom-toast-root${className ? ` ${className}` : ''}`}
      {...other}
    >
      <div className={`custom-toast custom-toast--${variant}`}>
        <div className="custom-toast__icon">
          {isError ? (
            <HiExclamationCircle className="custom-toast__icon--error" />
          ) : (
            <HiCheckCircle className="custom-toast__icon--success" />
          )}
        </div>
        <div className="custom-toast__content">
          <p className="custom-toast__message">{message}</p>
        </div>
        <button className="custom-toast__close" onClick={handleDismiss} aria-label="Close">
          <HiX />
        </button>
      </div>
    </SnackbarContent>
  )
})

CustomToast.displayName = 'CustomToast'
export default CustomToast

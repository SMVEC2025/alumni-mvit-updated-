import { useEffect, useRef, useState } from 'react'
import { NO_AUTOFILL } from '../lib/noAutofill'

function AutoSuggestInput({
  value,
  onChange,
  suggestions = [],
  placeholder = '',
  showOnFocus = false,
  renderIcon,
  inputMode,
  maxLength,
  required,
  name,
  strict = false,
  disabled = false,
}) {
  const [filtered, setFiltered] = useState([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const listRef = useRef(null)
  const justSelectedRef = useRef(false)

  const normalize = (s) => String(s).toLowerCase().trim()

  const filter = (query) => {
    if (!query.trim()) return showOnFocus ? suggestions : []
    const q = normalize(query)
    return suggestions.filter((s) => {
      const label = typeof s === 'string' ? s : s.label
      return normalize(label).includes(q)
    })
  }

  const handleInput = (e) => {
    const val = e.target.value
    setFiltered(filter(val))
    setOpen(true)
    setActiveIndex(-1)

    if (strict && val.trim()) {
      const exact = suggestions.find((s) => {
        const label = typeof s === 'string' ? s : s.label
        return normalize(label) === normalize(val.trim())
      })
      if (exact) {
        const canonical = typeof exact === 'string' ? exact : exact.label
        onChange(canonical)
        return
      }
    }

    onChange(val)
  }

  // Detect Chrome's autofill — it writes input.value via DOM without firing onChange.
  // A CSS keyframe targeting :-webkit-autofill fires onAnimationStart, which lets us
  // reconcile React state with the DOM-injected value.
  const handleAnimationStart = (e) => {
    if (e.animationName !== 'onAutoFillStart') return
    const domValue = e.target.value
    if (domValue && domValue !== value) {
      handleInput({ target: { value: domValue } })
    }
  }

  const handleFocus = () => {
    const result = filter(value)
    setFiltered(result)
    if (showOnFocus || value.trim()) setOpen(true)
  }

  const handleBlur = () => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false
      return
    }
    if (!strict) return
    const trimmed = String(value || '').trim()
    if (!trimmed) return

    const exact = suggestions.find((s) => {
      const label = typeof s === 'string' ? s : s.label
      return normalize(label) === normalize(trimmed)
    })
    if (exact) {
      const canonical = typeof exact === 'string' ? exact : exact.label
      if (canonical !== value) onChange(canonical)
      return
    }

    const topMatch = filter(trimmed)[0]
    if (topMatch) {
      const canonical = typeof topMatch === 'string' ? topMatch : topMatch.label
      onChange(canonical)
      return
    }

    onChange('')
  }

  const select = (item) => {
    const label = typeof item === 'string' ? item : item.label
    justSelectedRef.current = true
    onChange(label)
    setOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (!open || filtered.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0) select(filtered[activeIndex])
      else if (strict && filtered.length > 0) select(filtered[0])
      else setOpen(false)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex]
      if (item) item.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])


  return (
    <div className="autosuggest" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onAnimationStart={handleAnimationStart}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        name={name}
        // Suppress browser address autofill/suggestions in Chrome & Safari.
        {...NO_AUTOFILL}
        disabled={disabled}
      />
      {!disabled && open && filtered.length > 0 && (
        <ul className="autosuggest__list" ref={listRef}>
          {filtered.map((item, i) => {
            const label = typeof item === 'string' ? item : item.label
            const domain = typeof item === 'object' ? item.domain : null
            const logoUrl = typeof item === 'object'
              ? (item.logo_url || (domain ? `https://img.logo.dev/${domain}?token=pk_aEaIVlgYQ8WHNSlREeczoQ` : ''))
              : ''
            return (
              <li
                key={label}
                className={`autosuggest__item ${i === activeIndex ? 'autosuggest__item--active' : ''}`}
                onMouseDown={() => select(item)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {renderIcon && logoUrl && (
                  <img
                    className="autosuggest__logo"
                    src={logoUrl}
                    alt=""
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                )}
                <span>{label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default AutoSuggestInput

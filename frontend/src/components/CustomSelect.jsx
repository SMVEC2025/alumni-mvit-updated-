import { useEffect, useRef, useState } from 'react'
import { HiChevronDown } from 'react-icons/hi'

function CustomSelect({ value, onChange, options = [], placeholder = 'Select', name, required }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const listRef = useRef(null)

  const toggle = () => setOpen((prev) => !prev)

  const select = (option) => {
    onChange({ target: { name, value: option } })
    setOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
      } else if (activeIndex >= 0) {
        select(options[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
      } else {
        setActiveIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1))
    }
  }

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex]
      if (item) item.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

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
    <div className={`custom-select ${open ? 'custom-select--open' : ''}`} ref={wrapperRef}>
      <button
        type="button"
        className={`custom-select__trigger ${value ? 'custom-select__trigger--filled' : ''}`}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`custom-select__value ${!value ? 'custom-select__value--placeholder' : ''}`}>
          {value || placeholder}
        </span>
        <HiChevronDown className={`custom-select__arrow ${open ? 'custom-select__arrow--up' : ''}`} />
      </button>

      {/* Hidden native input for form validation */}
      {required && (
        <input
          tabIndex={-1}
          value={value}
          required={required}
          onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        />
      )}

      {open && (
        <ul className="custom-select__list" ref={listRef} role="listbox">
          {options.map((option, i) => (
            <li
              key={option}
              role="option"
              aria-selected={option === value}
              className={`custom-select__option ${option === value ? 'custom-select__option--selected' : ''} ${i === activeIndex ? 'custom-select__option--active' : ''}`}
              onMouseDown={() => select(option)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CustomSelect

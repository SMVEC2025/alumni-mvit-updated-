import { useCallback, useMemo, useState } from 'react'
import { DEFAULT_DIRECTORY_NAVBAR, NavbarContext } from './navbarState'

export function NavbarProvider({ children }) {
  const [directoryNavbar, setDirectoryNavbar] = useState(DEFAULT_DIRECTORY_NAVBAR)
  const resetDirectoryNavbar = useCallback(() => {
    setDirectoryNavbar(DEFAULT_DIRECTORY_NAVBAR)
  }, [])

  const value = useMemo(() => ({
    directoryNavbar,
    setDirectoryNavbar,
    resetDirectoryNavbar,
  }), [directoryNavbar, resetDirectoryNavbar])

  return (
    <NavbarContext.Provider value={value}>
      {children}
    </NavbarContext.Provider>
  )
}


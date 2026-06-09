import { createContext, useContext, useLayoutEffect } from 'react'

export const DEFAULT_DIRECTORY_NAVBAR = {
  searchValue: '',
  onSearchChange: null,
  searchPlaceholder: 'Search people, skills, companies...',
  mobileFilterNav: null,
  loading: false,
}

export const NavbarContext = createContext(null)

export function useNavbarContext() {
  const context = useContext(NavbarContext)
  if (!context) {
    throw new Error('useNavbarContext must be used within NavbarProvider')
  }
  return context
}

export function useDirectoryNavbar(config) {
  const { setDirectoryNavbar, resetDirectoryNavbar } = useNavbarContext()
  const {
    searchValue,
    onSearchChange,
    searchPlaceholder,
    mobileFilterNav,
    loading,
  } = config

  useLayoutEffect(() => {
    setDirectoryNavbar({
      ...DEFAULT_DIRECTORY_NAVBAR,
      searchValue,
      onSearchChange,
      searchPlaceholder,
      mobileFilterNav,
      loading,
    })
  }, [
    searchValue,
    onSearchChange,
    searchPlaceholder,
    mobileFilterNav,
    loading,
    setDirectoryNavbar,
  ])

  useLayoutEffect(() => resetDirectoryNavbar, [resetDirectoryNavbar])
}


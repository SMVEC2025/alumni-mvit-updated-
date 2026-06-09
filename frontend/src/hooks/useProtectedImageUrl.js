import { useEffect, useState } from 'react'
import { getProtectedImageUrl, getProtectedImageUrls } from '../lib/protectedImage'

export function useProtectedImageUrl(sourceUrl) {
  const [resolvedUrl, setResolvedUrl] = useState('')

  useEffect(() => {
    let mounted = true
    const normalizedSource = String(sourceUrl || '').trim()

    if (!normalizedSource) {
      queueMicrotask(() => {
        if (mounted) setResolvedUrl('')
      })
      return undefined
    }

    getProtectedImageUrl(normalizedSource)
      .then((url) => {
        if (mounted) setResolvedUrl(url || '')
      })
      .catch(() => {
        if (mounted) setResolvedUrl('')
      })

    return () => {
      mounted = false
    }
  }, [sourceUrl])

  return resolvedUrl
}

export function useProtectedImageUrls(sourceUrls) {
  const [resolvedUrls, setResolvedUrls] = useState({})

  useEffect(() => {
    let mounted = true
    const normalizedSources = (Array.isArray(sourceUrls) ? sourceUrls : [])
      .map((sourceUrl) => String(sourceUrl || '').trim())
      .filter(Boolean)

    if (normalizedSources.length === 0) {
      queueMicrotask(() => {
        if (mounted) setResolvedUrls({})
      })
      return undefined
    }

    getProtectedImageUrls(normalizedSources)
      .then((nextUrls) => {
        if (mounted) setResolvedUrls(nextUrls || {})
      })
      .catch(() => {
        if (mounted) setResolvedUrls({})
      })

    return () => {
      mounted = false
    }
  }, [sourceUrls])

  return resolvedUrls
}

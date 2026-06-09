function normalizeSourceUrl(sourceUrl) {
  return String(sourceUrl || '').trim()
}

export async function getProtectedImageUrl(sourceUrl) {
  return normalizeSourceUrl(sourceUrl)
}

export async function getProtectedImageUrls(sourceUrls) {
  const normalizedSources = Array.isArray(sourceUrls) ? sourceUrls : []

  return normalizedSources.reduce((acc, sourceUrl) => {
    const normalizedSource = normalizeSourceUrl(sourceUrl)
    if (normalizedSource) {
      acc[normalizedSource] = normalizedSource
    }
    return acc
  }, {})
}

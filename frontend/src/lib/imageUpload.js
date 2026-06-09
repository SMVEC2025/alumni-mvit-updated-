// Image upload — posts multipart to the API /images endpoint. The server
// validates the file (magic bytes, size) and uploads to object storage.
import { api } from './apiClient'

export async function createStableUploadFile(file) {
  if (!file) throw new Error('Image file is required.')
  const buffer = await file.arrayBuffer()
  return new File([buffer], file.name || 'upload-image', {
    type: file.type || 'application/octet-stream',
    lastModified: file.lastModified || Date.now(),
  })
}

export async function uploadAlumniImage(file, kind = 'profile') {
  if (!file) throw new Error('Image file is required.')
  if (!['profile', 'cover', 'post'].includes(kind)) throw new Error('Unsupported image type.')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('kind', kind)

  const data = await api.postForm('/images', formData)
  if (!data?.publicUrl) throw new Error('Image uploaded, but public URL was not returned.')
  return { publicUrl: data.publicUrl, key: data.key || '' }
}

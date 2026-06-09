// Alumni blog posts API — feed, CRUD, likes, moderation.
import { api } from './apiClient'
import { uploadAlumniImage } from './imageUpload'

export async function fetchPosts({ page = 1, limit = 10, search, tag, author, mine } = {}) {
  const query = { page, limit }
  if (search) query.search = search
  if (tag) query.tag = tag
  if (author) query.author = author
  if (mine) query.mine = true
  return api.get('/posts', { query })
}

export async function fetchPost(id) {
  const data = await api.get(`/posts/${id}`)
  return data.post
}

// Public, no-login read of a single shared blog.
export async function fetchPublicPost(id) {
  const data = await api.get(`/public/posts/${id}`)
  return data.post
}

export async function createPost({ title, body, coverImageUrl, tags }) {
  const data = await api.post('/posts', { title, body, coverImageUrl, tags })
  return data.post
}

export async function updatePost(id, patch) {
  const data = await api.patch(`/posts/${id}`, patch)
  return data.post
}

export async function deletePost(id) {
  return api.del(`/posts/${id}`)
}

export async function likePost(id) {
  return api.post(`/posts/${id}/like`)
}

export async function unlikePost(id) {
  return api.post(`/posts/${id}/unlike`)
}

export async function hidePost(id) {
  return api.post(`/posts/${id}/hide`)
}

export async function unhidePost(id) {
  return api.post(`/posts/${id}/unhide`)
}

// Upload a post cover image, returns its public URL.
export async function uploadPostCover(file) {
  const { publicUrl } = await uploadAlumniImage(file, 'post')
  return publicUrl
}

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

let _client = null
function client() {
  if (!env.s3Configured) {
    throw new HttpError(500, 'SERVER_ERROR', 'Image storage is not configured.')
  }
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    })
  }
  return _client
}

// Verify the file is genuinely an allowed image by inspecting magic bytes,
// not trusting the client-supplied MIME type.
const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/webp': (b) =>
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
}

export function detectImageType(buffer) {
  for (const [mime, test] of Object.entries(SIGNATURES)) {
    if (test(buffer)) return mime
  }
  return null
}

// Upload a buffer to a per-user namespaced key. Profile/cover images overwrite a
// single "current" object; post covers get a unique key per upload so a user can
// have many. Keys are always namespaced under the user's id.
export async function uploadImage({ userId, kind, buffer, contentType, uniqueId }) {
  let key
  if (kind === 'post') {
    key = `${userId}/posts/${uniqueId}`
  } else {
    const folder = kind === 'cover' ? 'covers' : 'profile'
    key = `${userId}/${folder}/current`
  }

  // Profile/cover images reuse a fixed key (…/current), so the URL is stable
  // across re-uploads — only the bytes change. `stale-while-revalidate` lets the
  // browser show its cached copy INSTANTLY (no reload flash on every visit) while
  // it revalidates in the background, so a freshly uploaded photo still appears
  // within a request or two. Post images get a unique key per upload and never
  // change, so they can cache for far longer.
  const cacheControl = kind === 'post'
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=300, stale-while-revalidate=86400'

  await client().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  )

  const base = env.S3_PUBLIC_BASE_URL.replace(/\/+$/, '')
  return { key, publicUrl: `${base}/${key}` }
}

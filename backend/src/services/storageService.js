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

  await client().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=60, must-revalidate',
    })
  )

  const base = env.S3_PUBLIC_BASE_URL.replace(/\/+$/, '')
  return { key, publicUrl: `${base}/${key}` }
}

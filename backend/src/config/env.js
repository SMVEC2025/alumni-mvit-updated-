import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

// Validate every required env var at boot. The server refuses to start if any
// critical secret is missing — fail closed, never run half-configured.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),

  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  // ── Auth cookie scoping (cross-subdomain in production) ──
  // When the frontend (app.yourdomain.com) and API (api.yourdomain.com) are on
  // different subdomains, the refresh-token cookie must be SameSite=None +
  // Secure and scoped to the shared parent domain to be sent on cross-site XHR.
  // Local dev keeps the stricter defaults (empty domain → host-only, 'strict').
  //   COOKIE_DOMAIN   e.g. ".yourdomain.com"  (leave empty for local/host-only)
  //   COOKIE_SAMESITE "strict" | "lax" | "none"  (use "none" for cross-subdomain)
  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),

  OTP_API_URL: z.string().url('OTP_API_URL must be a valid URL'),
  OTP_API_AUTH_KEY: z.string().min(1, 'OTP_API_AUTH_KEY is required'),
  OTP_TTL_SEC: z.coerce.number().int().positive().default(300),

  // Cloudflare Turnstile secret key — gates /otp/send so bots can't spam SMS.
  // Optional so the app boots in dev without it (verification is then skipped);
  // a boot warning fires when unset. MUST be set in production.
  TURNSTILE_SECRET_KEY: z.string().optional().default(''),

  CONTACT_ENC_KEY: z
    .string()
    .min(1, 'CONTACT_ENC_KEY is required')
    .refine(
      (v) => Buffer.from(v, 'base64').length === 32,
      'CONTACT_ENC_KEY must be base64 of exactly 32 bytes (run: openssl rand -base64 32)'
    ),

  ADMIN_MOBILE_NUMBERS: z.string().default(''),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().optional().default(465),
  SMTP_USER_NOTIFY: z.string().optional().default(''),
  SMTP_PASS_NOTIFY: z.string().optional().default(''),
  SMTP_USER_ACK: z.string().optional().default(''),
  SMTP_PASS_ACK: z.string().optional().default(''),
  COORDINATOR_EMAIL: z.string().optional().default(''),

  S3_ENDPOINT: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  S3_BUCKET: z.string().optional().default(''),
  S3_PUBLIC_BASE_URL: z.string().optional().default(''),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

const raw = parsed.data

const isProd = raw.NODE_ENV === 'production'

// SameSite=None is only valid when the cookie is also Secure (browsers reject
// None without Secure). In production we always send Secure cookies, so None is
// fine; in non-prod over http, fall back to 'lax' if None was requested so the
// cookie isn't silently dropped during local testing.
const cookieSameSite =
  raw.COOKIE_SAMESITE === 'none' && !isProd ? 'lax' : raw.COOKIE_SAMESITE

export const env = {
  ...raw,
  isProd,
  corsOrigins: raw.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  adminMobiles: raw.ADMIN_MOBILE_NUMBERS.split(',').map((s) => s.trim()).filter(Boolean),
  smtpConfigured: Boolean(raw.SMTP_HOST && raw.SMTP_USER_NOTIFY && raw.SMTP_PASS_NOTIFY),
  s3Configured: Boolean(raw.S3_ENDPOINT && raw.S3_ACCESS_KEY_ID && raw.S3_SECRET_ACCESS_KEY && raw.S3_BUCKET),
  // Normalised cookie settings consumed by auth.routes setAuthCookies().
  cookieDomain: raw.COOKIE_DOMAIN || undefined, // undefined ⇒ host-only cookie
  cookieSameSite,
}

// Loud warnings for optional-but-important integrations.
if (!env.s3Configured) console.warn('⚠️  S3/R2 not configured — image uploads will fail.')
if (!env.smtpConfigured) console.warn('⚠️  SMTP not configured — contact emails will not send.')
if (!env.TURNSTILE_SECRET_KEY) {
  console.warn('⚠️  TURNSTILE_SECRET_KEY not set — captcha check on /otp/send is DISABLED. Set it in production.')
}

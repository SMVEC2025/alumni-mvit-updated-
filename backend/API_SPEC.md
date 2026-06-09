# SMVEC Alumni Platform — Backend API Specification

**Stack:** Node.js + Express + MongoDB (Mongoose)
**Audience:** Backend engineering team
**Status:** Authoritative contract. The frontend builds against this; do not change a route or response shape without updating this doc.

A professional alumni network (LinkedIn-style): members authenticate by mobile number, build a profile, appear in a searchable directory, control the privacy of their contact details, upload profile/cover images, and contact the alumni cell. Staff/admins have elevated powers (moderation, message inbox).

---

## 0. Security Principles (non-negotiable)

These apply to **every** endpoint. They are the reason this backend exists.

1. **The browser holds no secrets and never touches the database.** The client knows exactly one thing: `API_BASE_URL`. All DB credentials, provider keys, and signing secrets live server-side only.
2. **Authentication is JWT.** Short-lived access token (15 min) + long-lived refresh token (30 days) stored in an **httpOnly, Secure, SameSite=Strict cookie**. The access token may also be sent as `Authorization: Bearer <token>`.
3. **Authorization is enforced in middleware, per request** — never trusted from the client. Identity (`userId`, `role`) comes from the verified token, never from the request body.
4. **Least privilege by default.** Every route declares exactly one of: `public`, `authenticated`, `ownerOrStaff`, `staff`, `admin`. No route is unprotected by accident.
5. **Privacy is enforced server-side.** `phone`/`email` are stripped from responses unless the profile owner opted in (`showPhone`/`showEmail`) — the client is never sent data it shouldn't render.
6. **Every input is validated** with a schema (zod) before it reaches business logic. Reject unknown fields. Never spread `req.body` into a DB write.
7. **Every mutating endpoint is rate-limited.** Auth/OTP endpoints aggressively so.
8. **Fail closed.** Missing token, invalid token, ambiguous ownership → `401/403`, never a silent pass.
9. **No internal detail leaks.** Errors return a safe message + code; stack traces and DB errors are logged server-side only.
10. **All secrets validated at boot.** Server refuses to start if any required env var is missing.

---

## 1. Global Conventions

### Base URL
```
https://api.alumni.smvec.ac.in/api
```

### Auth header
```
Authorization: Bearer <access_token>
```
Refresh token travels automatically as an httpOnly cookie (`refresh_token`). The access token may also be mirrored in a cookie for the web app; mobile clients use the header.

### Standard success envelope
```json
{ "ok": true, "data": { ... } }
```

### Standard error envelope
```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "Human readable", "details": [ ... ] } }
```

### Error codes
| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body/query failed schema validation |
| `UNAUTHENTICATED` | 401 | Missing/invalid/expired access token |
| `FORBIDDEN` | 403 | Authenticated but not allowed |
| `NOT_FOUND` | 404 | Resource does not exist (or hidden from caller) |
| `CONFLICT` | 409 | Duplicate (mobile, email, phone already exists) |
| `RATE_LIMITED` | 429 | Too many requests |
| `OTP_INVALID` | 400 | OTP wrong or expired |
| `SERVER_ERROR` | 500 | Unexpected; details logged, not returned |

### Protection levels (middleware)
| Level | Middleware | Rule |
|---|---|---|
| `public` | none | Anyone. Still rate-limited + validated. |
| `authenticated` | `requireAuth` | Valid access token required. |
| `ownerOrStaff` | `requireAuth` + `requireOwnerOrStaff` | Caller owns the resource **or** role ∈ {staff, admin}. |
| `staff` | `requireAuth` + `requireRole('staff','admin')` | Staff or admin. |
| `admin` | `requireAuth` + `requireRole('admin')` | Admin only (mobile in `ADMIN_MOBILE_NUMBERS`). |

### Rate-limit tiers (per IP, sliding window)
| Tier | Limit | Applied to |
|---|---|---|
| `otp` | 3 / 10 min, 10 / day per mobile | send-otp |
| `auth` | 8 / 15 min | login, verify-otp, set-password |
| `write` | 30 / min | profile create/update, contact, image |
| `read` | 120 / min | directory, profile reads |

---

## 2. Data Models (MongoDB collections)

> All timestamps are ISO-8601 UTC. `_id` is a UUID string (v4) so identities are stable and shareable.

### `users`
| Field | Type | Rules |
|---|---|---|
| `_id` | uuid | PK |
| `mobileNumber` | string | unique, `^[0-9]{10}$`, **indexed unique** |
| `passwordHash` | string\|null | bcrypt (cost ≥ 12); null = OTP-only account |
| `role` | enum | `alumni` \| `staff` \| `admin`, default `alumni` |
| `createdAt`,`updatedAt` | date | auto |

### `faculty`
Staff source-of-truth. Any mobile present here resolves to `staff` role.
| Field | Type | Rules |
|---|---|---|
| `_id` | uuid | PK |
| `employeeId` | string | unique |
| `name` | string | required |
| `mobileNumber` | string | unique, 10 digits |

### `sessions`
For device management (list/revoke "active sessions"). One row per refresh token.
| Field | Type | Rules |
|---|---|---|
| `_id` | uuid | = refresh-token id (jti) |
| `userId` | uuid | ref users, indexed |
| `tokenHash` | string | sha-256 of refresh token (never store raw) |
| `expiresAt` | date | indexed (TTL index auto-deletes) |
| `lastSeenAt` | date | |
| `browser`,`platform`,`deviceName`,`userAgent`,`ip` | string | metadata |

### `alumni` (the profile — one per user)
| Field | Type | Rules |
|---|---|---|
| `_id` | uuid | PK |
| `userId` | uuid | ref users, **unique**, indexed |
| `firstName`,`lastName` | string | required |
| `email` | string | email format, unique (case-insensitive), **private by default visible** |
| `phone` | string\|null | 10 digits, unique-if-present |
| `showPhone` | bool | default `false`; cannot be true if phone null |
| `showEmail` | bool | default `true` |
| `linkedinUrl` | string\|null | url |
| `degree`,`department` | string | |
| `yearOfCompletion` | int | 1950 ≤ y ≤ currentYear+1 |
| `rollNumber` | string | |
| `company`,`designation`,`industry` | string | |
| `experience` | number | years |
| `workExperiences` | array\<{company,title,from,to}\> | |
| `address`,`city`,`state`,`country` | string | |
| `pincode` | string | 6 digits |
| `profileImageUrl`,`coverImageUrl` | string | R2 URLs |
| `isDisabled` | bool | default false; staff moderation flag |
| `createdAt`,`updatedAt` | date | |

**Indexes:** `userId`(unique), `email`(unique, lower), `phone`(unique sparse), `{department, yearOfCompletion}`, `isDisabled`, `createdAt:-1`, plus a **text index** on `firstName,lastName,company,designation,city` for search.

### `contactMessages`
| Field | Type | Rules |
|---|---|---|
| `_id` | uuid | PK |
| `name`,`email`,`subject`,`message` | string (**encrypted at rest**, AES-256-GCM) | |
| `ipAddress`,`userAgent` | string | plaintext metadata |
| `status` | enum | `received`\|`emailed`\|`failed`\|`read` |
| `emailError` | string\|null | |
| `createdAt`,`readAt` | date | |

---

## 3. API Reference

Legend per endpoint: **Protection**, **Rate tier**, request, response, and the **server-side guarantees** (what protection actually does).

---

### 3.1 Authentication & Sessions

#### `POST /auth/otp/send`
Send a one-time password to a mobile number.
- **Protection:** `public` · **Rate:** `otp`
- **Body:** `{ "mobileNumber": "9876543210" }`
- **200:** `{ ok:true, data:{ challengeToken:"<provider token>", expiresInSec:300 } }`
- **Guarantees:** OTP is fully delegated to the external SMS provider (the provider both generates/sends the SMS **and** verifies it). The provider's `x-api-key` lives server-side only — never exposed to the browser. We pass through the provider's stateless `token` as `challengeToken` so the client echoes it back on verify; the actual OTP never touches our backend or DB. Provider cooldown is surfaced as `429 RATE_LIMITED`. Per-IP throttle layered on top.

#### `POST /auth/otp/verify`
Verify OTP, then log in or signal next step.
- **Protection:** `public` · **Rate:** `auth`
- **Body:** `{ "mobileNumber":"9876543210", "otp":"123456", "challengeToken":"..." }`
- **200:** `{ ok:true, data:{ accessToken, user:{ id, mobileNumber, role, hasPassword }, registered:bool } }` + sets `refresh_token` httpOnly cookie.
- **Guarantees:** OTP + `challengeToken` are verified by the external provider server-to-server. On success, a `users` row is upserted, role resolved from `faculty` collection / admin allowlist, JWT issued. Invalid codes return `400 OTP_INVALID`; brute-force throttled.

#### `POST /auth/login`
Password login.
- **Protection:** `public` · **Rate:** `auth`
- **Body:** `{ "mobileNumber":"...", "password":"..." }`
- **200:** `{ ok:true, data:{ accessToken, user } }` + refresh cookie.
- **Errors:** `401 UNAUTHENTICATED` for wrong password or no-password account (generic message — never reveal which).
- **Guarantees:** bcrypt compare (constant-time). Identical error + timing for "no such user" and "wrong password" to prevent user enumeration.

#### `POST /auth/password/set`
Set/create a password (after OTP). Doubles as signup completion.
- **Protection:** `authenticated` · **Rate:** `auth`
- **Body:** `{ "password":"min8chars" }`
- **200:** `{ ok:true, data:{ user } }`
- **Guarantees:** `userId` taken from token, **not** body. Password policy enforced (≥8, complexity). Re-hashed with bcrypt.

#### `POST /auth/password/change`
- **Protection:** `authenticated` · **Rate:** `auth`
- **Body:** `{ "currentPassword":"...", "newPassword":"..." }`
- **Guarantees:** Verifies current password unless account had none. On success, **revokes all other sessions** (forces re-login on other devices).

#### `POST /auth/refresh`
Exchange refresh cookie for a new access token.
- **Protection:** `public` (relies on httpOnly cookie) · **Rate:** `auth`
- **Guarantees:** Validates refresh token against `sessions.tokenHash`, checks expiry, **rotates** the refresh token (one-time-use; reuse detection revokes the family).

#### `GET /auth/me`
Return the current user (session verification).
- **Protection:** `authenticated` · **Rate:** `read`
- **200:** `{ ok:true, data:{ user, registered:bool } }`

#### `GET /auth/sessions`
List my active devices.
- **Protection:** `authenticated` · **Rate:** `read`
- **200:** `{ ok:true, data:{ sessions:[{ id, browser, platform, deviceName, lastSeenAt, createdAt, isCurrent }] } }`
- **Guarantees:** Only returns sessions where `session.userId === token.userId`.

#### `POST /auth/sessions/:id/revoke`
Revoke one device.
- **Protection:** `ownerOrStaff` (owner of that session) · **Rate:** `write`
- **Guarantees:** Verifies the target session belongs to the caller before deleting. Returns `revokedCurrent` flag.

#### `POST /auth/logout`
Revoke current session.
- **Protection:** `authenticated` · **Rate:** `write`

#### `POST /auth/logout-all`
Revoke every session for the user.
- **Protection:** `authenticated` · **Rate:** `write`

#### `GET /auth/mobile-status?mobileNumber=...`
Pre-login probe: does account exist, is it staff, does it have a password (drives the login UI).
- **Protection:** `public` · **Rate:** `auth`
- **200:** `{ ok:true, data:{ exists, isStaff, hasPassword } }`
- **Guarantees:** Returns booleans only — no PII. Rate-limited to blunt enumeration.

---

### 3.2 Directory (the searchable member list)

#### `GET /directory`
Paginated, filtered, searchable alumni directory.
- **Protection:** `authenticated` · **Rate:** `read`
- **Query:** `page, limit(≤50), search, dept, year, city, company, sortBy(name|company|recent), visibility(active|disabled — staff only)`
- **200:** `{ ok:true, data:{ rows:[AlumniCard], total, page, limit, hasMore } }`
- **Server-side guarantees (critical):**
  - Non-staff callers **only** receive `isDisabled:false` profiles. The `visibility=disabled` filter is ignored unless role ∈ {staff,admin}.
  - **Privacy stripping:** for each row, `phone` is omitted unless `showPhone===true`; `email` is omitted unless `showEmail===true`. Staff see contact info per policy (configurable).
  - Search is executed in the DB (text index + `$regex` for partials, `$elemMatch` on `workExperiences.company`), never by shipping all rows to the client.
  - `limit` is hard-capped server-side; pagination is mandatory (no unbounded scans).

`AlumniCard` = `{ id, firstName, lastName, department, degree, yearOfCompletion, company, designation, city, state, profileImageUrl, coverImageUrl, linkedinUrl, [email], [phone] }` (bracketed = privacy-gated).

#### `GET /directory/filters`
Distinct departments/years for filter dropdowns.
- **Protection:** `authenticated` · **Rate:** `read`
- **200:** `{ ok:true, data:{ departments:[...], years:[...] } }`
- **Guarantees:** Aggregation excludes disabled profiles for non-staff.

#### `GET /alumni/:id`
Single public profile.
- **Protection:** `authenticated` · **Rate:** `read`
- **200:** `{ ok:true, data:{ alumni:AlumniProfile } }`
- **Guarantees:** Same privacy stripping. Disabled profiles return `404` to non-staff (existence hidden). Owner always sees their own full record.

---

### 3.3 My Profile

#### `GET /me/registration`
Is the current user registered, and the profile if so.
- **Protection:** `authenticated` · **Rate:** `read`
- **200:** `{ ok:true, data:{ registered:bool, alumni:AlumniProfile|null } }`
- **Guarantees:** Resolves strictly by `token.userId`. Never leaks other users' rows.

#### `POST /alumni`
Create my alumni profile.
- **Protection:** `authenticated` · **Rate:** `write`
- **Body:** validated profile fields (no `userId`, no `role`, no `isDisabled`).
- **201:** `{ ok:true, data:{ alumni } }`
- **Guarantees:** `userId` is injected from the token — the client **cannot** create a profile for someone else. One profile per user (unique index → `409 CONFLICT`). Duplicate email/phone → `409`. `isDisabled` cannot be set by the client.

#### `PATCH /alumni/:id`
Update a profile.
- **Protection:** `ownerOrStaff` · **Rate:** `write`
- **Body:** partial profile fields.
- **Guarantees:** Caller must own `:id` or be staff/admin. Non-staff **cannot** modify `isDisabled`, `role`, `userId`. `showPhone` rejected if `phone` is null. Email/phone uniqueness re-checked.

#### `POST /alumni/:id/disable` · `POST /alumni/:id/enable`
Moderation toggle.
- **Protection:** `staff` · **Rate:** `write`
- **Guarantees:** Only staff/admin. Audit-logged (who, when, target).

---

### 3.4 Faculty

#### `POST /faculty`
Faculty self-registration (adds a mobile to the staff source list).
- **Protection:** `public` (or `admin` — **decide per policy**; default recommend `admin`) · **Rate:** `write`
- **Body:** `{ employeeId, name, mobileNumber }`
- **Guarantees:** Validates uniqueness of `employeeId`/`mobileNumber`. If made public, gate behind an invite/secret to prevent privilege escalation (anyone registering as faculty = becomes staff).

#### `GET /faculty`
- **Protection:** `staff` · **Rate:** `read`
- Lists faculty records.

---

### 3.5 Images

#### `POST /images`
Upload profile or cover image to object storage (Cloudflare R2 / S3-compatible).
- **Protection:** `authenticated` · **Rate:** `write`
- **Body:** `multipart/form-data` — `file`, `kind=profile|cover`
- **200:** `{ ok:true, data:{ publicUrl, key } }`
- **Guarantees:**
  - File type allowlist (`jpeg/png/webp`) checked by **magic bytes**, not just MIME header. Max 3 MB.
  - Storage key is namespaced to the caller: `${token.userId}/${kind}/current` — a user can **only** overwrite their own images.
  - Storage credentials server-side only; the client never sees them.
  - Optional: re-encode/strip EXIF server-side to remove GPS metadata.

---

### 3.6 Contact

#### `POST /contact`
Public contact form.
- **Protection:** `public` · **Rate:** `write` (tighten to 3/hour/IP)
- **Body:** `{ name, email, subject, message }`
- **200:** `{ ok:true, data:{ id, status:"received" } }`
- **Guarantees:** Strict validation + length caps. Message fields **encrypted at rest** (AES-256-GCM, key in env). Notification + acknowledgement emails sent via SMTP (server-side creds). Spam-throttled. IP/UA recorded for abuse tracing.

#### `GET /contact/messages`
Admin inbox.
- **Protection:** `admin` · **Rate:** `read`
- **200:** `{ ok:true, data:{ messages:[...] } }` (decrypted server-side)
- **Guarantees:** `admin` only (`ADMIN_MOBILE_NUMBERS` allowlist). Decryption happens server-side; the key never leaves the server. Capped at 500, newest first.

#### `POST /contact/messages/:id/read` · `DELETE /contact/messages/:id`
- **Protection:** `admin` · **Rate:** `write`
- Mark read / delete. Audit-logged.

---

## 4. Cross-Cutting Middleware (order matters)

```
1. helmet()                      // security headers, HSTS, no-sniff, frameguard
2. cors({ origin: ALLOWLIST })   // explicit origins only — never "*"
3. express.json({ limit:'1mb' }) // body size cap (multer handles uploads separately)
4. requestId + structured logger // every request traceable
5. rateLimit(tier)               // per-route tier
6. validate(schema)              // zod; reject unknown keys
7. requireAuth / requireRole     // identity + authorization
8. handler
9. errorHandler                  // safe envelope, logs internals, never leaks stack
```

**JWT details:** HS256 (or RS256 for multi-service) with `JWT_ACCESS_SECRET`; access TTL 15 min; refresh TTL 30 days, rotated on use, hashed in `sessions`. Payload: `{ sub:userId, role, jti }` — nothing sensitive.

---

## 5. Required Environment Variables (validated at boot — server won't start if missing)

```
NODE_ENV
PORT
MONGODB_URI
JWT_ACCESS_SECRET            # long random
JWT_REFRESH_SECRET           # long random, different from access
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
CORS_ALLOWED_ORIGINS         # comma-separated
OTP_PROVIDER_URL
OTP_API_USER
OTP_API_KEY
OTP_CHALLENGE_SECRET         # HMAC secret for stateless OTP
CONTACT_ENC_KEY             # 32-byte base64, AES-256-GCM
ADMIN_MOBILE_NUMBERS         # comma-separated 10-digit
SMTP_HOST, SMTP_PORT
SMTP_USER_NOTIFY, SMTP_PASS_NOTIFY
SMTP_USER_ACK, SMTP_PASS_ACK
COORDINATOR_EMAIL
S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_PUBLIC_BASE_URL
```

---

## 6. Endpoint Protection Matrix (quick reference)

| Method | Path | Protection | Rate |
|---|---|---|---|
| POST | /auth/otp/send | public | otp |
| POST | /auth/otp/verify | public | auth |
| POST | /auth/login | public | auth |
| POST | /auth/refresh | public(cookie) | auth |
| GET | /auth/mobile-status | public | auth |
| POST | /auth/password/set | authenticated | auth |
| POST | /auth/password/change | authenticated | auth |
| GET | /auth/me | authenticated | read |
| GET | /auth/sessions | authenticated | read |
| POST | /auth/sessions/:id/revoke | ownerOrStaff | write |
| POST | /auth/logout | authenticated | write |
| POST | /auth/logout-all | authenticated | write |
| GET | /directory | authenticated | read |
| GET | /directory/filters | authenticated | read |
| GET | /alumni/:id | authenticated | read |
| GET | /me/registration | authenticated | read |
| POST | /alumni | authenticated | write |
| PATCH | /alumni/:id | ownerOrStaff | write |
| POST | /alumni/:id/disable | staff | write |
| POST | /alumni/:id/enable | staff | write |
| POST | /faculty | admin (recommended) | write |
| GET | /faculty | staff | read |
| POST | /images | authenticated | write |
| POST | /contact | public | write |
| GET | /contact/messages | admin | read |
| POST | /contact/messages/:id/read | admin | write |
| DELETE | /contact/messages/:id | admin | write |

---

## 7. Build Order (team-parallelizable)

1. **Foundation** — server bootstrap, env validation, Mongo connection, middleware chain, error envelope, JWT utils, all Mongoose models. *(1 dev)*
2. **Auth module** — OTP send/verify, login, password set/change, refresh rotation, session list/revoke. *(1 dev)*
3. **Directory + Profile module** — directory search/filter/pagination, privacy stripping, profile CRUD, ownership checks. *(1 dev — largest)*
4. **Images + Contact** — R2 upload with magic-byte checks, encrypted contact store, SMTP, admin inbox. *(shared)*
5. **Hardening** — rate-limit tuning, audit logging, security review, load test the directory, then cut frontend over to `API_BASE_URL`.

Each module owns its `routes/`, `services/`, and tests. The contract in this doc is the integration boundary — agree on it first, then build in parallel.

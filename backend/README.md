# SMVEC Alumni Platform — Backend

Secure **Node.js + Express + MongoDB** backend for the SMVEC Alumni Platform.
All data access is server-side; the browser never touches the database and holds
no secrets. See [API_SPEC.md](./API_SPEC.md) for the full endpoint contract.

## Stack

- **Express** — HTTP server + routing
- **MongoDB / Mongoose** — data store (local MongoDB in dev)
- **JWT** — stateless access tokens (15 min) + rotating refresh tokens (30 days)
- **bcryptjs** — password hashing (cost 12)
- **zod** — request validation
- **helmet, cors, express-rate-limit** — security middleware
- **multer + @aws-sdk/client-s3** — image upload to R2/S3
- **nodemailer** — contact-form emails
- AES-256-GCM — contact messages encrypted at rest

## Security model

| Concern | How it's handled |
|---|---|
| AuthN | JWT access (Bearer/cookie) + httpOnly rotating refresh token |
| AuthZ | Per-route middleware: `public` / `authenticated` / `ownerOrStaff` / `staff` / `admin` |
| Privacy | `phone`/`email` stripped from responses unless owner opted in (server-side) |
| Privilege escalation | `isDisabled`/`userId`/`role` can never be set by the client (stripped in validation) |
| OTP | Delegated to external provider; provider key is server-side only |
| Brute force | Tiered rate limits (otp/auth/write/read) |
| Secrets at boot | Validated by zod — server refuses to start if misconfigured |
| Contact data | Encrypted at rest (AES-256-GCM); decryptable only by admins server-side |
| Image uploads | Magic-byte validation + per-user key namespacing |

## Prerequisites

- Node.js ≥ 20
- A local MongoDB instance (or any `MONGODB_URI`)

### Run MongoDB locally (Windows)

If the MongoDB service is installed but stopped, either start the service
(needs admin) or run `mongod` directly with a local data path:

```powershell
mongod --dbpath "D:\path\to\data" --port 27017 --bind_ip 127.0.0.1
```

## Setup

```bash
cd backend
cp .env.example .env        # then fill in real values
npm install
npm run seed                # optional: seeds a faculty + two demo alumni
npm run dev                 # or: npm start
```

Server starts on `http://localhost:4000` (`/api/health` to check).

## Environment variables

See [.env.example](./.env.example). Key ones:

| Var | Purpose |
|---|---|
| `MONGODB_URI` | Mongo connection string (`mongodb://127.0.0.1:27017/mvit_alumni`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets (long, random, distinct) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins |
| `OTP_API_URL` / `OTP_API_AUTH_KEY` | External OTP provider + its `x-api-key` |
| `CONTACT_ENC_KEY` | base64 of 32 bytes — AES-256-GCM key for contact messages |
| `ADMIN_MOBILE_NUMBERS` | Comma-separated admin mobile allowlist |
| `S3_*` | Cloudflare R2 / S3 credentials for image uploads |
| `SMTP_*` | Contact-form email delivery |

Generate secrets:
```bash
openssl rand -base64 48   # JWT secrets
openssl rand -base64 32   # CONTACT_ENC_KEY
```

## Project layout

```
src/
  config/env.js        # validated env (fail-closed at boot)
  db/mongo.js          # Mongoose connection
  models/              # User, Faculty, Session, Alumni, ContactMessage
  middleware/          # auth, validate, rateLimit, errorHandler
  routes/              # auth, directory, alumni, faculty, images, contact
  services/            # otp, session, role, user, directory, storage, email, contact
  utils/               # jwt, crypto, password, privacy, httpError, asyncHandler
  validators/          # zod schemas (+ snake_case ↔ camelCase normalisation)
  app.js               # express app + middleware chain
  server.js            # bootstrap + graceful shutdown
scripts/seed.js        # local seed data
```

## Roles

- **alumni** — default.
- **staff** — any mobile number present in the `faculty` collection.
- **admin** — any mobile number in `ADMIN_MOBILE_NUMBERS`.

Roles are resolved on login/verify, so promoting a mobile to faculty/admin takes
effect on the user's next session refresh.

## Notes for the team

- The frontend talks to this API exclusively (see `frontend/src/lib/apiClient.js`).
  It sends the access token as `Authorization: Bearer`; the refresh token is an
  httpOnly cookie this server sets.
- Faculty registration (`POST /faculty`) is **admin-only** by design — adding a
  mobile to faculty grants staff privileges, so it must not be self-service.
- Alumni responses use `snake_case` field names to match the existing frontend
  data contract; create/update accept both snake_case and camelCase.

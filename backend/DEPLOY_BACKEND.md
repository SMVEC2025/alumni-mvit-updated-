# Backend deployment — Cloudflare → Google Cloud Run → MongoDB Atlas

Deployment flow:

```
api.yourdomain.com
   ↓ Cloudflare (DNS, SSL, WAF, DDoS, Rate Limiting)
   ↓ Google Cloud Run (Node.js + Express container)
   ↓ MongoDB Atlas (database)
```

This app runs unchanged on Cloud Run (long-running Express server). `PORT` is
injected by Cloud Run; the app binds `0.0.0.0`; `SIGTERM` triggers graceful
shutdown; env is validated at boot (fails closed). Follow the steps in order.

---

## 0. Prerequisites

- Google Cloud project with **billing enabled**.
- `gcloud` CLI installed and authenticated: `gcloud auth login` then
  `gcloud config set project YOUR_PROJECT_ID`.
- A MongoDB Atlas account.
- Your domain on Cloudflare (nameservers pointed at Cloudflare).
- Generate production secrets now (keep them safe, never commit):
  ```bash
  openssl rand -base64 48   # JWT_ACCESS_SECRET
  openssl rand -base64 48   # JWT_REFRESH_SECRET
  openssl rand -base64 32   # CONTACT_ENC_KEY (must decode to exactly 32 bytes)
  ```

---

## 1. MongoDB Atlas

1. Create a cluster (the free M0 tier is fine to start).
2. **Database Access** → add a database user (username + strong password). Give
   it `readWrite` on the app database (e.g. `mvit_alumni`).
3. **Network Access** → IP allowlist. Cloud Run uses dynamic egress IPs, so either:
   - **Simplest:** allow `0.0.0.0/0` (anywhere). Safe *only* with a strong DB
     password + scoped user. OR
   - **Locked down (recommended for real prod):** set up a Cloud Run **VPC
     connector** with Cloud NAT (static egress IP) and allowlist that IP, or use
     Atlas Private Endpoint. (More setup; do the simple option first, harden later.)
4. **Connect** → "Drivers" → copy the connection string. It looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/mvit_alumni?retryWrites=true&w=majority
   ```
   Add the db name (`/mvit_alumni`) before the `?`. This is your `MONGODB_URI`.
5. (Optional) Seed/import data against Atlas from your machine:
   `MONGODB_URI="<atlas-uri>" npm run seed` (and import the alumni_records seed
   the same way you did locally).

---

## 2. Enable GCP APIs (one-time)

```bash
gcloud services enable run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
```

---

## 3. Store secrets in Secret Manager (recommended over plain env vars)

Create one secret per sensitive value:

```bash
printf '%s' 'mongodb+srv://...'            | gcloud secrets create MONGODB_URI       --data-file=-
printf '%s' '<jwt access secret>'          | gcloud secrets create JWT_ACCESS_SECRET --data-file=-
printf '%s' '<jwt refresh secret>'         | gcloud secrets create JWT_REFRESH_SECRET --data-file=-
printf '%s' '<base64 32-byte key>'         | gcloud secrets create CONTACT_ENC_KEY   --data-file=-
printf '%s' '<otp api key>'                | gcloud secrets create OTP_API_AUTH_KEY  --data-file=-
# Add S3_* and SMTP_* the same way if you use uploads / contact email.
```

Grant the Cloud Run runtime service account access (replace PROJECT_NUMBER):

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Deploy to Cloud Run

From the `backend/` directory. Two options — pick one.

### Option A — source deploy (uses the Dockerfile, simplest)

```bash
gcloud run deploy smvec-alumni-api \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 4 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production,OTP_TTL_SEC=300,ACCESS_TOKEN_TTL=15m,REFRESH_TOKEN_TTL=30d \
  --set-env-vars CORS_ALLOWED_ORIGINS=https://app.yourdomain.com \
  --set-env-vars COOKIE_DOMAIN=.yourdomain.com,COOKIE_SAMESITE=none \
  --set-env-vars OTP_API_URL=https://your-otp-provider/send \
  --set-env-vars ADMIN_MOBILE_NUMBERS=9xxxxxxxxx \
  --set-secrets MONGODB_URI=MONGODB_URI:latest,JWT_ACCESS_SECRET=JWT_ACCESS_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,CONTACT_ENC_KEY=CONTACT_ENC_KEY:latest,OTP_API_AUTH_KEY=OTP_API_AUTH_KEY:latest,TURNSTILE_SECRET_KEY=TURNSTILE_SECRET_KEY:latest
```

> Add `S3_*` and `SMTP_*` to `--set-env-vars`/`--set-secrets` if used.
> `--allow-unauthenticated` is correct here: Cloudflare + the app's own auth/JWT
> guard the API; Cloud Run IAM is not the auth layer.

### Option B — build & push, then deploy (more control)

```bash
# Create an Artifact Registry repo once:
gcloud artifacts repositories create smvec --repository-format=docker --location=asia-south1

# Build + push:
gcloud builds submit --tag asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/smvec/api:latest

# Deploy that image (same flags as Option A but use --image):
gcloud run deploy smvec-alumni-api \
  --image asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/smvec/api:latest \
  --region asia-south1 --allow-unauthenticated --port 8080 \
  --set-env-vars ... --set-secrets ...
```

After deploy, note the service URL: `https://smvec-alumni-api-xxxxx-el.a.run.app`.

### Smoke test

```bash
curl https://smvec-alumni-api-xxxxx-el.a.run.app/api/health
# → {"ok":true,"data":{"status":"up"}}
```

---

## 5. Cloudflare — point api.yourdomain.com at Cloud Run

1. **Map the domain.** Easiest: Cloud Run → your service → "Custom Domains" →
   add `api.yourdomain.com` (it gives you a DNS target). OR keep it
   Cloudflare-proxied (below).
2. In Cloudflare DNS, add a record for `api`:
   - **CNAME** `api` → `ghs.googlehosted.com` (if using Cloud Run domain
     mapping), **Proxied (orange cloud)**.
   - (If not using domain mapping, CNAME `api` → the run.app host, Proxied.)
3. **SSL/TLS** mode: **Full (strict)** — Cloud Run presents a valid cert, so
   strict works end-to-end.
4. **WAF / Rate Limiting:** add rules in the Cloudflare dashboard (Security →
   WAF). The app's in-process `express-rate-limit` still runs, but Cloudflare is
   your first line for abuse/DDoS. Suggested: a rate-limit rule on
   `/api/auth/*` (e.g. 20 req/min per IP).
5. Verify: `curl https://api.yourdomain.com/api/health`.

---

## 6. Post-deploy checklist

- [ ] `GET https://api.yourdomain.com/api/health` returns 200.
- [ ] Login from the deployed frontend works AND **stays logged in after 15 min**
      (proves the cross-subdomain refresh cookie flows — the SameSite=None +
      COOKIE_DOMAIN fix). Check the browser sends `refresh_token` to
      `api.yourdomain.com` on `/api/auth/refresh`.
- [ ] CORS: no console errors; `CORS_ALLOWED_ORIGINS` matches the real frontend
      origin exactly (scheme + host, no trailing slash).
- [ ] OTP verification is enforced — real SMS OTP only, no bypass (the
      `OTP_BYPASS` flag and `000000` master code have been removed).
- [ ] Image upload works (if S3_* set) — verify after deploy; large uploads are
      bounded by Cloud Run's request limits.
- [ ] Logs clean: `gcloud run services logs read smvec-alumni-api --region asia-south1`.
- [ ] MongoDB Atlas: connections succeed; Network Access allows Cloud Run.

---

## Notes / gotchas

- **Region:** `asia-south1` (Mumbai) is closest for India users; keep Atlas in
  the same/nearby region to minimise DB latency.
- **Cold starts:** `--min-instances 0` saves cost but adds a cold-start delay +
  a fresh Mongo connection on the first request. Set `--min-instances 1` to keep
  one warm if that matters.
- **Mongo pool:** `maxPoolSize` is 20 (mongo.js). With multiple Cloud Run
  instances each holding a pool, watch Atlas connection limits (M0 caps at ~500).
- **Don't log secrets:** the startup log no longer prints `MONGODB_URI`.
- **`tini`** in the Dockerfile forwards SIGTERM so graceful shutdown works on
  scale-in.

# Backend deployment — Render.com (interim) + MongoDB Atlas

Temporary hosting while GCP/Cloud Run billing is sorted. Render runs the Express
app natively (no Docker needed) and injects `PORT`; the app already binds
`0.0.0.0`, reads `PORT` from env, and shuts down gracefully on SIGTERM — so it's
ready as-is. Migrate to Cloud Run later (see DEPLOY_BACKEND.md).

```
<your-frontend>.pages.dev   (Cloudflare Pages)
        ↓ HTTPS
mvit-alumni-api.onrender.com (Render — Node/Express)
        ↓
MongoDB Atlas (mvit_alumni)
```

---

## 1. Push the repo (render.yaml is at the repo root)

Make sure the latest code — including `render.yaml` (repo root) — is pushed to
GitHub (`SMVEC2025/alumni-mvit-updated-`, branch `main`).

```bash
git add render.yaml backend/
git commit -m "Add Render deploy config"
git push origin main
```

---

## 2. Create the Render service

1. Go to **https://render.com** → sign up / log in (use GitHub login for easy
   repo access).
2. **New +** → **Blueprint**.
3. Connect the GitHub repo `alumni-mvit-updated-`. Render reads `render.yaml` and
   proposes a web service **mvit-alumni-api** (free plan, rooted at `backend/`).
4. Click **Apply** — it creates the service but will need the secret env vars
   before it can boot successfully (next step).

> If you prefer NOT to use the blueprint: New + → **Web Service** → connect repo →
> set **Root Directory** = `backend`, **Build** = `npm ci`, **Start** =
> `npm start`, **Health Check Path** = `/api/health`, plan = Free. Then add env
> vars manually (step 3).

---

## 3. Set environment variables (Render dashboard → service → Environment)

The non-secret ones come from `render.yaml`. Add these (the `sync:false` ones):

| Key | Value |
|---|---|
| `MONGODB_URI` | your Atlas URI (the `mvit_alumni` one from backend/.env) |
| `JWT_ACCESS_SECRET` | a fresh long random string (`openssl rand -base64 48`) |
| `JWT_REFRESH_SECRET` | a different fresh random string |
| `CONTACT_ENC_KEY` | base64 of exactly 32 bytes (`openssl rand -base64 32`) |
| `OTP_API_URL` | your OTP provider URL |
| `OTP_API_AUTH_KEY` | your OTP provider key |
| `ADMIN_MOBILE_NUMBERS` | admin mobile(s), comma-separated |
| `CORS_ALLOWED_ORIGINS` | **set after** the Pages URL is known, e.g. `https://mvit-alumni.pages.dev` |
| `S3_*` | Cloudflare R2 creds (if image uploads used) |
| `SMTP_*`, `COORDINATOR_EMAIL` | if contact emails used |

> Use FRESH production secrets — don't reuse the dev values that were shared in
> chat. Rotate the Atlas password too.

`COOKIE_SAMESITE=none` is already set in render.yaml (needed because the Pages
frontend and onrender.com API are different sites). `COOKIE_DOMAIN` stays unset.

---

## 4. Atlas network access

Render egress IPs are dynamic on the free plan, so in **MongoDB Atlas → Network
Access**, allow `0.0.0.0/0` (safe with a strong DB password). Already done if you
set it during Atlas setup.

---

## 5. Deploy & verify

1. Render auto-builds after env vars are saved (or click **Manual Deploy** →
   Deploy latest commit).
2. Watch the **Logs** tab — you want:
   `🚀 SMVEC Alumni API listening on port 10000 (env=production)` and a Mongo
   connect with no errors.
3. Your API URL is `https://mvit-alumni-api.onrender.com` (exact name shown in
   the dashboard).
4. Smoke test:
   ```
   curl https://mvit-alumni-api.onrender.com/api/health
   → {"ok":true,"data":{"status":"up"}}
   ```

---

## 6. After the frontend (Pages) is deployed

- Set `CORS_ALLOWED_ORIGINS` on Render to the exact Pages URL
  (`https://<project>.pages.dev`, no trailing slash) and save → Render redeploys.
- The frontend's `VITE_API_BASE_URL` must be
  `https://mvit-alumni-api.onrender.com/api` at build time.

---

## ⚠️ Free-plan notes (important)

- **Cold starts:** Render free web services **sleep after ~15 min idle** and take
  ~30–60s to wake on the next request. First load after idle will be slow. (Fine
  for a demo; upgrade or move to Cloud Run for production.)
- **Third-party cookies:** frontend `*.pages.dev` + API `*.onrender.com` are
  unrelated domains, so the refresh-token cookie is third-party. Some browsers
  block third-party cookies, which can break "stay logged in after 15 min". This
  resolves once both are subdomains of ONE custom domain
  (`app.` + `api.yourdomain.com`). Access-token (Bearer) calls work regardless.
- Atlas free M0 connection cap is ~500; fine for one Render instance.

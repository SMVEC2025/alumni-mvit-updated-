# Frontend deployment — Cloudflare Pages (free .pages.dev)

React + Vite SPA → Cloudflare Pages, via Git integration (auto-builds on push).
Backend is on Render for now (https://...onrender.com); custom domain comes later.

```
<project>.pages.dev   (Cloudflare Pages — React SPA, this app)
        ↓ HTTPS /api calls (VITE_API_BASE_URL)
mvit-alumni-api.onrender.com   (Render — Express API)
        ↓
MongoDB Atlas (mvit_alumni)
```

> **Order matters:** deploy the **Render backend first** (DEPLOY_RENDER.md) so you
> know the exact API URL, then set it here as `VITE_API_BASE_URL`.

---

## 1. Connect the repo to Cloudflare Pages

1. Go to **https://dash.cloudflare.com** → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**.
2. Authorize GitHub and pick `SMVEC2025/alumni-mvit-updated-`.
3. **Set up builds** — this repo is a **monorepo**, so configure carefully:
   | Field | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | `Vite` (or `None`) |
   | **Root directory** | `frontend` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   > Root directory = `frontend` is the key step — without it the build runs at
   > repo root (no package.json there) and fails.

---

## 2. Set the build-time environment variable

Pages → your project → **Settings** → **Environment variables** → **Production**:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://mvit-alumni-api.onrender.com/api` |

> Use the EXACT Render URL (from DEPLOY_RENDER.md step 5) + `/api`. No trailing
> slash issues — the client strips them. Vite inlines this at build time, so
> after changing it you must **re-deploy** (Deployments → Retry/Redeploy, or push
> a commit).
>
> Also add it to the **Preview** environment if you want PR previews to work.

---

## 3. Deploy

- Click **Save and Deploy**. Cloudflare clones the repo, runs
  `cd frontend && npm install && npm run build`, and publishes `dist/`.
- First build takes a few minutes. The result is live at
  `https://<project>.pages.dev`.
- Every push to `main` auto-redeploys.

---

## 4. Wire CORS on the backend (one-time, after you know the Pages URL)

On **Render** → service → Environment, set:

```
CORS_ALLOWED_ORIGINS = https://<project>.pages.dev
```

(exact origin, scheme + host, no trailing slash) → Render redeploys. Without this
the browser blocks the frontend's API calls.

---

## 5. Verify end-to-end

1. Open `https://<project>.pages.dev` — the UI loads.
2. Deep-link test: visit `https://<project>.pages.dev/directory` directly and
   refresh — it should load (not 404), proving `_redirects` works.
3. Open DevTools → Network. Trigger login/data — calls go to
   `mvit-alumni-api.onrender.com/api/...` and return 200 (no CORS errors).
   - First call may be slow (~30–60s) if the free Render service was asleep.

---

## SPA routing

`public/_redirects` contains `/* /index.html 200` so client-side routes
(`/directory/alumni/:id`, `/alumni-space`, …) resolve on refresh/deep-link.
It's copied into `dist/` automatically by Vite.

---

## ⚠️ Known limitation on the temporary domains

`<project>.pages.dev` (frontend) and `...onrender.com` (API) are **different
sites**, so the refresh-token cookie is a third-party cookie. Browsers that block
third-party cookies may not keep the user logged in past the 15-min access-token
window (they'd need to re-login). Bearer-token requests still work. This fully
resolves once both sit under ONE custom domain (`app.` + `api.yourdomain.com`),
which is the planned final setup.

---

## Custom domain later (when ready)

Pages → your project → **Custom domains** → add e.g. `app.yourdomain.com`
(Cloudflare auto-creates the DNS + SSL). Then:
- Rebuild frontend with `VITE_API_BASE_URL=https://api.yourdomain.com/api`.
- Point `api.yourdomain.com` at the backend and set backend
  `CORS_ALLOWED_ORIGINS=https://app.yourdomain.com`,
  `COOKIE_DOMAIN=.yourdomain.com`, `COOKIE_SAMESITE=none`.

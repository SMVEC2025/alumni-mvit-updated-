# MVIT Alumni Frontend

## Environment setup
1. Copy `.env.example` to `.env`.
2. Fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Supabase auth setup
1. In Supabase Dashboard, open `Authentication -> Providers`.
2. Enable `Email` and `Google`.
3. Enable email confirmation in `Authentication -> Email`.
4. For Google provider, add your Google Cloud OAuth credentials (Client ID + Client Secret) in Supabase.
5. In Google Cloud Console, add authorized redirect URI:
   - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
6. In Supabase URL configuration, add your site URL:
   - `http://localhost:5173`
7. Add redirect URL:
   - `http://localhost:5173/login`

## Run
```bash
npm install
npm run dev
```

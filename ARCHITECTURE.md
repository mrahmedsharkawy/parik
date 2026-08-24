# Bariq Ads Studio — Architecture

- Route: `/ads-studio` (rewrite to `/ads-studio.html`).
- Store products: existing Supabase `products` table is the source of truth.
- Frontend: static HTML/CSS/JS, matching the current Bariq repository architecture.
- Sensitive Meta operations: Vercel Serverless Functions under `/api/meta/*`.
- Meta API version: single backend constant `META_API_VERSION`, default `v26.0`.
- OAuth tokens: encrypted server-side and stored only in an HttpOnly, Secure, SameSite=Lax cookie for the first single-owner MVP.
- Meta App Secret / encryption key: environment variables only. Never sent to browser.
- Final production persistence can move token metadata to `meta_connections` with encrypted token material if multi-user roles are enabled later.
- Campaign creation workflow is safety-first: newly created campaign/ad set/ad start PAUSED.
- No fake campaign/insight data: disconnected state renders dashes / Not Connected.
- Product pagination: 20 products per page; no bulk loading.

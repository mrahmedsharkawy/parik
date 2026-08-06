# Security Header Improvements

**Date:** 2026-08-06  
**Site:** bariqgifts.com  
**Goal:** Harden HTTP response headers without touching business logic, authentication, database schema, or the existing Content-Security-Policy.

---

## Summary of Changes

| Priority | Area | What Changed | Files |
|---|---|---|---|
| 1 | CORS | `Access-Control-Allow-Origin: *` → restricted to `https://bariqgifts.com`, `https://www.bariqgifts.com`, and `https://admin.bariqgifts.com` | `supabase/functions/*/index.ts` |
| 2 | Cache-Control | Static assets (CSS, JS, fonts, images, translations, mobile-nav-bar) now use long-term immutable caching | `vercel.json` |
| 3 | Optional headers | Added `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Resource-Policy: same-site` globally | `vercel.json` |

---

## 1. CORS Restriction

### Problem
The security test reported:

> "This is a very lax CORS policy"

The Supabase Edge Functions were returning:

```http
Access-Control-Allow-Origin: *
```

This allowed any website on the internet to call these endpoints from the browser.

### Solution
Replaced the static `corsHeaders` object with a dynamic `getCorsHeaders(req)` helper that:

- Reads the request `Origin` header.
- Returns the origin if it is in the allow-list.
- Falls back to `https://bariqgifts.com` for requests with no/preflight origin.

### Allowed Origins

- `https://bariqgifts.com`
- `https://www.bariqgifts.com`
- `https://admin.bariqgifts.com`

### Files Changed

- `supabase/functions/abandoned-cart-reminder/index.ts`
- `supabase/functions/hyper-api/index.ts`
- `supabase/functions/send-push/index.ts`

### Before

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### After

```ts
// Security improvement: restrict CORS to bariqgifts.com domains only
const ALLOWED_ORIGINS = [
  'https://bariqgifts.com',
  'https://www.bariqgifts.com',
  'https://admin.bariqgifts.com',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}
```

All response header spreads were updated from `{ ...corsHeaders, ... }` to `{ ...getCorsHeaders(req), ... }`.

---

## 2. Cache-Control Optimization

### Principle

- **HTML pages** stay uncached so users always get fresh markup and updated service-worker references.
- **Static assets** (CSS, JS, images, fonts, translations, UI components) are versioned by filename or cache-busted via build, so they can be cached for one year without revalidation.
- **API responses** (Supabase REST/Auth/Storage) are not served by `vercel.json` static config; they remain controlled by Supabase and the frontend `Cache-Control: no-cache` headers where already used.

### HTML Pages — Unchanged

Routes such as `/`, `/index.html`, `/categories`, `/product`, `/Cart`, `/account`, `/login`, `/offers`, `/checkout`, `/affiliate`, `/admin`, `/admin-reports`, `/sales-invoices`, `/policy`, `/sw.js`, and `/:path*.html` keep:

```http
Cache-Control: no-cache, must-revalidate
```

Admin pages keep the stricter:

```http
Cache-Control: no-cache, no-store, must-revalidate
```

### Static Assets — Changed to Long-Term Immutable

| Source Pattern | Before | After |
|---|---|---|
| `/assets/:path*` | `public, max-age=31536000, immutable` | `public, max-age=31536000, immutable` (already correct) |
| `/style/:path*` | `public, max-age=2592000, stale-while-revalidate=604800` | `public, max-age=31536000, immutable` |
| `/java/:path*` | `public, max-age=2592000, stale-while-revalidate=604800` | `public, max-age=31536000, immutable` |
| `/java/Products.min.js` | `no-cache, no-store, must-revalidate` | `public, max-age=31536000, immutable` |
| `/java/Cart.min.js` | `no-cache, no-store, must-revalidate` | `public, max-age=31536000, immutable` |
| `/java/Products.js` | `no-cache, no-store, must-revalidate` | `public, max-age=31536000, immutable` |
| `/java/supabase.js` | `no-cache, no-store, must-revalidate` | `public, max-age=31536000, immutable` |
| `/java/supabase.min.js` | `no-cache, no-store, must-revalidate` | `public, max-age=31536000, immutable` |
| `/java/main.min.js` | `no-cache, no-store, must-revalidate` | `public, max-age=31536000, immutable` |
| `/java/instant-nav.js` | `no-cache, no-store, must-revalidate` | `public, max-age=31536000, immutable` |
| `/java/sw-refresh.js` | `no-cache, no-store, must-revalidate` | `public, max-age=31536000, immutable` |
| `/java/push-welcome.js` | `no-cache, no-store, must-revalidate` | `public, max-age=31536000, immutable` |
| `/mobile-nav-bar/:path*` | `no-cache, no-store, must-revalidate` | `public, max-age=31536000, immutable` |
| `/translations/:path*` | `public, max-age=2592000, stale-while-revalidate=604800` | `public, max-age=31536000, immutable` |

### File Changed

- `vercel.json`

---

## 3. Optional Cross-Origin Isolation Headers

Added globally to all routes in `vercel.json`:

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-site
```

### Why

- `Cross-Origin-Embedder-Policy: require-corp` blocks cross-origin resources that do not explicitly allow being embedded.
- `Cross-Origin-Resource-Policy: same-site` ensures browsers only load these resources from same-site contexts.

### Monitoring

These headers can break embedded cross-origin content (for example images from a CDN or third-party iframes). After deployment, verify:

1. Product images load correctly.
2. Google Tag Manager / Google Analytics scripts still execute.
3. Cloudinary images and Supabase storage assets still display.

If anything breaks, revert this single commit or remove the two headers from the `/(.*)` block in `vercel.json`.

---

## Commits

```text
backup-before-headers-optimization
fix: restrict CORS in Supabase Edge Functions to bariqgifts.com domains
perf: use long-term immutable caching for static assets
feat: add COEP require-corp and CORP same-site headers (monitor for CDN breakage)
```

## Validation Checklist

- [ ] Site opens at `https://bariqgifts.com`.
- [ ] Login page loads and authentication still works.
- [ ] Product list renders.
- [ ] Admin push/notification endpoints respond with the correct `Access-Control-Allow-Origin` (not `*`).
- [ ] Static JS/CSS files return `Cache-Control: public, max-age=31536000, immutable`.
- [ ] HTML pages still return `Cache-Control: no-cache, must-revalidate`.
- [ ] No CDN or third-party resources are blocked after adding COEP/CORP.

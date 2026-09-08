# Project status & handoff notes

Marketing site for **FPI Services** — GCAA Part-145 aircraft MRO at Accra
International Airport. Read this first when resuming in a new session.

## Stack & structure
- **Vanilla Vite, multi-page** (no framework). `npm run dev` / `npm run build`.
- Pages: `index.html` + `network`, `sustainability`, `careers`, `aog`,
  `capability-check`, `privacy`, `terms`, `credits`, and `services/*` (4).
- Shared chrome injected by `src/site.js` (inner pages) / inline (home).
  Bootstraps: `main.js` (home), `page.js` (generic), `service.js`, `aog.js`, `checker.js`.
- `src/effects.js` = WebGL liquid bg, liquid glass, cursor glow, tilt/magnetic,
  cookie consent, WhatsApp float, film grain + vignette, kinetic headlines, scroll FX.
- `src/fleet3d.js` = interactive fleet viewer: in-house three.js glTF render
  (loads `/public/models/<key>.glb`) with **Sketchfab embed fallback** if a GLB is absent.
- Deployed via **Netlify** (`netlify.toml`). RFQ + AOG forms use **Netlify Forms**
  (they only deliver on the deployed site, not localhost).

## Done
Multi-page site, capabilities, interactive fleet matrix, 3D fleet inspector,
facility, approvals, about, RFQ; network map, sustainability, careers, AOG console,
capability/TAT checker; real capability photos; WebGL liquid-glass + effects;
visual level-up (serif accent, grain/vignette, kinetic headlines, preloader, scroll FX);
SEO foundations (sitemap, robots, OG/Twitter, LocalBusiness JSON-LD); legal + consent.
All committed + pushed to https://github.com/rahuldarrsan27-jpg/flight-path-innovation

## OPEN / NEXT (priority order)
1. **Logo — DONE.** FPI Services mark applied to nav, footer, preloader, favicons
   (16/32/180/192/512) + web manifest. Master kept at `brand/logo-source.jpeg`;
   regenerate icons via `brand/generate-icons.js` (needs `npm i -D jimp@0.22.12`).
   Web assets: `public/assets/logo-mark-light.png` (white+blue, dark theme) +
   `logo-mark.png` (dark-on-light); favicons in `public/`. Optional next: a
   logo-based OG share image (OG currently uses a facility photo).
2. **Domain — DONE.** Live domain is `fpiservices.net` (brand: **FPI Services**).
   Applied to canonical + OG/Twitter URLs, JSON-LD `@id`/url, `public/sitemap.xml`,
   `public/robots.txt`, `public/llms.txt`, the www→apex redirect and all emails.
   Old domain `fpiaviation.com` should stay attached in Netlify as a 301 redirect.
   Still to do in Google: add fpiservices.net as a Search Console property, submit
   the sitemap, and use the Change of Address tool from the old domain.
3. **SEO off-page (user's Google account)**: Search Console + submit sitemap;
   Google Business Profile (biggest local lever); backlinks/citations; reviews.
4. **Blog/insights section** — not built yet; biggest remaining SEO lever I can build.
5. **Real photography** — replace stock in `public/assets/images/`; #1 visual lever.
6. **3D models** — optional: drop CC-BY/owned GLBs in `public/models/` to remove the
   Sketchfab author bar (see that folder's README). Currently uses Sketchfab fallback.
7. Remaining visual polish available: custom cursor, 404 page, day→night toggle.

## Placeholders to replace before launch
Emails (`@fpiservices.net` — set up mailboxes once the domain is live), company
Reg. No., facility stats/TAT figures (illustrative), analytics ID (hook in
`effects.js` `loadAnalytics()`).

**Scope discipline (important).** The GCAA approval is PENDING, so the site makes
no certification, approval or Part-145 claim anywhere — do not reintroduce one
until the certificate is actually issued. Advertised scope is deliberately
limited to: hangar storage, line maintenance, and base maintenance to **C-check
level**. No D checks, no NDT, no component/workshop MRO. The `#approvals`
section, the certificate card and the component MRO service page were removed
for this reason.
Phone + WhatsApp are set to **+233 55 435 2912**.

## Deploy / push
Cached git credentials work: `git -C <repo> push`. Netlify auto-redeploys on push
if connected.

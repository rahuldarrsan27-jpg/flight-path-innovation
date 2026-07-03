# Project status & handoff notes

Marketing site for **FPI Aviation** — GCAA Part-145 aircraft MRO at Accra
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
1. **Pick a logo** — 6 options were presented; once chosen, roll out to nav, footer,
   favicon, preloader, og-image.
2. **Domain** — when added, update the `fpiaviation.com` placeholder in:
   canonical + OG/Twitter URLs (`index.html` head), `public/sitemap.xml`,
   `public/robots.txt`, JSON-LD `@id`/url. Critical for SEO.
3. **SEO off-page (user's Google account)**: Search Console + submit sitemap;
   Google Business Profile (biggest local lever); backlinks/citations; reviews.
4. **Blog/insights section** — not built yet; biggest remaining SEO lever I can build.
5. **Real photography** — replace stock in `public/assets/images/`; #1 visual lever.
6. **3D models** — optional: drop CC-BY/owned GLBs in `public/models/` to remove the
   Sketchfab author bar (see that folder's README). Currently uses Sketchfab fallback.
7. Remaining visual polish available: custom cursor, 404 page, day→night toggle.

## Placeholders to replace before launch
Phone `+233 30 000 0000`, emails, GCAA cert no. `GH-AMO-2024`, company Reg. No.,
facility stats/TAT figures (illustrative), WhatsApp number, analytics ID
(hook in `effects.js` `loadAnalytics()`).

## Deploy / push
Cached git credentials work: `git -C <repo> push`. Netlify auto-redeploys on push
if connected.

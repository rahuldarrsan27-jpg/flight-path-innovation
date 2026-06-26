# Flight Path Innovation

Marketing website for **Flight Path Innovation** — a GCAA Part-145 approved aircraft
maintenance, repair and overhaul (MRO) provider operating from Accra International
Airport, Ghana. Hangar storage, line & base maintenance and component MRO for ATR,
Embraer, Boeing and Airbus narrowbody and regional fleets.

## Stack

- **Vite** (vanilla JS, multi-page) — no framework
- Custom WebGL liquid-glass background + effects
- Interactive 3D fleet inspector via embedded Sketchfab models
- Fully responsive, accessible (WCAG-minded), reduced-motion aware

## Pages

`index.html` (home) · `network.html` · `sustainability.html` · `careers.html` ·
`services/{hangar-storage,line-maintenance,base-maintenance,component-mro}.html`

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Notes

- Replace the placeholder images in `public/assets/images/` with your own photography.
- The contact/RFQ form is front-end only — wire it to an email/CRM backend before launch.
- Update placeholder data (phone, certificate no., registration) before going live.

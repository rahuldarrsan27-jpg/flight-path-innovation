# Hangar Log — setup

The protected module at `/hangar`. Two screens: aircraft visits (Tab 1) and the work
carried out (Tab 2). Records live in Supabase Postgres, locked to your account by
Row Level Security, so you reach them from your phone.

About 15 minutes, one time.

---

## 1 — Create the database

1. **https://supabase.com** → *Start your project* → sign in.
2. **New project**. Name `fpi-hangar`; click *Generate a password* and let your browser
   save it; region *West EU (London)* or *East US* — either is fine from Ghana.
3. Wait ~2 minutes while it builds.

## 2 — Create the tables

1. Sidebar → **SQL Editor** → *New query*.
2. Open [`schema.sql`](schema.sql) in this folder, copy **all of it**, paste, press **Run**.
   You should see *Success. No rows returned*.

That creates both tables, the indexes, the aircraft → jobs cascade, and the RLS
policies. **The RLS policies are the security model** — without them anyone who found
the address could read your contract amounts. Do not skip this step.

## 3 — Give the site your keys

In Supabase: **Project Settings → API**. You need two values:

- **Project URL** — like `https://abcdefgh.supabase.co`
- **anon public** key — a long string starting `eyJ…`

Then in Netlify: **Site configuration → Environment variables → Add a variable**, and add
both:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon public key |

**Redeploy** (Deploys → *Trigger deploy* → *Deploy site*) — Vite reads these at build
time, so a redeploy is required for them to take effect. Until then `/hangar` shows a
"Not connected yet" notice rather than a broken login box.

The anon key is designed to sit in a web page; it is not a password, and step 2's RLS is
what protects the data. The **service_role** key on that same screen is different —
never put it in this repo or any front-end.

For local development, create a `.env` in the project root (it is git-ignored):

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 4 — Make your account

1. Open `https://fpiaviation.com/login`.
2. Enter your email and a password of at least 8 characters → **Create my account**.
3. Supabase emails a confirmation link. Click it, return, and **Sign in**.

## 5 — Close the door behind you

Once your account exists, turn sign-ups off:

> **Supabase dashboard → Authentication → Sign In / Providers → Email → turn off
> "Allow new users to sign up" → Save.**

(On some dashboard versions the same switch is at *Authentication → Providers → Email*,
or *Authentication → Settings → "Enable user sign-ups"*. It is the same setting.)

Anyone who signed up would only get their own empty log — RLS keeps them out of yours —
but there is no reason to leave it open.

## 6 — Bring existing records across

If you already have records in the offline single-file version:

1. Open that app, click **Backup** → a `.json` downloads.
2. On `/hangar`, click **Restore**, pick that file, confirm.

Restore **adds**, it never replaces, so run it once or you will get duplicates. Old
aircraft ids (arbitrary strings) are remapped to the new uuids as each aircraft is
inserted, so job sheets stay attached to the right aircraft.

## 7 — Put it on your phone

Open `https://fpiaviation.com/hangar` in Safari → **Share → Add to Home Screen**
(Android: Chrome → ⋮ → *Add to home screen*). Sign in once per device; the session
persists.

---

## How it fits the site

| Piece | Where |
|---|---|
| Pages | `hangar.html`, `login.html` (Vite entries in `vite.config.js`) |
| App code | `src/hangar/` — `app.js` (UI), `lib.js` (pure helpers), `client.js`, `config.js` |
| Styling | `src/hangar/hangar.css` — site palette + Exo 2, denser; standalone shell |
| Clean URLs | `/hangar`, `/login` via `netlify.toml` rewrites |
| Kept private | `noindex` meta + `X-Robots-Tag` header + `robots.txt`; unlinked from the marketing nav; absent from `sitemap.xml` |
| Tests | `test/hangar.test.mjs` (logic), `test/hangar-ui.html` (UI harness, never built) |

Run the logic tests with:

```bash
TZ=Africa/Accra node --test test/hangar.test.mjs
```

## After first sign-in — please confirm these

Four things could not be verified without a live project. Once you are signed in:

1. **Two accounts cannot see each other's rows.** Create a second throwaway account
   (before step 5, or re-enable sign-ups briefly), add a record on each, and confirm
   neither sees the other's. Also test it by direct API call — this must return `[]`:
   ```bash
   curl -s "https://YOUR-PROJECT.supabase.co/rest/v1/aircraft?select=*" \
     -H "apikey: YOUR_ANON_KEY"
   ```
   (No user token → RLS returns no rows. If that ever returns data, step 2 did not run.)
2. **Session persists** across a browser restart and on a second device.
3. **Sign out** returns to `/login` and `/hangar` then redirects away.
4. **Restore** of a real backup keeps every job attached.

## If something goes wrong

**"Not connected yet"** — step 3 did not take: check both variable names are exact and
that you redeployed after adding them.

**A red message at the bottom** — that is the database talking. If it mentions
*row-level security* or *policy*, re-run `schema.sql`.

**"Invalid login credentials"** — wrong password, or the confirmation email is unclicked.

**Records missing on one device** — check the email shown top-right matches.

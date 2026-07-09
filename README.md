# Error Tracker

A shared, web-based error log for ASRS, Infolog, AMR, and other automation faults.
Multiple people can open the same link and log/resolve errors in real time.

**Stack:** plain HTML/CSS/JS (no build step) + [Supabase](https://supabase.com) (free tier) for the database, photo storage, and live sync + [Vercel](https://vercel.com) (free tier) for hosting.

Why Supabase is needed: Vercel only hosts your website files — it doesn't store data.
Supabase gives you a free shared database and photo storage that all users' browsers read/write to.

---

## 1. Create your Supabase project (~3 minutes)

1. Go to https://supabase.com → sign up (free) → **New project**.
2. Pick any name/region, set a database password (you won't need it again), wait ~2 min for it to spin up.
3. In the left sidebar, open **SQL Editor** → **New query**.
4. Open the `supabase-setup.sql` file included here, copy the whole thing, paste it in, but **do the storage bucket step first**:
   - Go to **Storage** (left sidebar) → **New bucket** → name it exactly `error-photos` → toggle **Public bucket** ON → Create.
   - Then go back to SQL Editor, paste `supabase-setup.sql`, and click **Run**.
5. Go to **Settings → API**. Copy two values:
   - **Project URL**
   - **anon public** key (NOT the `service_role` key — never expose that one)

## 2. Connect the app to your project

Open `config.js` in this folder and replace the placeholders:

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi....";
```

Save. That's it — no other code needs to change. (The anon key is safe to expose in the browser; the RLS policies you ran in step 1 control what it's allowed to do.)

## 3. Test it locally (optional but recommended)

Any static server works, e.g. with Python:

```bash
cd error-tracker
python3 -m http.server 8000
```

Open http://localhost:8000 and log a test error to confirm it saves.

## 4. Deploy to Vercel (free)

**Easiest way — no GitHub needed:**

1. Install the Vercel CLI once: `npm i -g vercel`
2. From inside this folder, run:
   ```bash
   vercel
   ```
3. Answer the prompts (link/create a project, accept defaults — it's a static site, no build command needed).
4. Run `vercel --prod` to get your permanent production URL.

**Or via GitHub (better for future edits):**

1. Push this folder to a new GitHub repo.
2. Go to https://vercel.com/new, import that repo.
3. Framework preset: **Other** (no build step). Leave build/output settings blank.
4. Click **Deploy**. You'll get a URL like `error-tracker-yourname.vercel.app`.
5. Share that URL with your team — everyone sees the same live data.

No environment variables are needed on Vercel since the Supabase keys live in `config.js`.

---

## Features

- **4 categories**: ASRS, Infolog, AMR, Other — with color-coded badges
- **Quick-select buttons** per category for common errors (edit the `QUICK_ERRORS` object at the top of `app.js` to customize the phrases)
- **Timestamp** on every entry, editable, with a "Now" shortcut
- **Photo upload** per error, stored in Supabase Storage, click any thumbnail to view full size
- **Mark solved** with one tap — automatically calculates and displays troubleshooting duration
- **Reopen** a solved error if it recurs
- **Search and filter** by category
- **Live sync** — if two people have the app open, changes appear on both screens within a second or two
- **Export** to Excel (.xlsx), CSV, or plain text at any time, from the Export button

## Customizing the quick-select error phrases

Open `app.js` and edit this block near the top:

```js
const QUICK_ERRORS = {
  ASRS: ["ASRS timeout", "ASRS bin not found", "ASRS crane fault", "ASRS communication lost"],
  Infolog: ["Infolog sync failed", "Infolog order mismatch", "Infolog connection timeout"],
  AMR: ["AMR stuck / blocked path", "AMR battery low fault", "AMR navigation error", "AMR docking failed"],
  Other: ["Network outage", "Sensor fault", "Power interruption", "Manual override triggered"]
};
```

## Notes on access control

This version has no login — anyone with the link can log/edit/delete entries, which is
usually fine for an internal tool shared only inside your team. If you later want to
restrict access (e.g. a shared password, or individual logins), that can be added with
Supabase Auth — just let me know and I can wire that up.

## Free tier limits (should be far more than enough for this use case)

- **Supabase free tier**: 500MB database, 1GB file storage, unlimited API requests — plenty for years of error logs and photos at this scale.
- **Vercel free tier**: generous bandwidth for a small internal tool; no cost for a static site like this.

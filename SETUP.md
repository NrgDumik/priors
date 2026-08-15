# Setup — Slice 1

This slice proves the deploy pipeline works end to end: files in GitHub →
built by Vercel → live URL. Nothing here needs Node, npm, or a terminal
installed on your machine — Vercel runs the build in its own cloud.

## 1. Get these files into your `priors` GitHub repo

Easiest path with no installs required:

1. Open your repo on github.com
2. Click **Add file → Upload files**
3. Drag in this entire extracted folder's contents (all files and the
   `app/` and `supabase/` subfolders together) — GitHub's uploader preserves
   folder structure when you drop folders, not just loose files
4. Scroll down, write a commit message like "Slice 1: scaffold", click
   **Commit changes** directly to `main`

If the drag-and-drop doesn't preserve subfolders for you, the fallback is
one file at a time: **Add file → Create new file**, then type the *full
path* (e.g. `app/layout.tsx`) into the filename box — GitHub creates the
folder automatically — paste the contents, commit. Repeat per file.

## 2. Create the Supabase project

1. New project at supabase.com. Pick a region close to you (e.g. Frankfurt).
   Save the database password somewhere — you won't see it again.
2. Go to the **SQL Editor**, paste the entire contents of
   `supabase/schema.sql`, run it. You should see "Success. No rows returned."
3. Go to **Settings → API** and copy three values, you'll need them next:
   `Project URL`, `anon public` key, `service_role` key (keep this one secret).
4. Go to **Authentication → Providers** and confirm **Email** is enabled
   (it is by default). Under **Authentication → URL Configuration**, you'll
   add your real Vercel URL once you have one — a placeholder is fine for now.

## 3. Import the repo into Vercel and set env vars

1. New Project on vercel.com → import your `priors` GitHub repo
2. Before the first deploy, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` — the Project URL from step 2
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon key from step 2
   - `SUPABASE_SERVICE_ROLE_KEY` — the service_role key from step 2
   - `ANTHROPIC_API_KEY` — leave blank for Slice 1, needed from Slice 5 on
   - `CRON_SECRET` — any random string you make up now
3. Click **Deploy**

## 4. Verify Slice 1 is actually working

- Deploy succeeds (green, not red) — this alone confirms package.json,
  Tailwind, and the App Router files are all wired correctly
- Open the live URL — you should see "Priors" and "Scaffold is live."
- If the build fails, Vercel's build log tells you exactly which file and
  line — paste that error back into chat and we'll fix the file together

Once this is green, tell me and we'll move to Slice 2: real auth (sign up,
log in, log out) and the empty dashboard shell.

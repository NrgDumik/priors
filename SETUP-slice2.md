# Setup — Slice 2 (auth + dashboard shell)

## 1. Upload these 7 files

Your repo already has an `app/` folder from Slice 1 (with `page.tsx`, `layout.tsx`,
`globals.css`). This slice adds new files into it and **replaces** `page.tsx`.

Easiest: drag this whole extracted folder's contents into GitHub's
**Add file → Upload files** the same way as Slice 1. GitHub will:
- Add `middleware.ts` (new, at the repo root)
- Add the new `app/login/` and `app/dashboard/` folders
- Detect `app/page.tsx` already exists and show it as **modified**, not duplicated
- Add the new `lib/` folder

Commit directly to `main` as before.

## 2. One Supabase setting to update

Go to **Authentication → URL Configuration** in Supabase and set:
- **Site URL:** `https://priors-khaki.vercel.app` (your actual Vercel URL)
- **Redirect URLs:** add the same URL here too

This matters so that any auth emails (password reset, confirmation) link back to
your live app instead of `localhost`.

## 3. No Vercel steps needed

It's already watching your GitHub repo — pushing to `main` auto-redeploys.

## 4. Test it

1. Visit your live URL — it should now redirect straight to `/login`
2. Sign up with an email + password (6+ characters)
3. If Supabase's default email confirmation is on, check your inbox (and spam
   folder) for a confirmation link, then come back and log in
4. You should land on `/dashboard`, see "Signed in as [your email]" and the
   empty-state message
5. Click **Log out** — you should be sent back to `/login`

If anything shows a red error banner on the login page instead of working,
that error text is exactly what Supabase returned — paste it back and we'll
sort it out.

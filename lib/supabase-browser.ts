import { createBrowserClient } from '@supabase/ssr';

// Client-side client. Not used yet in Slice 2 (auth runs entirely through
// Server Actions), but Slice 3+ will use this for interactive dashboard
// components — kept here now so the convention is already in place.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

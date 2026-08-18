import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { signOut } from '@/app/login/actions';
import type { ThesisSummary } from '@/lib/types';
import ThesisList from './thesis-list';

export const dynamic = 'force-dynamic';

export default async function ThesesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('theses')
    .select(
      'id, user_id, ticker, name, currency, verdict, conviction, thesis, kill_switch, val_bear, val_base, val_bull, val_current, price_updated_at, created_at, updated_at, kbqs(id, status), triggers(id, description, due_date, done)'
    )
    .order('updated_at', { ascending: false });

  const theses: ThesisSummary[] = (data ?? []) as ThesisSummary[];

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <div className="flex items-start justify-between mb-1">
        <h1 className="font-display text-3xl text-slate-100">Priors</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/import"
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          >
            <Upload size={15} aria-hidden /> Import research
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-600 rounded-md px-3 py-1.5 transition-colors"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Not a watchlist. A record of what you believe, and what would prove you
        wrong. Signed in as {user.email}.
      </p>

      {error && (
        <p
          role="alert"
          className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-md px-3 py-2 mb-4"
        >
          Could not load your theses: {error.message}
        </p>
      )}

      <ThesisList theses={theses} />
    </div>
  );
}

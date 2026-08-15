import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import type { FullThesis } from '@/lib/types';
import ThesisDetail from './thesis-detail';

export const dynamic = 'force-dynamic';

export default async function ThesisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('theses')
    .select(
      'id, user_id, ticker, name, currency, verdict, conviction, thesis, kill_switch, val_bear, val_base, val_bull, val_current, created_at, updated_at, kbqs(id, thesis_id, question, confidence, status, sort_order, created_at, resolved_at), triggers(id, thesis_id, description, due_date, done, sort_order, created_at), history(id, thesis_id, note, source, snapshot, conviction_at_time, created_at)'
    )
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();

  const thesis = data as FullThesis;

  // Supabase returns embedded rows unordered; sort here so the client
  // component stays presentational.
  thesis.kbqs = [...(thesis.kbqs ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
  );
  thesis.triggers = [...(thesis.triggers ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
  );
  thesis.history = [...(thesis.history ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <ThesisDetail t={thesis} />
    </div>
  );
}

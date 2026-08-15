import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { signOut } from '@/app/login/actions';

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-semibold text-2xl">Priors</h1>
        <form action={signOut}>
          <button className="text-sm text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-600 rounded-md px-3 py-1.5 transition-colors">
            Log out
          </button>
        </form>
      </div>
      <p className="text-slate-500 text-sm mb-10">Signed in as {user.email}</p>

      <div className="text-center py-16 border border-dashed border-slate-800 rounded-lg">
        <p className="text-slate-500 text-sm mb-1">Nothing tracked yet.</p>
        <p className="text-slate-600 text-xs">
          Manual add and research-driven add arrive in the next slice.
        </p>
      </div>
    </main>
  );
}

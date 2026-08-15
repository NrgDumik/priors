import { signIn, signUp } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="max-w-sm mx-auto px-5 py-24">
      <h1 className="font-semibold text-2xl mb-1">Priors</h1>
      <p className="text-slate-500 text-sm mb-8">Sign in, or create an account.</p>

      {params.error && (
        <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-md px-3 py-2 mb-4">
          {params.error}
        </p>
      )}
      {params.message && (
        <p className="text-sm text-teal-300 bg-teal-950/40 border border-teal-900/60 rounded-md px-3 py-2 mb-4">
          {params.message}
        </p>
      )}

      <form className="space-y-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-slate-500 mb-1.5 block">
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-500 focus:outline-none rounded-md px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-slate-500 mb-1.5 block">
            Password
          </span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-500 focus:outline-none rounded-md px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <div className="flex gap-2 pt-2">
          <button
            formAction={signIn}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium rounded-md py-2 text-sm"
          >
            Log in
          </button>
          <button
            formAction={signUp}
            className="flex-1 border border-slate-700 hover:border-slate-500 text-slate-200 rounded-md py-2 text-sm"
          >
            Sign up
          </button>
        </div>
      </form>
    </main>
  );
}

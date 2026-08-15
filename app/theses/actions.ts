'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import { thesisImportSchema } from '@/lib/schemas/import';
import type {
  ActionResult,
  Confidence,
  KbqStatus,
  Verdict,
} from '@/lib/types';

function fail(error: string): ActionResult {
  return { ok: false, error };
}

async function requireClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

function refresh(thesisId?: string) {
  revalidatePath('/theses');
  if (thesisId) revalidatePath(`/theses/${thesisId}`);
}

// ---------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------

/**
 * Commits a validated import. The client already validated with Zod for
 * fast feedback; this re-validates because anything arriving over the
 * wire is untrusted, then hands one jsonb blob to the RPC so the whole
 * write is a single transaction.
 */
export async function commitImport(
  raw: unknown,
  reportMd: string | null
): Promise<ActionResult> {
  const ctx = await requireClient();
  if (!ctx) return fail('You are signed out. Sign in and try again.');

  const parsed = thesisImportSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.join('.') ?? '';
    return fail(
      `The file failed validation${where ? ` at ${where}` : ''}: ${
        first?.message ?? 'unknown problem'
      }`
    );
  }

  const payload = { ...parsed.data, report_md: reportMd };

  const { data, error } = await ctx.supabase.rpc('import_thesis', { payload });

  if (error) return fail(error.message);
  if (typeof data !== 'string') return fail('Import returned no thesis id.');

  refresh(data);
  return { ok: true, id: data };
}

// ---------------------------------------------------------------------
// Thesis
// ---------------------------------------------------------------------

export type ThesisPatch = Partial<{
  name: string;
  currency: string;
  verdict: Verdict;
  conviction: number;
  thesis: string;
  kill_switch: string;
  val_bear: number | null;
  val_base: number | null;
  val_bull: number | null;
  val_current: number | null;
}>;

export async function updateThesis(
  id: string,
  patch: ThesisPatch
): Promise<ActionResult> {
  const ctx = await requireClient();
  if (!ctx) return fail('You are signed out. Sign in and try again.');

  if (
    patch.kill_switch !== undefined &&
    patch.kill_switch.trim().length === 0
  ) {
    return fail('A thesis needs a kill switch. Say what would prove it wrong.');
  }
  if (
    patch.conviction !== undefined &&
    (patch.conviction < 1 || patch.conviction > 5)
  ) {
    return fail('Conviction runs from 1 to 5.');
  }
  if (Object.keys(patch).length === 0) return { ok: true, id };

  const { error } = await ctx.supabase
    .from('theses')
    .update(patch)
    .eq('id', id);

  if (error) return fail(error.message);
  refresh(id);
  return { ok: true, id };
}

export async function deleteThesis(id: string): Promise<ActionResult> {
  const ctx = await requireClient();
  if (!ctx) return fail('You are signed out. Sign in and try again.');

  const { error } = await ctx.supabase.from('theses').delete().eq('id', id);
  if (error) return fail(error.message);
  refresh(id);
  return { ok: true };
}

// ---------------------------------------------------------------------
// KBQs
// ---------------------------------------------------------------------

export async function addKbq(
  thesisId: string,
  question: string,
  confidence: Confidence
): Promise<ActionResult> {
  const ctx = await requireClient();
  if (!ctx) return fail('You are signed out. Sign in and try again.');

  const text = question.trim();
  if (text.length < 8) return fail('Write the question out in full.');

  const { error } = await ctx.supabase
    .from('kbqs')
    .insert({ thesis_id: thesisId, question: text, confidence, status: 'open' });

  if (error) return fail(error.message);
  refresh(thesisId);
  return { ok: true };
}

export async function updateKbq(
  thesisId: string,
  kbqId: string,
  patch: Partial<{ question: string; confidence: Confidence; status: KbqStatus }>
): Promise<ActionResult> {
  const ctx = await requireClient();
  if (!ctx) return fail('You are signed out. Sign in and try again.');

  if (patch.question !== undefined && patch.question.trim().length < 8) {
    return fail('Write the question out in full.');
  }
  const { error } = await ctx.supabase
    .from('kbqs')
    .update(patch)
    .eq('id', kbqId);

  if (error) return fail(error.message);
  refresh(thesisId);
  return { ok: true };
}

export async function deleteKbq(
  thesisId: string,
  kbqId: string
): Promise<ActionResult> {
  const ctx = await requireClient();
  if (!ctx) return fail('You are signed out. Sign in and try again.');

  const { error } = await ctx.supabase.from('kbqs').delete().eq('id', kbqId);
  if (error) return fail(error.message);
  refresh(thesisId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------

export async function addTrigger(
  thesisId: string,
  description: string,
  dueDate: string | null
): Promise<ActionResult> {
  const ctx = await requireClient();
  if (!ctx) return fail('You are signed out. Sign in and try again.');

  const text = description.trim();
  if (text.length < 3) return fail('Give the trigger a description.');

  const { error } = await ctx.supabase.from('triggers').insert({
    thesis_id: thesisId,
    description: text,
    due_date: dueDate && dueDate.length > 0 ? dueDate : null,
  });

  if (error) return fail(error.message);
  refresh(thesisId);
  return { ok: true };
}

export async function updateTrigger(
  thesisId: string,
  triggerId: string,
  patch: Partial<{ description: string; due_date: string | null; done: boolean }>
): Promise<ActionResult> {
  const ctx = await requireClient();
  if (!ctx) return fail('You are signed out. Sign in and try again.');

  const { error } = await ctx.supabase
    .from('triggers')
    .update(patch)
    .eq('id', triggerId);

  if (error) return fail(error.message);
  refresh(thesisId);
  return { ok: true };
}

export async function deleteTrigger(
  thesisId: string,
  triggerId: string
): Promise<ActionResult> {
  const ctx = await requireClient();
  if (!ctx) return fail('You are signed out. Sign in and try again.');

  const { error } = await ctx.supabase
    .from('triggers')
    .delete()
    .eq('id', triggerId);

  if (error) return fail(error.message);
  refresh(thesisId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// History
// ---------------------------------------------------------------------

export async function addHistoryNote(
  thesisId: string,
  note: string
): Promise<ActionResult> {
  const ctx = await requireClient();
  if (!ctx) return fail('You are signed out. Sign in and try again.');

  const text = note.trim();
  if (text.length === 0) return fail('Nothing to log.');

  const { error } = await ctx.supabase
    .from('history')
    .insert({ thesis_id: thesisId, note: text, source: 'note' });

  if (error) return fail(error.message);
  refresh(thesisId);
  return { ok: true };
}

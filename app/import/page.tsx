'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileJson, FileText, Upload } from 'lucide-react';
import { commitImport } from '@/app/theses/actions';
import { parseThesisFile, type ThesisImport } from '@/lib/schemas/import';
import { Badge, CONF_COLORS, ConvictionDots, ErrorNote, ValuationBar } from '@/components/ui';

type Staged = {
  data: ThesisImport;
  reportMd: string | null;
  jsonName: string;
  reportName: string | null;
};

export default function ImportPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<string[]>([]);
  const [staged, setStaged] = useState<Staged | null>(null);

  async function handleFiles(fileList: FileList | null) {
    setIssues([]);
    setStaged(null);
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const jsonFile = files.find((f) => f.name.toLowerCase().endsWith('.json'));
    const mdFile = files.find((f) => /\.(md|markdown|txt)$/i.test(f.name));

    if (!jsonFile) {
      setIssues([
        'No .json file in the selection. Pick both the thesis JSON and the research report together.',
      ]);
      return;
    }

    const raw = await jsonFile.text();
    const parsed = parseThesisFile(raw);
    if (!parsed.ok) {
      setIssues(parsed.issues);
      return;
    }

    setStaged({
      data: parsed.data,
      reportMd: mdFile ? await mdFile.text() : null,
      jsonName: jsonFile.name,
      reportName: mdFile ? mdFile.name : null,
    });
  }

  function commit() {
    if (!staged) return;
    setIssues([]);
    startTransition(async () => {
      const result = await commitImport(staged.data, staged.reportMd);
      if (!result.ok) {
        setIssues([result.error]);
        return;
      }
      router.push(`/theses/${result.id}`);
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <Link
        href="/theses"
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6"
      >
        <ArrowLeft size={15} aria-hidden /> Back
      </Link>

      <h1 className="font-display text-2xl text-slate-100 mb-1">
        Import research
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Select the thesis JSON and the research report from the same session.
        Nothing is written until you confirm.
      </p>

      <label className="block border border-dashed border-slate-700 hover:border-slate-500 rounded-lg px-5 py-8 text-center cursor-pointer transition-colors mb-5">
        <input
          type="file"
          multiple
          accept=".json,.md,.markdown,.txt"
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <Upload size={20} aria-hidden className="mx-auto text-slate-500 mb-2" />
        <span className="text-sm text-slate-300 block">
          Choose thesis.json and report.md
        </span>
        <span className="text-xs text-slate-600 block mt-1">
          Both files at once — they get paired on upload
        </span>
      </label>

      {issues.length > 0 && (
        <div className="mb-5 space-y-1.5">
          {issues.map((issue, i) => (
            <ErrorNote key={i}>{issue}</ErrorNote>
          ))}
        </div>
      )}

      {staged && (
        <Preview staged={staged} pending={pending} onCommit={commit} onDiscard={() => setStaged(null)} />
      )}
    </div>
  );
}

function Preview({
  staged,
  pending,
  onCommit,
  onDiscard,
}: {
  staged: Staged;
  pending: boolean;
  onCommit: () => void;
  onDiscard: () => void;
}) {
  const d = staged.data;

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900/50 p-5">
      <div className="flex items-center gap-2 text-[11px] font-mono-data text-slate-500 mb-4">
        <FileJson size={12} aria-hidden /> {staged.jsonName}
        {staged.reportName && (
          <>
            <span className="text-slate-700">·</span>
            <FileText size={12} aria-hidden /> {staged.reportName}
          </>
        )}
        {!staged.reportName && (
          <span className="text-amber-600/80">no report attached</span>
        )}
      </div>

      <div className="flex items-baseline gap-3 mb-1">
        <span className="font-mono-data text-2xl font-semibold text-slate-100">
          {d.ticker}
        </span>
        <Badge className="text-slate-300 border-slate-700 bg-slate-800/60">
          {d.thesis.verdict}
        </Badge>
        <ConvictionDots value={d.thesis.conviction} />
      </div>
      <p className="text-xs text-slate-500 mb-4">
        {d.company} · researched {d.researched_at}
      </p>

      <p className="text-sm text-slate-200 leading-relaxed mb-4">
        {d.thesis.one_liner}
      </p>

      <div className="border border-amber-900/50 bg-amber-950/10 rounded-md px-3 py-2 mb-4">
        <span className="text-[10px] uppercase tracking-wider text-amber-600/90 block mb-1">
          Kill switch
        </span>
        <p className="text-sm text-slate-200 leading-snug">
          {d.thesis.kill_switch}
        </p>
      </div>

      <ValuationBar
        bear={d.valuation.bear}
        base={d.valuation.base}
        bull={d.valuation.bull}
        current={d.valuation.current_price}
        currency={d.currency}
      />

      <div className="mb-4">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-2">
          {d.kbqs.length} key business question{d.kbqs.length === 1 ? '' : 's'}
        </span>
        <ul className="space-y-1.5">
          {d.kbqs.map((k, i) => (
            <li key={i} className="flex items-start gap-2">
              <Badge className={`${CONF_COLORS[k.confidence]} shrink-0 mt-0.5`}>
                {k.confidence}
              </Badge>
              <span className="text-sm text-slate-300 leading-snug">
                {k.question}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {d.triggers.length > 0 && (
        <div className="mb-4">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-2">
            Triggers
          </span>
          <ul className="space-y-1">
            {d.triggers.map((tr, i) => (
              <li key={i} className="text-sm text-slate-300 flex gap-2">
                <span className="flex-1">{tr.description}</span>
                <span className="font-mono-data text-xs text-slate-500">
                  {tr.date ?? 'undated'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-800 pt-3 mb-4">
        {d.summary}
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCommit}
          disabled={pending}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-medium rounded-md px-4 py-2 text-sm"
        >
          {pending ? 'Importing…' : `Import ${d.ticker}`}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={pending}
          className="text-sm text-slate-400 hover:text-slate-200 px-2"
        >
          Discard
        </button>
        <span className="text-[11px] text-slate-600 ml-auto">
          Existing {d.ticker} is archived to history, then replaced.
        </span>
      </div>
    </div>
  );
}

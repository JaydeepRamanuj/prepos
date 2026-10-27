"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Circle, Play } from "lucide-react";
import { LEVELS, LEVEL_LABEL, toKey, type Level } from "@/lib/content/types";
import { readMock, writeMock, type MockSession } from "@/lib/progress/mock";
import { useProgress } from "@/lib/progress/store";
import { loadIndex } from "./search";
import { LevelPips } from "./level";
import { cn, qHref } from "@/lib/utils";

interface T {
  id: string;
  title: string;
  group: string;
  count: number;
}

const COUNTS = [5, 10, 15, 20];

export function MockSetup({ tracks }: { tracks: T[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(["javascript", "react", "nextjs"].filter((id) => tracks.some((t) => t.id === id)));
  const [levels, setLevels] = useState<Level[]>(["medium", "hard"]);
  const [count, setCount] = useState(10);
  const [skipSolved, setSkipSolved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<MockSession | null>(null);
  const solved = useProgress((s) => s.solved);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("done")) {
      const s = readMock();
      if (s?.finished) setFinished(s);
    }
  }, []);

  const start = async () => {
    setError(null);
    const index = await loadIndex().catch(() => null);
    if (!index) return setError("Couldn't load questions. Check your connection and try again.");
    let pool = index.questions.filter((q) => selected.includes(q.track) && (levels.length === 0 || levels.includes(q.level)));
    if (skipSolved) {
      const unsolved = pool.filter((q) => !solved[toKey(q.id)]);
      if (unsolved.length >= Math.min(count, pool.length)) pool = unsolved;
    }
    if (!pool.length) return setError("No questions match. Pick more tracks or levels.");
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, count);
    writeMock({ ids: picked.map((q) => q.id), titles: picked.map((q) => q.title), startedAt: Date.now() });
    router.push(qHref(picked[0].id));
  };

  if (finished) {
    const done = finished.ids.filter((id) => solved[toKey(id)]).length;
    return (
      <div>
        <h1 className="font-serif text-[28px] font-semibold tracking-tight md:text-[34px]">Round complete</h1>
        <p className="mt-2 text-[15px] text-ink-2">
          You marked {done} of {finished.ids.length} as solved. Revisit the rest while they&apos;re fresh.
        </p>
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {finished.ids.map((id, i) => {
            const ok = !!solved[toKey(id)];
            return (
              <li key={id}>
                <Link href={qHref(id)} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken/50">
                  {ok ? (
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-good text-surface">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-line-strong" strokeWidth={1.5} />
                  )}
                  <span className="text-[15px] leading-snug">{finished.titles[i]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          onClick={() => {
            writeMock(null);
            setFinished(null);
            router.replace("/mock");
          }}
          className="mt-6 h-11 rounded-lg bg-blue px-5 text-[15px] font-medium text-surface"
        >
          Set up another round
        </button>
      </div>
    );
  }

  const chip = (on: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-[14px]",
      on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:border-line-strong",
    );

  return (
    <div>
      <h1 className="font-serif text-[28px] font-semibold tracking-tight md:text-[34px]">Mock round</h1>
      <p className="mt-2 max-w-lg text-[15px] text-ink-2">
        Random questions, answers hidden, one after another — like the real thing. Answer each out loud before revealing.
      </p>

      <fieldset className="mt-8">
        <legend className="text-[15px] font-semibold">Tracks</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {tracks.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button key={t.id} aria-pressed={on} onClick={() => setSelected((v) => (on ? v.filter((x) => x !== t.id) : [...v, t.id]))} className={chip(on)}>
                {t.title}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="text-[15px] font-semibold">Difficulty</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {LEVELS.map((l) => {
            const on = levels.includes(l);
            return (
              <button key={l} aria-pressed={on} onClick={() => setLevels((v) => (on ? v.filter((x) => x !== l) : [...v, l]))} className={chip(on)}>
                {on ? LEVEL_LABEL[l] : <LevelPips level={l} />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="text-[15px] font-semibold">Questions</legend>
        <div className="mt-3 flex gap-2">
          {COUNTS.map((n) => (
            <button key={n} aria-pressed={count === n} onClick={() => setCount(n)} className={cn(chip(count === n), "w-14 tabular-nums")}>
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-6 flex items-center gap-2.5 text-[14.5px] text-ink-2">
        <input type="checkbox" checked={skipSolved} onChange={(e) => setSkipSolved(e.target.checked)} className="h-4 w-4 accent-[var(--blue)]" />
        Prefer questions I haven&apos;t solved
      </label>

      {error && <p className="mt-5 text-[14px] text-[var(--lv-hard)]">{error}</p>}

      <button
        onClick={start}
        disabled={!selected.length}
        className="mt-8 flex h-12 items-center gap-2 rounded-lg bg-blue px-6 text-[15.5px] font-medium text-surface disabled:opacity-40"
      >
        <Play className="h-4 w-4 fill-current" aria-hidden /> Start round
      </button>
    </div>
  );
}

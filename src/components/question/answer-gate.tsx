"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { useProgress } from "@/lib/progress/store";
import { useMockFor } from "@/lib/progress/mock";

/** Hides the answer until the reader has tried. "Always show" is a reading-mode preference. */
export function AnswerGate({ id, children }: { id: string; children: ReactNode }) {
  const autoReveal = useProgress((s) => s.hydrated && s.prefs.autoReveal);
  const setPref = useProgress((s) => s.setPref);
  const mock = useMockFor(id);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [id]);

  const open = revealed || (autoReveal && !mock);

  if (open)
    return (
      <div className="mt-8">
        {children}
        <label className="mt-8 flex items-center gap-2 text-[13px] text-ink-3">
          <input
            type="checkbox"
            checked={autoReveal}
            onChange={(e) => setPref("autoReveal", e.target.checked)}
            className="h-4 w-4 accent-[var(--blue)]"
          />
          Always show answers (reading mode)
        </label>
      </div>
    );

  return (
    <div className="mt-8 rounded-xl border border-line bg-surface p-6 text-center">
      <p className="font-serif text-[17px] text-ink">Answer it out loud first.</p>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-ink-2">
        Say your 30-second answer, or write the code on paper, then compare.
      </p>
      <button
        onClick={() => setRevealed(true)}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-hl px-5 text-[15px] font-semibold text-hl-ink hover:brightness-95"
      >
        <Eye className="h-4 w-4" aria-hidden /> Reveal answer
      </button>
      {!mock && (
        <label className="mt-4 flex items-center justify-center gap-2 text-[13px] text-ink-3">
          <input
            type="checkbox"
            checked={autoReveal}
            onChange={(e) => setPref("autoReveal", e.target.checked)}
            className="h-4 w-4 accent-[var(--blue)]"
          />
          Always show answers
        </label>
      )}
    </div>
  );
}

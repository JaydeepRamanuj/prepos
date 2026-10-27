"use client";

import { Children, useEffect, useState, type ReactNode } from "react";
import { Lightbulb } from "lucide-react";

export function Clues({ id, children }: { id: string; children: ReactNode }) {
  const clues = Children.toArray(children);
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(0), [id]);

  return (
    <section className="mt-7 rounded-xl border border-dashed border-line-strong p-4" aria-label="Clues">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[14px] font-medium">
          <Lightbulb className="h-4 w-4 text-[var(--lv-hard)]" aria-hidden />
          {shown === 0 ? "Stuck? Take a clue." : `Clue ${shown} of ${clues.length}`}
        </span>
        {shown < clues.length && (
          <button
            onClick={() => setShown((n) => n + 1)}
            className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-ink-2 hover:border-line-strong"
          >
            {shown === 0 ? "Show first clue" : "Next clue"}
          </button>
        )}
      </div>
      {shown > 0 && (
        <ol className="mt-3 space-y-3">
          {clues.slice(0, shown).map((c, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sunken text-[11px] font-semibold text-ink-2">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">{c}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

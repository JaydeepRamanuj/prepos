"use client";

import { Children, useEffect, useState, type ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Clues({ id, children }: { id: string; children: ReactNode }) {
  const clues = Children.toArray(children);
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(0), [id]);

  return (
    <section className="mt-7 rounded-xl border border-dashed border-line-strong p-4" aria-label="Clues">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[14px] font-medium">
          <Lightbulb className="text-lv-hard" aria-hidden />
          {shown === 0 ? "Stuck? Take a clue." : `Clue ${shown} of ${clues.length}`}
        </span>
        {shown < clues.length && (
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + 1)} className="rounded-full">
            {shown === 0 ? "Show first clue" : "Next clue"}
          </Button>
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

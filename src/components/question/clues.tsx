"use client";

import { Children, useEffect, useState, type ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function Clues({ id, children }: { id: string; children: ReactNode }) {
  const clues = Children.toArray(children);
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(0), [id]);

  return (
    <section className="mt-7" aria-label="Clues">
      <Card className="gap-0 border-dashed p-4 shadow-none">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[14px] font-medium">
            <Lightbulb className="text-lv-hard" aria-hidden />
            {shown === 0 ? "Stuck? Take a clue." : `Clue ${shown} of ${clues.length}`}
          </span>
          {shown < clues.length && (
            <Button variant="outline" size="sm" shape="pill" onClick={() => setShown((n) => n + 1)}>
              {shown === 0 ? "Show first clue" : "Next clue"}
            </Button>
          )}
        </div>
        {shown > 0 && (
          <ol className="mt-3 space-y-3">
            {clues.slice(0, shown).map((c, i) => (
              <li key={i} className="flex gap-3">
                <Badge variant="secondary" shape="pill" className="mt-[3px] size-5 shrink-0 justify-center px-0 text-[11px] font-semibold">
                  {i + 1}
                </Badge>
                <div className="min-w-0 flex-1">{c}</div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </section>
  );
}

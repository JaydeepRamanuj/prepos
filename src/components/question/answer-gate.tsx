"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { useProgress } from "@/lib/progress/store";
import { useMockFor } from "@/lib/progress/mock";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
        <Label className="mt-8 text-[13px] font-normal text-ink-3">
          <Checkbox checked={autoReveal} onCheckedChange={(v) => setPref("autoReveal", v === true)} />
          Always show answers (reading mode)
        </Label>
      </div>
    );

  return (
    <div className="mt-8 rounded-xl border border-line bg-surface p-6 text-center">
      <p className="font-serif text-[17px] text-ink">Answer it out loud first.</p>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-ink-2">Say your 30-second answer, or write the code on paper, then compare.</p>
      <Button variant="highlight" size="lg" onClick={() => setRevealed(true)} className="mt-5 font-semibold">
        <Eye aria-hidden /> Reveal answer
      </Button>
      {!mock && (
        <Label className="mt-4 justify-center text-[13px] font-normal text-ink-3">
          <Checkbox checked={autoReveal} onCheckedChange={(v) => setPref("autoReveal", v === true)} />
          Always show answers
        </Label>
      )}
    </div>
  );
}

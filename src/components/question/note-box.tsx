"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { useProgress } from "@/lib/progress/store";
import { toKey } from "@/lib/content/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NoteBox({ id }: { id: string }) {
  const k = toKey(id);
  const saved = useProgress((s) => (s.hydrated ? (s.notes[k] ?? "") : ""));
  const setNote = useProgress((s) => s.setNote);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setDraft(saved), [saved]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (v: string) => {
    setDraft(v);
    setStatus("idle");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setNote(k, v);
      setStatus("saved");
    }, 700);
  };

  if (!open && !saved)
    return (
      <Button variant="ghost" onClick={() => setOpen(true)} className="mt-8 h-auto px-0 text-[14px] hover:bg-transparent">
        <NotebookPen aria-hidden /> Add a personal note
      </Button>
    );

  return (
    <div className="mt-8">
      <Label htmlFor={`note-${k}`} className="justify-between text-[14px] font-medium">
        <span className="flex items-center gap-2">
          <NotebookPen className="text-ink-3" aria-hidden /> Your note
        </span>
        <span className="text-[12px] font-normal text-ink-3" aria-live="polite">
          {status === "saved" ? "Saved" : ""}
        </span>
      </Label>
      <Textarea
        id={`note-${k}`}
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Your own words, a mnemonic, or where you saw this in your project…"
        className="mt-2 resize-y p-3 font-serif text-[15.5px] leading-relaxed"
      />
    </div>
  );
}

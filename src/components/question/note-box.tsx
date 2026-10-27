"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { useProgress } from "@/lib/progress/store";
import { toKey } from "@/lib/content/types";

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
      <button onClick={() => setOpen(true)} className="mt-8 flex items-center gap-2 text-[14px] text-ink-2 hover:text-ink">
        <NotebookPen className="h-4 w-4" aria-hidden /> Add a personal note
      </button>
    );

  return (
    <div className="mt-8">
      <label htmlFor={`note-${k}`} className="flex items-center justify-between text-[14px] font-medium">
        <span className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-ink-3" aria-hidden /> Your note
        </span>
        <span className="text-[12px] font-normal text-ink-3" aria-live="polite">
          {status === "saved" ? "Saved" : ""}
        </span>
      </label>
      <textarea
        id={`note-${k}`}
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Your own words, a mnemonic, or where you saw this in your project…"
        className="mt-2 w-full resize-y rounded-xl border border-line bg-surface p-3 font-serif text-[15.5px] leading-relaxed outline-none placeholder:text-ink-3 focus:border-blue"
      />
    </div>
  );
}

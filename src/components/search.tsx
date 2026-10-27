"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { QuestionIndexEntry } from "@/lib/content/types";
import { LevelPips } from "./level";
import { qHref } from "@/lib/utils";
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface SearchIndex {
  tracks: { id: string; title: string; short: string }[];
  questions: QuestionIndexEntry[];
}

let indexPromise: Promise<SearchIndex> | null = null;
export function loadIndex(): Promise<SearchIndex> {
  indexPromise ??= fetch("/search-index.json").then((r) => {
    if (!r.ok) throw new Error("index");
    return r.json();
  });
  indexPromise.catch(() => (indexPromise = null));
  return indexPromise;
}

/** Shared client-side hook for pages that need titles for arbitrary ids. */
export function useIndex() {
  const [data, setData] = useState<SearchIndex | null>(null);
  useEffect(() => {
    loadIndex().then(setData).catch(() => {});
  }, []);
  return data;
}

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useSearch = () => useContext(Ctx);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !isTyping(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {isOpen && <SearchDialog onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const index = useIndex();
  const [query, setQuery] = useState("");

  const trackTitle = useMemo(() => new Map(index?.tracks.map((t) => [t.id, t.short]) ?? []), [index]);

  // cmdk filters on `value`; keep it to title + tags + track for relevance.
  const items = index?.questions ?? [];
  const shown = query.trim() ? items : items.slice(0, 0);

  return (
    <CommandDialog open onOpenChange={(open) => !open && onClose()} title="Search questions" description="Search questions by title, topic or tag.">
      <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder="Search questions, topics, tags…" />
      <CommandList>
        {!index && <div className="px-3 py-6 text-[14px] text-ink-3">Loading questions…</div>}
        {index && !query.trim() && (
          <div className="px-3 py-6 text-[14px] text-ink-3">
            Type to search {items.length} questions. Try “closure”, “hydration” or “zustand”.
          </div>
        )}
        {index && query.trim() && <CommandEmpty>No questions match “{query}”.</CommandEmpty>}
        {shown.map((q) => (
          <CommandItem
            key={q.id}
            value={`${q.title} ${q.tags.join(" ")} ${trackTitle.get(q.track) ?? ""} ${q.id}`}
            onSelect={() => {
              onClose();
              router.push(qHref(q.id));
            }}
            className="flex-col items-start gap-1"
          >
            <span className="text-[15px] leading-snug text-ink">{q.title}</span>
            <span className="flex items-center gap-2 text-[12px] text-ink-3">
              <span>{trackTitle.get(q.track)}</span>
              <LevelPips level={q.level} />
            </span>
          </CommandItem>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

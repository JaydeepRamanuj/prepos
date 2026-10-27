"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, X } from "lucide-react";
import type { QuestionIndexEntry } from "@/lib/content/types";
import { LevelPips } from "./level";
import { qHref } from "@/lib/utils";

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

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const trackTitle = useMemo(() => new Map(index?.tracks.map((t) => [t.id, t.short]) ?? []), [index]);

  // cmdk filters on `value`; keep it to title + tags + track for relevance.
  const items = index?.questions ?? [];
  const shown = query.trim() ? items : items.slice(0, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-0 backdrop-blur-[2px] sm:p-4 sm:pt-[12vh]" onClick={onClose}>
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-surface shadow-2xl sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-xl sm:border sm:border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Search questions" className="flex min-h-0 flex-1 flex-col" onKeyDown={(e) => e.key === "Escape" && onClose()}>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search questions, topics, tags…"
              className="h-14 w-full bg-transparent text-[16px] outline-none placeholder:text-ink-3"
            />
            <button onClick={onClose} className="rounded-md p-1.5 text-ink-3 hover:bg-sunken" aria-label="Close search">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {!index && <div className="px-3 py-6 text-sm text-ink-3">Loading questions…</div>}
            {index && !query.trim() && (
              <div className="px-3 py-6 text-sm text-ink-3">
                Type to search {items.length} questions. Try “closure”, “hydration” or “zustand”.
              </div>
            )}
            {index && query.trim() && <Command.Empty className="px-3 py-6 text-sm text-ink-3">No questions match “{query}”.</Command.Empty>}
            {shown.map((q) => (
              <Command.Item
                key={q.id}
                value={`${q.title} ${q.tags.join(" ")} ${trackTitle.get(q.track) ?? ""} ${q.id}`}
                onSelect={() => {
                  onClose();
                  router.push(qHref(q.id));
                }}
                className="flex cursor-pointer flex-col gap-1 rounded-lg px-3 py-2.5 data-[selected=true]:bg-blue-soft"
              >
                <span className="text-[15px] leading-snug text-ink">{q.title}</span>
                <span className="flex items-center gap-2 text-[12px] text-ink-3">
                  <span>{trackTitle.get(q.track)}</span>
                  <LevelPips level={q.level} />
                </span>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

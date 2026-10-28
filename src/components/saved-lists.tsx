"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useProgress, type ListName } from "@/lib/progress/store";
import { useIndex } from "./search";
import { LevelPips } from "./level";
import { cn, qHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ItemList, itemRowLinkClass } from "@/components/item-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "revise" | "bookmarks" | "notes";
const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: "revise", label: "To revise", empty: "Tap “Revise later” on any question to add it here." },
  { id: "bookmarks", label: "Bookmarks", empty: "Bookmark questions you want to find again quickly." },
  { id: "notes", label: "Notes", empty: "Notes you add under a question show up here." },
];

const fromKey = (k: string) => k.replace("__", "/");

export function SavedLists() {
  const [tab, setTab] = useState<Tab>("revise");
  const { revise, bookmarks, notes, hydrated, toggle } = useProgress();
  const index = useIndex();

  const byId = useMemo(() => new Map(index?.questions.map((q) => [q.id, q]) ?? []), [index]);
  const trackShort = useMemo(() => new Map(index?.tracks.map((t) => [t.id, t.short]) ?? []), [index]);

  const keys = useMemo(() => {
    const src = tab === "revise" ? revise : tab === "bookmarks" ? bookmarks : null;
    if (src) return Object.entries(src).sort((a, b) => b[1] - a[1]).map(([k]) => k);
    return Object.keys(notes);
  }, [tab, revise, bookmarks, notes]);

  const counts = { revise: Object.keys(revise).length, bookmarks: Object.keys(bookmarks).length, notes: Object.keys(notes).length };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-6">
      <TabsList>
        {TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
            {hydrated && counts[t.id] > 0 && <span className="ml-1.5 tabular-nums text-ink-3">{counts[t.id]}</span>}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value={tab}>
        {!hydrated || (!index && keys.length > 0) ? (
          <p className="py-10 text-center text-[14px] text-ink-3">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="py-10 text-center text-[14.5px] text-ink-2">{TABS.find((t) => t.id === tab)!.empty}</p>
        ) : (
          <ItemList className="mt-4">
            {keys.map((k) => {
              const q = byId.get(fromKey(k));
              if (!q) return null; // question removed from the content
              return (
                <li key={k} className="flex items-start">
                  <Link href={qHref(q.id)} className={cn(itemRowLinkClass, "flex-col gap-1 px-4 py-3")}>
                    <span className="text-[15px] leading-snug">{q.title}</span>
                    <span className="flex items-center gap-2 text-[12.5px] text-ink-3">
                      <span>{trackShort.get(q.track)}</span>
                      <LevelPips level={q.level} />
                    </span>
                    {tab === "notes" && <span className="mt-1 line-clamp-3 font-serif text-[14.5px] text-ink-2">{notes[k]}</span>}
                  </Link>
                  {tab !== "notes" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggle(tab as ListName, k)}
                      className="m-2 text-ink-3 hover:text-ink"
                      aria-label={`Remove "${q.title}" from ${tab === "revise" ? "revision list" : "bookmarks"}`}
                    >
                      <X />
                    </Button>
                  )}
                </li>
              );
            })}
          </ItemList>
        )}
      </TabsContent>
    </Tabs>
  );
}

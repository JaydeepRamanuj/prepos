"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Check, ChevronLeft, RotateCcw } from "lucide-react";
import type { Level } from "@/lib/content/types";
import { toKey } from "@/lib/content/types";
import { useProgress } from "@/lib/progress/store";
import { LevelPips } from "./level";
import { Prose } from "./prose";
import { cn, qHref } from "@/lib/utils";

interface Card {
  id: string;
  title: string;
  level: Level;
  chapter: string;
  html: string;
}

type Filter = "all" | "revise" | "todo";

export function ReviseFeed({ trackTitle, trackId, cards }: { trackTitle: string; trackId: string; cards: Card[] }) {
  const { solved, revise, hydrated, toggle } = useProgress();
  const [filter, setFilter] = useState<Filter>("all");
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const list = useMemo(() => {
    let l = cards;
    if (hydrated && filter === "revise") l = l.filter((c) => revise[toKey(c.id)]);
    if (hydrated && filter === "todo") l = l.filter((c) => !solved[toKey(c.id)]);
    if (shuffleSeed) {
      l = [...l];
      for (let i = l.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [l[i], l[j]] = [l[j], l[i]];
      }
    }
    return l;
    // revise/solved are read at filter time on purpose: toggling a card shouldn't make it vanish mid-swipe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, filter, hydrated, shuffleSeed]);

  return (
    <div className="-mx-4 flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <Link href="/revise" className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-sunken" aria-label="Back to Quick revise">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{trackTitle}</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-2"
          aria-label="Which answers"
        >
          <option value="all">All</option>
          <option value="todo">Unsolved</option>
          <option value="revise">Revision list</option>
        </select>
        <button onClick={() => setShuffleSeed((s) => s + 1)} className="rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-2">
          Shuffle
        </button>
      </div>

      {list.length === 0 ? (
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div>
            <p className="text-[15px] text-ink-2">Nothing here with this filter.</p>
            <button onClick={() => setFilter("all")} className="mt-3 text-[14px] font-medium text-blue">
              Show all answers
            </button>
          </div>
        </div>
      ) : (
        <div className="snap-feed flex-1 overflow-y-auto overscroll-contain" key={`${filter}-${shuffleSeed}`}>
          {list.map((c, i) => {
            const k = toKey(c.id);
            const isSolved = hydrated && !!solved[k];
            const inRevise = hydrated && !!revise[k];
            return (
              <article key={c.id} className="flex min-h-full flex-col px-4 pb-5 pt-5">
                <div className="mx-auto flex w-full max-w-[680px] flex-1 flex-col">
                  <div className="flex items-center justify-between text-[12.5px] text-ink-3">
                    <span className="truncate">{c.chapter}</span>
                    <span className="shrink-0 tabular-nums">
                      {i + 1} / {list.length}
                    </span>
                  </div>
                  <h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug tracking-tight md:text-[26px]">{c.title}</h2>
                  <LevelPips level={c.level} className="mt-2" />
                  <div className="mt-5 flex-1">
                    <Prose html={c.html} className="text-[17px]" />
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => toggle("solved", k)}
                      aria-pressed={isSolved}
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13.5px]",
                        isSolved ? "border-good bg-good text-surface" : "border-line bg-surface text-ink-2",
                      )}
                    >
                      <Check className="h-4 w-4" aria-hidden /> {isSolved ? "Solved" : "Got it"}
                    </button>
                    <button
                      onClick={() => toggle("revise", k)}
                      aria-pressed={inRevise}
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13.5px]",
                        inRevise ? "border-hl bg-hl text-hl-ink" : "border-line bg-surface text-ink-2",
                      )}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden /> {inRevise ? "In revision list" : "Revise later"}
                    </button>
                    <Link href={qHref(c.id)} className="ml-auto flex h-9 items-center gap-1 px-1 text-[13.5px] font-medium text-blue">
                      Full answer <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                  {i === 0 && list.length > 1 && <p className="mt-4 text-center text-[12.5px] text-ink-3">Swipe up for the next answer</p>}
                </div>
              </article>
            );
          })}
          <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-serif text-[20px]">That&apos;s every answer in {trackTitle}.</p>
            <Link href={`/tracks/${trackId}`} className="text-[14.5px] font-medium text-blue">
              Go to the track
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

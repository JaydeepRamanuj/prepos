"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bookmark, Check, CheckCircle2, Circle, RotateCcw } from "lucide-react";
import { LEVELS, LEVEL_LABEL, QUESTION_TYPES, TYPE_LABEL, toKey, type Level, type QuestionIndexEntry, type QuestionType, type TrackMeta } from "@/lib/content/types";
import { useProgress } from "@/lib/progress/store";
import { chapterKey, cn, qHref } from "@/lib/utils";
import { LevelPips, TypeChip } from "./level";
import { ProgressBar } from "./progress";

type Status = "all" | "todo" | "solved" | "revise" | "bookmarked";
const STATUS_LABEL: Record<Status, string> = {
  all: "All",
  todo: "Unsolved",
  solved: "Solved",
  revise: "To revise",
  bookmarked: "Bookmarked",
};

export function TrackBrowser({ track, questions }: { track: TrackMeta; questions: QuestionIndexEntry[] }) {
  const { solved, revise, bookmarks, chapters, hydrated, toggle } = useProgress();
  const [levels, setLevels] = useState<Level[]>([]);
  const [type, setType] = useState<QuestionType | "all">("all");
  const [status, setStatus] = useState<Status>("all");

  const typesPresent = useMemo(() => QUESTION_TYPES.filter((t) => questions.some((q) => q.type === t)), [questions]);

  const visible = (q: QuestionIndexEntry) => {
    const k = toKey(q.id);
    if (levels.length && !levels.includes(q.level)) return false;
    if (type !== "all" && q.type !== type) return false;
    if (!hydrated) return status === "all";
    if (status === "todo") return !solved[k];
    if (status === "solved") return !!solved[k];
    if (status === "revise") return !!revise[k];
    if (status === "bookmarked") return !!bookmarks[k];
    return true;
  };

  const filtered = levels.length > 0 || type !== "all" || status !== "all";
  const shownCount = questions.filter(visible).length;

  return (
    <div className="mt-8">
      {/* Filters */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-line bg-paper/90 px-4 py-2.5 backdrop-blur-md">
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {LEVELS.map((l) => {
            const on = levels.includes(l);
            return (
              <button
                key={l}
                onClick={() => setLevels((v) => (on ? v.filter((x) => x !== l) : [...v, l]))}
                aria-pressed={on}
                className={cn(
                  "flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[13px]",
                  on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                )}
              >
                {on ? LEVEL_LABEL[l] : <LevelPips level={l} />}
              </button>
            );
          })}
          <span className="mx-1 w-px shrink-0 bg-line" aria-hidden />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-2"
            aria-label="Filter by status"
          >
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {typesPresent.length > 1 && (
            <select
              value={type}
              onChange={(e) => setType(e.target.value as QuestionType | "all")}
              className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-2"
              aria-label="Filter by type"
            >
              <option value="all">All types</option>
              {typesPresent.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          )}
          {filtered && (
            <button
              onClick={() => {
                setLevels([]);
                setType("all");
                setStatus("all");
              }}
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[13px] text-blue"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Clear
            </button>
          )}
        </div>
      </div>

      {filtered && (
        <p className="mt-4 text-[13px] text-ink-3">
          Showing {shownCount} of {questions.length}
        </p>
      )}

      {/* Chapters */}
      <div className="mt-6 space-y-9">
        {track.chapters.map((c, ci) => {
          const all = questions.filter((q) => q.chapter === c.id);
          if (!all.length) return null;
          const items = all.filter(visible);
          if (filtered && !items.length) return null;
          const done = hydrated ? all.filter((q) => solved[toKey(q.id)]).length : 0;
          const ck = chapterKey(track.id, c.id);
          const complete = hydrated && (done === all.length || !!chapters[ck]);

          return (
            <section key={c.id} id={c.id} aria-labelledby={`ch-${c.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 id={`ch-${c.id}`} className="flex items-baseline gap-2 text-[17px] font-semibold">
                    <span className="tabular-nums text-ink-3">{ci + 1}.</span>
                    {c.title}
                    {complete && <CheckCircle2 className="h-4 w-4 self-center text-good" aria-label="Chapter complete" />}
                  </h2>
                  <p className="mt-0.5 text-[13.5px] text-ink-2">{c.description}</p>
                </div>
                {hydrated && done < all.length && (
                  <button
                    onClick={() => toggle("chapters", ck)}
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[12.5px]",
                      chapters[ck] ? "border-good bg-good-soft text-good" : "border-line text-ink-3 hover:text-ink",
                    )}
                    aria-pressed={!!chapters[ck]}
                  >
                    {chapters[ck] ? "Marked done" : "Mark done"}
                  </button>
                )}
              </div>
              <div className="mt-2.5 flex items-center gap-3">
                <ProgressBar value={done} total={all.length} className="max-w-48" />
                <span className="text-[12.5px] tabular-nums text-ink-3">
                  {done}/{all.length}
                </span>
              </div>

              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {items.map((q) => {
                  const k = toKey(q.id);
                  const isSolved = hydrated && !!solved[k];
                  return (
                    <li key={q.id} className="flex items-center">
                      <button
                        onClick={() => toggle("solved", k)}
                        className="grid h-full shrink-0 place-items-center self-stretch pl-3.5 pr-1"
                        aria-label={isSolved ? `Mark "${q.title}" unsolved` : `Mark "${q.title}" solved`}
                        aria-pressed={isSolved}
                      >
                        {isSolved ? (
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-good text-surface">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        ) : (
                          <Circle className="h-5 w-5 text-line-strong" strokeWidth={1.5} />
                        )}
                      </button>
                      <Link href={qHref(q.id)} className="group flex min-w-0 flex-1 flex-col gap-1 py-3 pl-2.5 pr-4 hover:bg-sunken/50">
                        <span className={cn("text-[15px] leading-snug group-hover:text-blue", isSolved && "text-ink-2")}>{q.title}</span>
                        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <LevelPips level={q.level} />
                          {q.type !== "concept" && <TypeChip type={q.type} />}
                          {hydrated && revise[k] && <span className="rounded bg-hl-soft px-1.5 text-[12px] text-ink">Revise</span>}
                          {hydrated && bookmarks[k] && <Bookmark className="h-3.5 w-3.5 fill-current text-blue" aria-label="Bookmarked" />}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {filtered && shownCount === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong p-8 text-center text-[14px] text-ink-2">
            No questions match these filters.
          </div>
        )}
      </div>
    </div>
  );
}

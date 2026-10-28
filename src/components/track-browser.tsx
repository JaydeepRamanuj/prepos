"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bookmark, Check, CheckCircle2, Circle, RotateCcw } from "lucide-react";
import { LEVELS, LEVEL_LABEL, QUESTION_TYPES, TYPE_LABEL, toKey, type Level, type QuestionIndexEntry, type QuestionType, type TrackMeta } from "@/lib/content/types";
import { useProgress } from "@/lib/progress/store";
import { chapterKey, cn, qHref } from "@/lib/utils";
import { ItemList, itemRowLinkClass } from "@/components/item-list";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Toggle } from "@/components/ui/toggle";
import { LevelPips, TypeChip } from "./level";
import { ProgressBar } from "./progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Status = "all" | "todo" | "solved" | "revise" | "bookmarked";
const STATUS_LABEL: Record<Status, string> = {
  all: "All",
  todo: "Unsolved",
  solved: "Solved",
  revise: "To revise",
  bookmarked: "Bookmarked",
};

const FILTER_TRIGGER = "h-8 shrink-0 rounded-full px-3 text-[13px]";

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
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <ToggleGroup type="multiple" value={levels} onValueChange={(v) => setLevels(v as Level[])} className="shrink-0 flex-nowrap" aria-label="Filter by difficulty">
            {LEVELS.map((l) => (
              <ToggleGroupItem key={l} value={l} size="sm" aria-label={LEVEL_LABEL[l]}>
                {levels.includes(l) ? LEVEL_LABEL[l] : <LevelPips level={l} />}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger className={FILTER_TRIGGER} aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {typesPresent.length > 1 && (
            <Select value={type} onValueChange={(v) => setType(v as QuestionType | "all")}>
              <SelectTrigger className={FILTER_TRIGGER} aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {typesPresent.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              shape="pill"
              onClick={() => {
                setLevels([]);
                setType("all");
                setStatus("all");
              }}
              className="shrink-0 text-primary hover:text-primary"
            >
              <RotateCcw aria-hidden /> Clear
            </Button>
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
                  <Button
                    variant="outline"
                    size="sm"
                    shape="pill"
                    onClick={() => toggle("chapters", ck)}
                    className={cn("shrink-0 text-[12.5px]", chapters[ck] ? "border-good bg-good-soft text-good hover:text-good" : "text-ink-3 hover:text-ink")}
                    aria-pressed={!!chapters[ck]}
                  >
                    {chapters[ck] ? "Marked done" : "Mark done"}
                  </Button>
                )}
              </div>
              <div className="mt-2.5 flex items-center gap-3">
                <ProgressBar value={done} total={all.length} className="max-w-48" />
                <span className="text-[12.5px] tabular-nums text-ink-3">
                  {done}/{all.length}
                </span>
              </div>

              <ItemList className="mt-3">
                {items.map((q) => {
                  const k = toKey(q.id);
                  const isSolved = hydrated && !!solved[k];
                  return (
                    <li key={q.id} className="flex items-center">
                      <Toggle
                        pressed={isSolved}
                        onPressedChange={() => toggle("solved", k)}
                        className="h-auto shrink-0 self-stretch rounded-none pl-3.5 pr-1 hover:bg-transparent data-[state=on]:bg-transparent"
                        aria-label={isSolved ? `Mark "${q.title}" unsolved` : `Mark "${q.title}" solved`}
                      >
                        {isSolved ? (
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-good text-surface">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        ) : (
                          <Circle className="h-5 w-5 text-line-strong" strokeWidth={1.5} />
                        )}
                      </Toggle>
                      <Link href={qHref(q.id)} className={cn(itemRowLinkClass, "group flex-col gap-1 py-3 pl-2.5 pr-4")}>
                        <span className={cn("text-[15px] leading-snug group-hover:text-primary", isSolved && "text-ink-2")}>{q.title}</span>
                        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <LevelPips level={q.level} />
                          {q.type !== "concept" && <TypeChip type={q.type} />}
                          {hydrated && revise[k] && <Badge variant="highlight">Revise</Badge>}
                          {hydrated && bookmarks[k] && <Bookmark className="h-3.5 w-3.5 fill-current text-primary" aria-label="Bookmarked" />}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ItemList>
            </section>
          );
        })}
        {filtered && shownCount === 0 && (
          <Empty className="border border-dashed border-input p-8 md:p-8">
            <EmptyHeader>
              <EmptyDescription className="text-[14px] text-ink-2">No questions match these filters.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}

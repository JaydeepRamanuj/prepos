"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, Check, RotateCcw } from "lucide-react";
import { useProgress } from "@/lib/progress/store";
import { toKey } from "@/lib/content/types";
import { useMockFor } from "@/lib/progress/mock";
import { cn } from "@/lib/utils";

export function QuestionActions({ id, className }: { id: string; className?: string }) {
  const k = toKey(id);
  const solved = useProgress((s) => s.hydrated && !!s.solved[k]);
  const revise = useProgress((s) => s.hydrated && !!s.revise[k]);
  const bookmarked = useProgress((s) => s.hydrated && !!s.bookmarks[k]);
  const toggle = useProgress((s) => s.toggle);

  const base = "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13.5px] transition-colors";
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button
        onClick={() => toggle("solved", k)}
        aria-pressed={solved}
        className={cn(base, solved ? "border-good bg-good text-surface" : "border-line bg-surface text-ink-2 hover:border-line-strong")}
      >
        <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden />
        {solved ? "Solved" : "Mark solved"}
      </button>
      <button
        onClick={() => toggle("revise", k)}
        aria-pressed={revise}
        className={cn(base, revise ? "border-hl bg-hl text-hl-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong")}
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        {revise ? "In revision list" : "Revise later"}
      </button>
      <button
        onClick={() => toggle("bookmarks", k)}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
        className={cn(base, "px-2.5", bookmarked ? "border-blue bg-blue-soft text-blue" : "border-line bg-surface text-ink-2 hover:border-line-strong")}
      >
        <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} aria-hidden />
      </button>
    </div>
  );
}

/** End-of-question bar: mark solved and move on (or continue the mock round). */
export function NextBar({ id, nextHref, nextLabel }: { id: string; nextHref: string; nextLabel: string }) {
  const k = toKey(id);
  const router = useRouter();
  const solved = useProgress((s) => s.hydrated && !!s.solved[k]);
  const toggle = useProgress((s) => s.toggle);
  const mock = useMockFor(id);

  if (mock) return null; // the mock bar owns navigation during a round

  return (
    <div className="mt-10 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-ink-3">Up next</div>
        <div className="truncate text-[14.5px]">{nextLabel}</div>
      </div>
      <div className="flex gap-2">
        {!solved && (
          <button
            onClick={() => {
              toggle("solved", k);
              router.push(nextHref);
            }}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue px-4 text-[14px] font-medium text-surface sm:flex-none"
          >
            <Check className="h-4 w-4" aria-hidden /> Solved, next
          </button>
        )}
        <Link
          href={nextHref}
          className={cn(
            "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-[14px] sm:flex-none",
            solved ? "bg-blue font-medium text-surface" : "border border-line text-ink-2 hover:border-line-strong",
          )}
        >
          {solved ? "Next" : "Skip"} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

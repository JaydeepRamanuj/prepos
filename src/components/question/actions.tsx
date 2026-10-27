"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, Check, RotateCcw } from "lucide-react";
import { useProgress } from "@/lib/progress/store";
import { toKey } from "@/lib/content/types";
import { useMockFor } from "@/lib/progress/mock";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";

export function QuestionActions({ id, className }: { id: string; className?: string }) {
  const k = toKey(id);
  const solved = useProgress((s) => s.hydrated && !!s.solved[k]);
  const revise = useProgress((s) => s.hydrated && !!s.revise[k]);
  const bookmarked = useProgress((s) => s.hydrated && !!s.bookmarks[k]);
  const toggle = useProgress((s) => s.toggle);

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Toggle
        variant="outline"
        pressed={solved}
        onPressedChange={() => toggle("solved", k)}
        className="rounded-full data-[state=on]:border-good data-[state=on]:bg-good data-[state=on]:text-surface"
      >
        <Check className="size-4" strokeWidth={2.4} aria-hidden />
        {solved ? "Solved" : "Mark solved"}
      </Toggle>
      <Toggle
        variant="outline"
        pressed={revise}
        onPressedChange={() => toggle("revise", k)}
        className="rounded-full data-[state=on]:border-hl data-[state=on]:bg-hl data-[state=on]:text-hl-ink"
      >
        <RotateCcw aria-hidden />
        {revise ? "In revision list" : "Revise later"}
      </Toggle>
      <Toggle
        variant="outline"
        size="icon"
        pressed={bookmarked}
        onPressedChange={() => toggle("bookmarks", k)}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
        className="rounded-full data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-primary"
      >
        <Bookmark className={cn(bookmarked && "fill-current")} aria-hidden />
      </Toggle>
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
          <Button
            onClick={() => {
              toggle("solved", k);
              router.push(nextHref);
            }}
            className="h-10 flex-1 px-4 sm:flex-none"
          >
            <Check aria-hidden /> Solved, next
          </Button>
        )}
        <Button asChild variant={solved ? "default" : "outline"} className="h-10 flex-1 px-4 sm:flex-none">
          <Link href={nextHref}>
            {solved ? "Next" : "Skip"} <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

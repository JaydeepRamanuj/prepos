"use client";

import { useProgress } from "@/lib/progress/store";
import { toKey } from "@/lib/content/types";
import { cn } from "@/lib/utils";

export function useSolvedCount(ids: string[]) {
  const solved = useProgress((s) => s.solved);
  const hydrated = useProgress((s) => s.hydrated);
  if (!hydrated) return 0;
  let n = 0;
  for (const id of ids) if (solved[toKey(id)]) n++;
  return n;
}

export function ProgressBar({ value, total, className }: { value: number; total: number; className?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-sunken", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
    >
      <div className="h-full rounded-full bg-good transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SolvedProgress({ ids, className, showText = true }: { ids: string[]; className?: string; showText?: boolean }) {
  const n = useSolvedCount(ids);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <ProgressBar value={n} total={ids.length} />
      {showText && (
        <span className="shrink-0 text-[13px] tabular-nums text-ink-2">
          {n}/{ids.length}
        </span>
      )}
    </div>
  );
}

import { LEVELS, LEVEL_LABEL, TYPE_LABEL, type Level, type QuestionType } from "@/lib/content/types";
import { cn } from "@/lib/utils";

const color: Record<Level, string> = {
  easy: "var(--lv-easy)",
  medium: "var(--lv-medium)",
  hard: "var(--lv-hard)",
  advanced: "var(--lv-advanced)",
};

/** Difficulty as 1–4 filled pips plus the word, so it reads without color too. */
export function LevelPips({ level, showLabel = true, className }: { level: Level; showLabel?: boolean; className?: string }) {
  const n = LEVELS.indexOf(level) + 1;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", className)} style={{ color: color[level] }}>
      <span className="inline-flex gap-[3px]" aria-hidden>
        {LEVELS.map((_, i) => (
          <span
            key={i}
            className="h-[7px] w-[7px] rounded-full border"
            style={{ borderColor: color[level], background: i < n ? color[level] : "transparent" }}
          />
        ))}
      </span>
      {showLabel ? <span>{LEVEL_LABEL[level]}</span> : <span className="sr-only">{LEVEL_LABEL[level]}</span>}
    </span>
  );
}

export function TypeChip({ type, className }: { type: QuestionType; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border border-line px-1.5 py-[1px] text-[12px] text-ink-2", className)}>
      {TYPE_LABEL[type]}
    </span>
  );
}

import { LEVELS, LEVEL_LABEL, TYPE_LABEL, type Level, type QuestionType } from "@/lib/content/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tone: Record<Level, string> = {
  easy: "text-lv-easy",
  medium: "text-lv-medium",
  hard: "text-lv-hard",
  advanced: "text-lv-advanced",
};

/** Difficulty as 1–4 filled pips plus the word, so it reads without color too. */
export function LevelPips({ level, showLabel = true, className }: { level: Level; showLabel?: boolean; className?: string }) {
  const n = LEVELS.indexOf(level) + 1;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", tone[level], className)}>
      <span className="inline-flex gap-[3px]" aria-hidden>
        {LEVELS.map((_, i) => (
          <span key={i} className={cn("size-[7px] rounded-full border border-current", i < n ? "bg-current" : "bg-transparent")} />
        ))}
      </span>
      {showLabel ? <span>{LEVEL_LABEL[level]}</span> : <span className="sr-only">{LEVEL_LABEL[level]}</span>}
    </span>
  );
}

export function TypeChip({ type, className }: { type: QuestionType; className?: string }) {
  return <Badge className={className}>{TYPE_LABEL[type]}</Badge>;
}

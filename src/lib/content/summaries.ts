import "server-only";
import { getQuestions, getTracks } from "./load";
import type { TrackSummary } from "@/components/track-list";

export function getTrackSummaries(): TrackSummary[] {
  const qs = getQuestions();
  return getTracks().map((meta) => {
    const own = qs.filter((q) => q.track === meta.id);
    const count = (l: string) => own.filter((q) => q.level === l).length;
    return {
      meta,
      ids: own.map((q) => q.id),
      levels: { easy: count("easy"), medium: count("medium"), hard: count("hard"), advanced: count("advanced") },
    };
  });
}

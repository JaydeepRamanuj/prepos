import Link from "next/link";
import type { TrackMeta } from "@/lib/content/types";
import { TrackIcon } from "./track-icon";
import { SolvedProgress } from "./progress";

export interface TrackSummary {
  meta: TrackMeta;
  ids: string[];
  levels: { easy: number; medium: number; hard: number; advanced: number };
}

const GROUPS: { id: TrackMeta["group"]; title: string; blurb: string }[] = [
  { id: "core", title: "Core", blurb: "The three tracks most frontend interviews are built on." },
  { id: "frontend", title: "Frontend toolkit", blurb: "TypeScript, CSS, state and performance." },
  { id: "engineering", title: "Engineering depth", blurb: "Debugging, architecture, building from scratch, the web platform and the backend." },
  { id: "career", title: "Working style", blurb: "How you work with AI, and how you talk about your work." },
];

export function TrackList({ tracks, showDescriptions = false }: { tracks: TrackSummary[]; showDescriptions?: boolean }) {
  return (
    <div className="space-y-10">
      {GROUPS.map((g) => {
        const items = tracks.filter((t) => t.meta.group === g.id);
        if (!items.length) return null;
        return (
          <section key={g.id} aria-labelledby={`g-${g.id}`}>
            <div className="mb-3">
              <h2 id={`g-${g.id}`} className="text-[15px] font-semibold">
                {g.title}
              </h2>
              <p className="text-[13px] text-ink-3">{g.blurb}</p>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {items.map((t) => (
                <li key={t.meta.id}>
                  <Link href={`/tracks/${t.meta.id}`} className="group flex items-start gap-3.5 px-4 py-3.5 hover:bg-sunken/60">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                      <TrackIcon name={t.meta.icon} className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-[15.5px] font-medium group-hover:text-primary">{t.meta.title}</span>
                        <span className="shrink-0 text-[12.5px] text-ink-3">{t.ids.length} questions</span>
                      </span>
                      {showDescriptions && <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-2">{t.meta.description}</span>}
                      <SolvedProgress ids={t.ids} className="mt-2.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

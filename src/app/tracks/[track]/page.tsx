import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTrack, getTrackQuestions, getTracks } from "@/lib/content/load";
import { toIndexEntry } from "@/lib/content/load";
import { TrackIcon } from "@/components/track-icon";
import { TrackBrowser } from "@/components/track-browser";
import { SolvedProgress } from "@/components/progress";
import { LevelPips } from "@/components/level";
import { LEVELS } from "@/lib/content/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return getTracks().map((t) => ({ track: t.id }));
}

export async function generateMetadata({ params }: PageProps<"/tracks/[track]">): Promise<Metadata> {
  const { track } = await params;
  const t = getTrack(track);
  return t ? { title: t.title, description: t.description } : {};
}

export default async function TrackPage({ params }: PageProps<"/tracks/[track]">) {
  const { track } = await params;
  const meta = getTrack(track);
  if (!meta) notFound();
  const questions = getTrackQuestions(track).map(toIndexEntry);
  const ids = questions.map((q) => q.id);

  return (
    <div className="pt-8 md:pt-12">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary">
          <TrackIcon name={meta.icon} className="h-5 w-5" />
        </span>
        <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-tight md:text-[36px]">{meta.title}</h1>
      </div>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">{meta.description}</p>
      <div className="mt-5 flex max-w-2xl flex-col gap-3">
        <SolvedProgress ids={ids} />
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {LEVELS.map((l) => {
            const n = questions.filter((q) => q.level === l).length;
            return n ? (
              <span key={l} className="flex items-center gap-1.5 text-[13px] text-ink-2">
                <LevelPips level={l} /> <span className="tabular-nums text-ink-3">{n}</span>
              </span>
            ) : null;
          })}
        </div>
      </div>

      <TrackBrowser track={meta} questions={questions} />
    </div>
  );
}

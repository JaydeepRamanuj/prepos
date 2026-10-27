import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTrackSummaries } from "@/lib/content/summaries";
import { TrackIcon } from "@/components/track-icon";
import { ReviseListLink } from "@/components/revise-list-link";

export const metadata: Metadata = { title: "Quick revise" };

export default function RevisePage() {
  const tracks = getTrackSummaries().filter((t) => t.ids.length > 0);
  return (
    <div className="mx-auto max-w-[720px] pt-8 md:pt-12">
      <h1 className="font-serif text-[28px] font-semibold tracking-tight md:text-[34px]">Quick revise</h1>
      <p className="mt-2 max-w-lg text-[15px] text-ink-2">
        Just the interview answers, one per screen. Swipe up for the next one — made for the commute.
      </p>

      <ReviseListLink />

      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {tracks.map((t) => (
          <li key={t.meta.id}>
            <Link href={`/revise/${t.meta.id}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-sunken/60">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                <TrackIcon name={t.meta.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-medium">{t.meta.title}</span>
                <span className="block text-[13px] text-ink-3">{t.ids.length} answers</span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

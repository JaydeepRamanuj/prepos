import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { getTrackSummaries } from "@/lib/content/summaries";
import { ItemLink, ItemList } from "@/components/item-list";
import { TrackIcon } from "@/components/track-icon";
import { ReviseListLink } from "@/components/revise-list-link";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Quick revise" };

export default function RevisePage() {
  const tracks = getTrackSummaries().filter((t) => t.ids.length > 0);
  return (
    <div className="mx-auto max-w-[720px] pt-8 md:pt-12">
      <h1 className="font-serif text-[28px] font-semibold tracking-tight md:text-[34px]">Quick revise</h1>
      <p className="mt-2 max-w-lg text-[15px] text-ink-2">
        {copy.reviseIntro}
      </p>

      <ReviseListLink />

      <ItemList className="mt-6">
        {tracks.map((t) => (
          <ItemLink key={t.meta.id} href={`/revise/${t.meta.id}`} className="items-center gap-3.5 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
              <TrackIcon name={t.meta.icon} className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-medium">{t.meta.title}</span>
              <span className="block text-[13px] text-ink-3">{t.ids.length} answers</span>
            </span>
            <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
          </ItemLink>
        ))}
      </ItemList>
    </div>
  );
}

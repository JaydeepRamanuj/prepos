import type { Metadata } from "next";
import { getTrackSummaries } from "@/lib/content/summaries";
import { TrackList } from "@/components/track-list";

export const metadata: Metadata = { title: "Tracks" };

export default function TracksPage() {
  const tracks = getTrackSummaries();
  const total = tracks.reduce((n, t) => n + t.ids.length, 0);
  return (
    <div className="pt-8 md:pt-12">
      <h1 className="font-serif text-[30px] font-semibold tracking-tight md:text-[36px]">Tracks</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        {tracks.length} tracks, {total} questions. Each track is split into chapters that go from easy to advanced.
      </p>
      <div className="mt-8">
        <TrackList tracks={tracks} showDescriptions />
      </div>
    </div>
  );
}

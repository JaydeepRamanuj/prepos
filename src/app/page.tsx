import { getTrackSummaries } from "@/lib/content/summaries";
import { TrackList } from "@/components/track-list";
import { HomeHero } from "@/components/home-hero";

export default function HomePage() {
  const tracks = getTrackSummaries();
  const allIds = tracks.flatMap((t) => t.ids);
  const core = tracks.filter((t) => t.meta.group === "core").reduce((n, t) => n + t.ids.length, 0);

  return (
    <div className="pt-8 md:pt-12">
      <HomeHero allIds={allIds} trackCount={tracks.length} coreCount={core} />
      <div className="mt-12">
        <TrackList tracks={tracks} />
      </div>
    </div>
  );
}

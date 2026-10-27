import type { Metadata } from "next";
import { getTrackSummaries } from "@/lib/content/summaries";
import { MockSetup } from "@/components/mock-setup";

export const metadata: Metadata = { title: "Mock round" };

export default function MockPage() {
  const tracks = getTrackSummaries()
    .filter((t) => t.ids.length > 0)
    .map((t) => ({ id: t.meta.id, title: t.meta.title, group: t.meta.group, count: t.ids.length }));
  return (
    <div className="mx-auto max-w-[720px] pt-8 md:pt-12">
      <MockSetup tracks={tracks} />
    </div>
  );
}

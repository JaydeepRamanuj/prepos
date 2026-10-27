import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTrack, getTrackQuestions, getTracks } from "@/lib/content/load";
import { renderMarkdown } from "@/lib/content/markdown";
import { ReviseFeed } from "@/components/revise-feed";

export const dynamicParams = false;

export function generateStaticParams() {
  return getTracks().map((t) => ({ track: t.id }));
}

export async function generateMetadata({ params }: PageProps<"/revise/[track]">): Promise<Metadata> {
  const { track } = await params;
  const t = getTrack(track);
  return t ? { title: `Revise ${t.title}` } : {};
}

export default async function ReviseTrackPage({ params }: PageProps<"/revise/[track]">) {
  const { track } = await params;
  const meta = getTrack(track);
  if (!meta) notFound();
  const qs = getTrackQuestions(track);
  const cards = await Promise.all(
    qs.map(async (q) => ({
      id: q.id,
      title: q.title,
      level: q.level,
      chapter: meta.chapters.find((c) => c.id === q.chapter)?.title ?? "",
      html: await renderMarkdown(q.answer),
    })),
  );
  return <ReviseFeed trackTitle={meta.title} trackId={meta.id} cards={cards} />;
}

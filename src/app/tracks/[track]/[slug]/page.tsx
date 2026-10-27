import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getQuestion, getQuestions, getTrack, getTrackQuestions, getTracks } from "@/lib/content/load";
import { renderMarkdown } from "@/lib/content/markdown";
import { LevelPips, TypeChip } from "@/components/level";
import { Prose } from "@/components/prose";
import { QuestionActions, NextBar } from "@/components/question/actions";
import { Clues } from "@/components/question/clues";
import { AnswerGate } from "@/components/question/answer-gate";
import { NoteBox } from "@/components/question/note-box";
import { MockBar } from "@/components/question/mock-bar";
import { VisitTracker } from "@/components/question/visit-tracker";
import { qHref } from "@/lib/utils";

export const dynamicParams = false;

export function generateStaticParams() {
  return getQuestions().map((q) => ({ track: q.track, slug: q.slug }));
}

export async function generateMetadata({ params }: PageProps<"/tracks/[track]/[slug]">): Promise<Metadata> {
  const { track, slug } = await params;
  const q = getQuestion(track, slug);
  const t = getTrack(track);
  return q ? { title: `${q.title} — ${t?.short ?? track}` } : {};
}

export default async function QuestionPage({ params }: PageProps<"/tracks/[track]/[slug]">) {
  const { track, slug } = await params;
  const q = getQuestion(track, slug);
  const meta = getTrack(track);
  if (!q || !meta) notFound();

  const siblings = getTrackQuestions(track);
  const i = siblings.findIndex((s) => s.id === q.id);
  const prev = siblings[i - 1];
  const next = siblings[i + 1];
  const chapter = meta.chapters.find((c) => c.id === q.chapter);

  const all = getQuestions();
  const related = q.related.map((r) => all.find((x) => x.id === r)).filter((x): x is NonNullable<typeof x> => !!x);
  const trackShort = new Map(getTracks().map((t) => [t.id, t.short]));

  const [questionHtml, answerHtml, explanationHtml, followUpsHtml, mistakesHtml, tipsHtml, ...clueHtml] = await Promise.all([
    renderMarkdown(q.question),
    renderMarkdown(q.answer),
    renderMarkdown(q.explanation),
    renderMarkdown(q.followUps),
    renderMarkdown(q.mistakes),
    renderMarkdown(q.tips),
    ...q.clues.map((c) => renderMarkdown(c)),
  ]);

  return (
    <article className="mx-auto max-w-[720px] pt-6 md:pt-10">
      <VisitTracker id={q.id} title={q.title} />
      <MockBar id={q.id} />

      <nav className="flex items-center gap-1.5 text-[13px] text-ink-3" aria-label="Breadcrumb">
        <Link href={`/tracks/${track}`} className="hover:text-ink">
          {meta.title}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <Link href={`/tracks/${track}#${q.chapter}`} className="truncate hover:text-ink">
          {chapter?.title}
        </Link>
      </nav>

      <h1 className="mt-3 font-serif text-[25px] font-semibold leading-[1.25] tracking-tight md:text-[32px]">{q.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <LevelPips level={q.level} />
        <TypeChip type={q.type} />
        {q.tags.slice(0, 4).map((t) => (
          <span key={t} className="text-[12.5px] text-ink-3">
            #{t}
          </span>
        ))}
      </div>

      <QuestionActions id={q.id} className="mt-5" />

      <div className="mt-7">
        <Prose html={questionHtml} />
      </div>

      {clueHtml.length > 0 && (
        <Clues id={q.id}>
          {clueHtml.map((h, n) => (
            <Prose key={n} html={h} className="text-[16px]" />
          ))}
        </Clues>
      )}

      <AnswerGate id={q.id}>
        <section aria-labelledby="ans" className="rounded-xl border border-line bg-surface">
          <h2 id="ans" className="flex items-center gap-2 border-b border-line px-5 py-3 text-[15px] font-semibold">
            <span className="hl-mark">Interview answer</span>
            <span className="text-[12.5px] font-normal text-ink-3">what you&apos;d say out loud</span>
          </h2>
          <div className="px-5 py-4">
            <Prose html={answerHtml} />
          </div>
        </section>

        <Section title="Explanation" html={explanationHtml} />
        {followUpsHtml && <Section title="Follow-up questions" html={followUpsHtml} />}
        {mistakesHtml && <Section title="Common mistakes" html={mistakesHtml} />}
        {tipsHtml && <Section title="Tips" html={tipsHtml} />}
      </AnswerGate>

      <NoteBox id={q.id} />

      <NextBar id={q.id} nextHref={next ? qHref(next.id) : `/tracks/${track}`} nextLabel={next ? next.title : `Back to ${meta.title}`} />

      {related.length > 0 && (
        <section className="mt-10" aria-labelledby="rel">
          <h2 id="rel" className="text-[15px] font-semibold">
            Related questions
          </h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={qHref(r.id)} className="flex flex-col gap-1 px-4 py-3 hover:bg-sunken/50">
                  <span className="text-[15px] leading-snug">{r.title}</span>
                  <span className="flex items-center gap-2 text-[12.5px] text-ink-3">
                    {r.track !== track && <span>{trackShort.get(r.track)}</span>}
                    <LevelPips level={r.level} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="mt-10 grid grid-cols-2 gap-3 border-t border-line pt-6 text-[14px]" aria-label="Question navigation">
        {prev ? (
          <Link href={qHref(prev.id)} className="group flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-1 text-[12.5px] text-ink-3">
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Previous
            </span>
            <span className="line-clamp-2 group-hover:text-blue">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={qHref(next.id)} className="group flex min-w-0 flex-col items-end gap-1 text-right">
            <span className="flex items-center gap-1 text-[12.5px] text-ink-3">
              Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="line-clamp-2 group-hover:text-blue">{next.title}</span>
          </Link>
        )}
      </nav>
    </article>
  );
}

function Section({ title, html }: { title: string; html: string }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[19px] font-semibold tracking-tight">{title}</h2>
      <Prose html={html} />
    </section>
  );
}

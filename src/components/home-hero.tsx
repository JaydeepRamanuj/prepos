"use client";

import Link from "next/link";
import { ArrowRight, Shuffle, Zap } from "lucide-react";
import { useProgress } from "@/lib/progress/store";
import { useAuth } from "@/lib/progress/sync";
import { useSolvedCount, ProgressBar } from "./progress";
import { qHref } from "@/lib/utils";

export function HomeHero({ allIds, trackCount, coreCount }: { allIds: string[]; trackCount: number; coreCount: number }) {
  const solved = useSolvedCount(allIds);
  const last = useProgress((s) => s.lastVisited);
  const reviseCount = useProgress((s) => Object.keys(s.revise).length);
  const hydrated = useProgress((s) => s.hydrated);
  const { enabled, user, signIn, loading } = useAuth();
  const total = allIds.length;

  return (
    <section>
      <h1 className="max-w-2xl font-serif text-[30px] font-semibold leading-[1.15] tracking-tight md:text-[42px]">
        {hydrated && solved > 0 ? (
          <>
            {solved} of {total} questions solved.
          </>
        ) : (
          <>{total} questions between you and the next interview.</>
        )}
      </h1>
      <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-ink-2">
        Try each question before revealing the answer. {coreCount} of them cover JavaScript, React and Next.js; the rest span {trackCount - 3} more tracks, from debugging to working with AI.
      </p>

      <ProgressBar value={solved} total={total} className="mt-6 h-2 max-w-xl" />

      <div className="mt-6 flex flex-wrap gap-2.5">
        {hydrated && last ? (
          <Link href={qHref(last.id)} className="group flex max-w-full items-center gap-3 rounded-xl bg-blue px-4 py-3 text-surface">
            <span className="min-w-0">
              <span className="block text-[12px] opacity-80">Continue where you left off</span>
              <span className="block truncate text-[15px] font-medium">{last.title}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : (
          <Link href="/tracks/javascript" className="flex items-center gap-2 rounded-xl bg-blue px-4 py-3 text-[15px] font-medium text-surface">
            Start with JavaScript <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
        <Link href="/revise" className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[15px] hover:border-line-strong">
          <Zap className="h-4 w-4 text-ink-3" aria-hidden /> Quick revise
          {hydrated && reviseCount > 0 && <span className="rounded-full bg-hl-soft px-1.5 text-[12px] text-ink">{reviseCount}</span>}
        </Link>
        <Link href="/mock" className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[15px] hover:border-line-strong">
          <Shuffle className="h-4 w-4 text-ink-3" aria-hidden /> Mock round
        </Link>
      </div>

      {enabled && !loading && !user && (
        <p className="mt-5 text-[13.5px] text-ink-3">
          Progress is saved on this device.{" "}
          <button onClick={signIn} className="font-medium text-blue underline underline-offset-2">
            Sign in with Google
          </button>{" "}
          to keep it across devices.
        </p>
      )}
    </section>
  );
}

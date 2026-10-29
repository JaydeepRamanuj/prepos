"use client";

import Link from "next/link";
import { ArrowRight, Shuffle, Zap } from "lucide-react";
import { useProgress } from "@/lib/progress/store";
import { useAuth } from "@/lib/progress/sync";
import { useSolvedCount, ProgressBar } from "./progress";
import { qHref } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

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
          <>{copy.heroUnsolved(total)}</>
        )}
      </h1>
      <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-ink-2">
        Try each question before revealing the answer. {coreCount} of them cover JavaScript, React and Next.js; the rest span {trackCount - 3} more tracks, from debugging to working with AI.
      </p>

      <ProgressBar value={solved} total={total} className="mt-6 h-2 max-w-xl" />

      <div className="mt-6 flex flex-wrap gap-2.5">
        {hydrated && last ? (
          <Button asChild size="xl" className="group max-w-full">
            <Link href={qHref(last.id)}>
              <span className="min-w-0 text-left">
                <span className="block text-[12px] opacity-80">Continue where you left off</span>
                <span className="block truncate text-[15px] font-medium">{last.title}</span>
              </span>
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button asChild size="xl">
            <Link href="/tracks/javascript">
              Start with JavaScript <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" size="xl">
          <Link href="/revise">
            <Zap className="text-ink-3" aria-hidden /> Quick revise
            {hydrated && reviseCount > 0 && <Badge variant="highlight" shape="pill">{reviseCount}</Badge>}
          </Link>
        </Button>
        <Button asChild variant="outline" size="xl">
          <Link href="/mock">
            <Shuffle className="text-ink-3" aria-hidden /> Mock round
          </Link>
        </Button>
      </div>

      {enabled && !loading && !user && (
        <p className="mt-5 text-[13.5px] text-ink-3">
          Progress is saved on this device.{" "}
          <Button variant="link" onClick={signIn} className="align-baseline text-[13.5px]">
            Sign in with Google
          </Button>{" "}
          to keep it across devices.
        </p>
      )}
    </section>
  );
}

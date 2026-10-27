"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { useMockFor, writeMock } from "@/lib/progress/mock";
import { qHref } from "@/lib/utils";

export function MockBar({ id }: { id: string }) {
  const mock = useMockFor(id);
  const router = useRouter();
  if (!mock) return null;
  const { session, index } = mock;
  const last = index === session.ids.length - 1;

  return (
    <div className="sticky top-16 z-30 mb-5 flex items-center gap-3 rounded-xl border border-blue bg-blue-soft px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-ink-2">Mock round</div>
        <div className="text-[14px] font-medium tabular-nums">
          Question {index + 1} of {session.ids.length}
        </div>
      </div>
      <button
        onClick={() => {
          if (last) {
            writeMock({ ...session, finished: true });
            router.push("/mock?done=1");
          } else router.push(qHref(session.ids[index + 1]));
        }}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-blue px-3.5 text-[14px] font-medium text-surface"
      >
        {last ? "Finish" : "Next"} <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
      <Link
        href="/mock"
        onClick={() => writeMock(null)}
        className="grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-surface"
        aria-label="End mock round"
      >
        <X className="h-4 w-4" />
      </Link>
    </div>
  );
}

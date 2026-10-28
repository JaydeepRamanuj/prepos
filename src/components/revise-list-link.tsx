"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useProgress } from "@/lib/progress/store";
import { Card, CardContent } from "@/components/ui/card";

export function ReviseListLink() {
  const n = useProgress((s) => (s.hydrated ? Object.keys(s.revise).length : 0));
  if (!n) return null;
  return (
    <Link href="/saved" className="mt-6 block">
      <Card className="gap-0 border-hl bg-hl-soft py-0 shadow-none">
        <CardContent className="flex items-center gap-3 px-4 py-3.5">
          <RotateCcw className="size-4 text-ink-2" aria-hidden />
          <span className="flex-1 text-[15px]">
            Your revision list has <strong className="font-semibold">{n}</strong> question{n === 1 ? "" : "s"}
          </span>
          <span className="text-[13.5px] font-medium text-primary">Open</span>
        </CardContent>
      </Card>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { useMockFor, writeMock } from "@/lib/progress/mock";
import { qHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function MockBar({ id }: { id: string }) {
  const mock = useMockFor(id);
  const router = useRouter();
  if (!mock) return null;
  const { session, index } = mock;
  const last = index === session.ids.length - 1;

  return (
    <Card className="sticky top-16 z-30 mb-5 gap-0 border-primary bg-accent py-0 shadow-none">
      <CardContent className="flex items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] text-ink-2">Mock round</div>
          <div className="text-[14px] font-medium tabular-nums">
            Question {index + 1} of {session.ids.length}
          </div>
        </div>
        <Button
          onClick={() => {
            if (last) {
              writeMock({ ...session, finished: true });
              router.push("/mock?done=1");
            } else router.push(qHref(session.ids[index + 1]));
          }}
        >
          {last ? "Finish" : "Next"} <ArrowRight aria-hidden />
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" aria-label="End mock round">
              <Link href="/mock" onClick={() => writeMock(null)}>
                <X />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>End mock round</TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  );
}

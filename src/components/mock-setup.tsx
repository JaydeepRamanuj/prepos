"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Circle, Play } from "lucide-react";
import { LEVELS, LEVEL_LABEL, toKey, type Level } from "@/lib/content/types";
import { readMock, writeMock, type MockSession } from "@/lib/progress/mock";
import { useProgress } from "@/lib/progress/store";
import { loadIndex } from "./search";
import { LevelPips } from "./level";
import { qHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ItemLink, ItemList } from "@/components/item-list";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface T {
  id: string;
  title: string;
  group: string;
  count: number;
}

const COUNTS = [5, 10, 15, 20];

export function MockSetup({ tracks }: { tracks: T[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(["javascript", "react", "nextjs"].filter((id) => tracks.some((t) => t.id === id)));
  const [levels, setLevels] = useState<Level[]>(["medium", "hard"]);
  const [count, setCount] = useState(10);
  const [skipSolved, setSkipSolved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<MockSession | null>(null);
  const solved = useProgress((s) => s.solved);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("done")) {
      const s = readMock();
      if (s?.finished) setFinished(s);
    }
  }, []);

  const start = async () => {
    setError(null);
    const index = await loadIndex().catch(() => null);
    if (!index) return setError("Couldn't load questions. Check your connection and try again.");
    let pool = index.questions.filter((q) => selected.includes(q.track) && (levels.length === 0 || levels.includes(q.level)));
    if (skipSolved) {
      const unsolved = pool.filter((q) => !solved[toKey(q.id)]);
      if (unsolved.length >= Math.min(count, pool.length)) pool = unsolved;
    }
    if (!pool.length) return setError("No questions match. Pick more tracks or levels.");
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, count);
    writeMock({ ids: picked.map((q) => q.id), titles: picked.map((q) => q.title), startedAt: Date.now() });
    router.push(qHref(picked[0].id));
  };

  if (finished) {
    const done = finished.ids.filter((id) => solved[toKey(id)]).length;
    return (
      <div>
        <h1 className="font-serif text-[28px] font-semibold tracking-tight md:text-[34px]">Round complete</h1>
        <p className="mt-2 text-[15px] text-ink-2">
          You marked {done} of {finished.ids.length} as solved. Revisit the rest while they&apos;re fresh.
        </p>
        <ItemList className="mt-6">
          {finished.ids.map((id, i) => {
            const ok = !!solved[toKey(id)];
            return (
              <ItemLink key={id} href={qHref(id)} className="items-center">
                {ok ? (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-good text-surface">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-line-strong" strokeWidth={1.5} />
                )}
                <span className="text-[15px] leading-snug">{finished.titles[i]}</span>
              </ItemLink>
            );
          })}
        </ItemList>
        <Button
          size="lg"
          className="mt-6"
          onClick={() => {
            writeMock(null);
            setFinished(null);
            router.replace("/mock");
          }}
        >
          Set up another round
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-[28px] font-semibold tracking-tight md:text-[34px]">Mock round</h1>
      <p className="mt-2 max-w-lg text-[15px] text-ink-2">
        Random questions, answers hidden, one after another — like the real thing. Answer each out loud before revealing.
      </p>

      <fieldset className="mt-8">
        <legend className="text-[15px] font-semibold">Tracks</legend>
        <ToggleGroup type="multiple" value={selected} onValueChange={setSelected} className="mt-3" aria-label="Tracks">
          {tracks.map((t) => (
            <ToggleGroupItem key={t.id} value={t.id} className="text-[14px]">
              {t.title}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="text-[15px] font-semibold">Difficulty</legend>
        <ToggleGroup type="multiple" value={levels} onValueChange={(v) => setLevels(v as Level[])} className="mt-3" aria-label="Difficulty">
          {LEVELS.map((l) => (
            <ToggleGroupItem key={l} value={l} aria-label={LEVEL_LABEL[l]}>
              {levels.includes(l) ? LEVEL_LABEL[l] : <LevelPips level={l} />}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="text-[15px] font-semibold">Questions</legend>
        <ToggleGroup
          type="single"
          value={String(count)}
          onValueChange={(v) => v && setCount(Number(v))}
          className="mt-3"
          aria-label="Number of questions"
        >
          {COUNTS.map((n) => (
            <ToggleGroupItem key={n} value={String(n)} className="w-14 tabular-nums">
              {n}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <Label className="mt-6 text-[14.5px] font-normal text-ink-2">
        <Checkbox checked={skipSolved} onCheckedChange={(v) => setSkipSolved(v === true)} />
        Prefer questions I haven&apos;t solved
      </Label>

      {error && <p className="mt-5 text-[14px] text-lv-hard">{error}</p>}

      <Button size="lg" onClick={start} disabled={!selected.length} className="mt-8 h-12 px-6 text-[15.5px]">
        <Play className="fill-current" aria-hidden /> Start round
      </Button>
    </div>
  );
}

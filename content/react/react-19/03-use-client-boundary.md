---
title: "Debug this: Server/Client boundary mistakes"
level: hard
type: debugging
tags: [use-client, server-components, serialization, boundaries, nextjs]
related: [react/server-components-mental-model, react/use-hook, nextjs/server-vs-client-components]
---

## Question
A teammate's Next.js App Router page throws errors. Find all the boundary mistakes and fix them.

```tsx
// app/dashboard/page.tsx (no directive)
import { useState } from "react";
import Chart from "./Chart";
import { formatter } from "./formatter";

export default async function Page() {
  const [range, setRange] = useState("7d");
  const data = await getStats(range);

  return (
    <Chart
      data={data}
      format={(n: number) => formatter.format(n)}
      onSelect={(r: string) => setRange(r)}
    />
  );
}
```

```tsx
// app/dashboard/Chart.tsx
"use client";
import { db } from "@/lib/db";
import Sidebar from "./Sidebar";      // a Server Component that queries the db

export default function Chart({ data, format, onSelect }: Props) {
  const rows = db.stats.findMany();
  return <Sidebar />;
}
```

## Clues
- Hooks and event handlers require a Client Component.
- What can be passed as a prop across the server-to-client boundary?
- A Client Component can render Server Components only if they arrive as children/props, not as imports.

## Interview Answer
There are four problems. The page is a Server Component but calls `useState`, which is only allowed in Client Components. It also passes inline functions (`format`, `onSelect`) as props to a Client Component, which aren't serialisable across the boundary. In `Chart`, importing `db` pulls server-only code into the client bundle, so it would fail or leak secrets, and it queries synchronously in a Client Component. Finally, `Chart` imports `Sidebar`, a Server Component, so it becomes part of the client graph and runs on the client. The fix: keep the page on the server and fetch data there using `searchParams` for the range, make a small client component for the interactive range selector that updates the URL, format values in the server or in the client component itself, and pass `Sidebar` into `Chart` as `children`.

## Explanation
### Issues

| # | Problem | Why it fails |
|---|---|---|
| 1 | `useState` in a Server Component | hooks need client runtime |
| 2 | `format={(n) => ...}` and `onSelect` props | functions aren't serialisable (only Server Actions can cross) |
| 3 | `db` imported in a `"use client"` file | server code and secrets would be bundled for the browser; no DB driver in the browser |
| 4 | Importing a Server Component into a Client Component | once imported by a client module it's treated as a Client Component |

### Fixed version

```tsx
// app/dashboard/page.tsx — Server Component
import Chart from "./Chart";
import Sidebar from "./Sidebar";
import RangePicker from "./RangePicker";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range = "7d" } = await searchParams;      // Next.js 15+: searchParams is async
  const data = await getStats(range);                // server-side data access

  return (
    <>
      <RangePicker current={range} />
      <Chart data={data}>
        <Sidebar />                                  {/* Server Component passed as children */}
      </Chart>
    </>
  );
}
```

```tsx
// Chart.tsx
"use client";
import type { ReactNode } from "react";
const formatter = new Intl.NumberFormat("en", { notation: "compact" });

export default function Chart({ data, children }: { data: Stat[]; children: ReactNode }) {
  return (
    <div>
      {data.map((d) => <span key={d.id}>{formatter.format(d.value)}</span>)}
      {children}
    </div>
  );
}
```

```tsx
// RangePicker.tsx
"use client";
import { useRouter } from "next/navigation";

export default function RangePicker({ current }: { current: string }) {
  const router = useRouter();
  return (
    <select value={current} onChange={(e) => router.push(`?range=${e.target.value}`)}>
      <option value="7d">7 days</option>
      <option value="30d">30 days</option>
    </select>
  );
}
```

State that should be shareable lives in the URL, which also makes the Server Component re-render with new data.

### Guardrails
- `import "server-only"` at the top of `db.ts` makes the build fail if a Client Component imports it.
- Environment variables without `NEXT_PUBLIC_` are not exposed to the client bundle.
- Server Actions (`"use server"`) are the exception for passing callable functions to Client Components.

### Rules to remember
1. Default to Server Components; add `"use client"` only for interactivity.
2. Props crossing the boundary must be serialisable.
3. Client files can't import Server Components, but can receive them as `children`.
4. Don't import server-only modules from client modules.

## Follow-ups
- **Is a Server Component rendered inside a Client Component's children re-run on client state change?** — No; it's already rendered on the server; the client only re-renders its own parts.
- **What error does importing `db` produce?** — A build/runtime error about missing Node modules, or a `server-only` violation.

## Common Mistakes
- Adding `"use client"` to the page to silence errors.
- Using functions as props.

## Tips
- Show the "children" escape hatch; interviewers love it.

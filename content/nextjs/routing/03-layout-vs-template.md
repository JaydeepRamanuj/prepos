---
title: "Layout vs template: what's the difference, and when would you reach for template.tsx?"
level: medium
type: concept
tags: [layout, template, navigation, state, remount]
related: [nextjs/app-router-file-conventions, nextjs/route-groups-private-folders, react/keys-reconciliation]
---

## Question
Both `layout.tsx` and `template.tsx` wrap their child segments. What is the behavioural difference during client-side navigation? Give a concrete case where a layout is the wrong choice and a template is right.

## Clues
- Think about what React does with a component whose `key` changes.
- On navigation, does the wrapper unmount or stay mounted?

## Interview Answer
A layout persists across navigations between its child routes. React keeps the same instance, so client state, effects and DOM inside it survive, and Next.js doesn't even re-render it on the server for a sibling navigation. A template wraps the same children, but Next.js renders it with a key based on its segment, so when that segment changes, React unmounts and remounts it. Client Components inside lose their state, effects re-run, and the DOM is recreated. I use a layout by default because persistence is what makes App Router navigations cheap. I reach for a template when I want a reset on every navigation: an enter animation per page, a `useEffect` that logs a page view, a form that must clear between `/blog/a` and `/blog/b`, or a Suspense fallback that should show on every navigation and not only the first.

## Explanation
### What Next.js renders

```tsx
<Layout>                       {/* same instance across child navigations */}
  <Template key={segmentKey}>  {/* new key → remount */}
    {children}
  </Template>
</Layout>
```

The `key` is the whole trick. In React, changing a component's key throws away the old subtree and mounts a fresh one. A template is just a wrapper that Next.js keys for you.

### Behaviour side by side

| | `layout.tsx` | `template.tsx` |
|---|---|---|
| Re-mounts on child navigation | No | Yes, when its own segment changes |
| `useState` inside children | Preserved | Reset |
| `useEffect` | Runs once | Re-runs every navigation |
| Suspense fallback inside | Only on first load | On every navigation |
| Search-param-only change | No remount | No remount |
| Default component type | Server | Server |

The remount is scoped to the template's own segment level. With `app/blog/template.tsx`, going from `/blog/first` to `/blog/second` remounts it. A deeper navigation such as `/blog/first/comments` doesn't remount a higher-level template unless the segment directly below it changes. Changing only `?page=2` doesn't remount anything.

### Example: a per-page analytics effect

```tsx
// app/(app)/template.tsx
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    // Re-runs on every navigation because this component remounts
    analytics.pageView(pathname)
  }, [pathname])

  return <div className="animate-fade-in">{children}</div>
}
```

The same effect in a layout would run only once, on first mount. (You could also depend on `usePathname()` in a layout, which works too, but the CSS enter animation would still only play once.)

### Why layouts are the default
Persistence is a feature. A dashboard sidebar with a collapsed or expanded state, a music player, or a search box in the header should survive navigation. Next.js also skips re-rendering shared layouts on navigation and only fetches the changed segment, which keeps transitions fast. Templates trade that efficiency for a clean slate, so use them deliberately.

### Related caveats of layouts
Because layouts don't re-render on navigation, they don't receive `searchParams` or the current pathname as props (the values would go stale). Read them in the page, or in a Client Component with `useSearchParams()` / `usePathname()`.

## Follow-ups
- **Could you get a reset without `template.tsx`?** — Yes. Put a `key` on the component you want to reset, for example `<Form key={slug} />`. That's often more precise than a whole template.
- **Does a template re-run Server Component data fetching?** — It's a normal Server Component in the tree; the remount is a client-side React behaviour. Data freshness is governed by caching, not by the template.
- **Does Cache Components change this?** — With `cacheComponents`, Next.js keeps recently visited routes mounted but hidden using React `<Activity>`, so going back can restore state. Templates still remount on their key change.

## Common Mistakes
- Saying layouts "re-render on every navigation". They don't, which is why they can't read `searchParams`.
- Using a template for everything "to be safe" and losing persisted UI state and performance.
- Expecting a template to remount when only the query string changes.

## Tips
- Explain it in one line: **"a template is a layout with a key."** Then show the `<Template key={...}>` snippet.
- Mention the precise alternative (`key` on one component). It shows you understand the React mechanism, not just the file name.

---
title: "How do parallel routes and default.js work? When would you use them?"
level: hard
type: concept
tags: [parallel-routes, slots, default-js, layouts, dashboards]
related: [nextjs/intercepting-routes-modal, nextjs/layout-vs-template, nextjs/loading-error-not-found, nextjs/app-router-file-conventions]
---

## Question
What is a parallel route in the App Router? What are slots, why does `default.js` exist, and what happens on a soft navigation versus a hard refresh? Give a real use case.

## Clues
- Slots are folders prefixed with `@` and arrive as props of the parent layout.
- Slots do not change the URL.
- Next.js remembers the active sub-page of each slot during client navigation but cannot after a full reload.

## Interview Answer
Parallel routes let one layout render several independent pages at once, each in a named slot defined by an `@folder`. The slots are passed as props to the parent layout next to `children`, and they don't add URL segments, so `app/@analytics/views/page.tsx` is just `/views`. Each slot has its own loading and error UI and can be navigated on its own, which suits dashboards, split views and modals. During soft navigation Next.js tracks the active state of each slot and updates only the one whose segment matches. On a hard navigation, like a refresh, it can't know what unmatched slots were showing, so it renders each slot's `default.js`, and returns a 404 if there is none. I use `default.js` returning `null` for modal slots, and the same file for `children` when the parent page has no match.

## Explanation
### Structure

```txt
app/
  layout.tsx            receives { children, team, analytics }
  page.tsx              children slot (implicit @children)
  @team/
    page.tsx            "/"      -> team widget
    settings/page.tsx   "/settings" -> team slot changes
    default.tsx
  @analytics/
    page.tsx
    default.tsx         fallback when /settings does not exist inside @analytics
```

```tsx
// app/layout.tsx
export default function Layout({
  children,
  team,
  analytics,
}: {
  children: React.ReactNode;
  team: React.ReactNode;
  analytics: React.ReactNode;
}) {
  return (
    <>
      {children}
      <div className="grid">{team}{analytics}</div>
    </>
  );
}
```

### Soft vs hard navigation

| Navigation | What renders for an unmatched slot |
|---|---|
| Soft (client `<Link>`) | Keeps whatever that slot was showing; only matching slots update |
| Hard (refresh, direct URL) | The slot's `default.tsx`; **404** if the file is missing |

Visiting `/settings` softly from `/` updates `@team` to its settings page while `@analytics` keeps showing its previous page. Refreshing on `/settings` has no matching page in `@analytics`, so `default.tsx` is used.

### Why independent slots help
- Each slot streams on its own, with its own `loading.tsx` and `error.tsx`. One slow widget does not block the others and one failing widget does not take down the page.
- Slots can have nested layouts, which gives independent tab navigation inside a region.
- Layouts can choose which slot to show, for example by role. Note that all slots still execute on the server, so the choice only controls what is displayed. Don't use it for authorisation: protect data in the page itself.

```tsx
// app/dashboard/layout.tsx
export default async function Layout({ admin, user }: { admin: ReactNode; user: ReactNode }) {
  const session = await getSession();
  return session.role === "admin" ? admin : user;
}
```

### Typical uses
- Dashboards with independent panels.
- Modals with deep links (combined with intercepting routes).
- Conditional UI per role or feature flag.
- Split-pane views such as inbox lists and details.

### Gotchas
- Forgetting `default.tsx` causes 404s on refresh, which is the most common bug.
- `children` is an implicit slot and also needs a `default.tsx` when its parent route isn't matched.
- Slots are not route segments, so they don't appear in `params`.
- `useSelectedLayoutSegment('analytics')` reads the active segment of a slot.

## Follow-ups
- **Does a parallel route create new URLs?** — No, slots only compose existing URLs.
- **How is it different from just rendering two components?** — Slots have independent navigation state, streaming, error and loading boundaries.

## Common Mistakes
- Missing `default.tsx` files.
- Treating the layout's conditional as security.
- Expecting slot names in the URL.

## Tips
- Explain soft vs hard navigation; it shows you understand why `default.js` exists.

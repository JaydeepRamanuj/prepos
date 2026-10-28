---
title: "Build a shareable modal with intercepting routes and parallel routes"
level: advanced
type: design
tags: [intercepting-routes, parallel-routes, modal, deep-linking, router-back]
related: [nextjs/parallel-routes-default, nextjs/route-groups-private-folders, nextjs/app-router-file-conventions, react/portals]
---

## Question
Design a photo gallery where clicking a photo opens it in a modal over the gallery, but visiting `/photo/42` directly (or refreshing) shows a full page. Explain the folder structure, the interception conventions, how closing works and the pitfalls.

## Clues
- The modal and the full page are two different components for the same URL.
- Intercepting uses `(.)`, `(..)`, `(..)(..)` or `(...)` folder prefixes, relative to route segments, not the file system.
- A parallel-route slot holds the modal so it can render alongside the gallery.

## Interview Answer
I combine two features. The full page lives at `app/photo/[id]/page.tsx`, so the URL works directly and on refresh. Next to the gallery layout I add a slot `app/@modal` with a `default.tsx` returning `null`, and inside it an intercepting route `app/@modal/(.)photo/[id]/page.tsx`. When the user navigates softly to `/photo/42`, the router intercepts the route and renders the modal version into the `@modal` slot while keeping the gallery visible. On a hard navigation there's no interception, so the real page renders. The modal component is a Client Component that closes with `router.back()`, so the URL, history and the browser back button stay consistent, and the layout renders `{modal}` next to `{children}`.

## Explanation
### Structure

```txt
app/
  layout.tsx                    renders {children} and {modal}
  page.tsx                      gallery grid with <Link href="/photo/42">
  photo/[id]/page.tsx           full page (direct visit / refresh)
  @modal/
    default.tsx                 returns null: no modal when inactive
    (.)photo/[id]/page.tsx      intercepts /photo/[id] -> renders inside <Modal>
```

### Interception conventions
They match **route segments**, not folders in the file system (slots and groups don't count as segments):

| Convention | Matches |
|---|---|
| `(.)folder` | same level |
| `(..)folder` | one level up |
| `(..)(..)folder` | two levels up |
| `(...)folder` | from the root `app` directory |

`@modal/(.)photo/[id]` is at the root level, so `(.)` intercepts `/photo/[id]`.

### Code

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
```

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null;
}
```

```tsx
// app/@modal/(.)photo/[id]/page.tsx
import { Modal } from "@/components/modal";
import { PhotoView } from "@/components/photo-view";

export default async function PhotoModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await getPhoto(id);
  return (
    <Modal>
      <PhotoView photo={photo} />        {/* Server Component content inside a client modal */}
    </Modal>
  );
}
```

```tsx
// components/modal.tsx
"use client";
import { useRouter } from "next/navigation";

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="backdrop" onClick={() => router.back()}>
      <dialog open onClick={(e) => e.stopPropagation()}>{children}</dialog>
    </div>
  );
}
```

`params` is a Promise in current Next.js, so `await` it. Keep `Modal` (client) separate from `PhotoView` (server) so the content stays a Server Component.

### How the flow works
1. Click a `<Link href="/photo/42">` on `/`: soft navigation; the router finds the intercepting route in `@modal`, renders it there; `children` still shows the gallery.
2. URL becomes `/photo/42`; the user can copy and share it.
3. Back button / `router.back()`: returns to `/`; the `@modal` slot falls back to `default.tsx` (`null`), closing the modal.
4. Refresh or open in a new tab: a hard navigation, so interception doesn't apply and `app/photo/[id]/page.tsx` renders full-page.

### Pitfalls
- Don't forget `default.tsx` in the slot, or refreshes 404.
- `router.back()` leaves the app if the user landed directly on the URL; for the full page provide a normal link.
- Use `<Link>` (client navigation); a plain `<a>` causes a hard navigation and skips interception.
- Interception only applies to soft navigations, so test refresh paths explicitly.
- Intercepting routes are matched on segments; slots and route groups are ignored when counting `(..)`.
- Accessibility: focus trapping, `Escape`, `aria-modal`; native `<dialog>.showModal()` handles most of it.
- Metadata for the full page is separate; the modal doesn't change the document title unless you set it.

## Follow-ups
- **Can the modal and page share data fetching?** — Yes, through a shared data function with request memoisation or a cache.
- **What if the modal route needs auth?** — Check inside both the page and the intercepting page; the guard must not live only in the layout.

## Common Mistakes
- Wrong number of `(..)` because of slot or group folders.
- Using `router.push('/')` to close instead of `router.back()`.
- Missing `default.tsx`.

## Tips
- Draw the folder tree; this is easiest to explain visually.

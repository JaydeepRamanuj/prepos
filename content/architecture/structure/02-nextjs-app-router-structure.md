---
title: "How would you structure a Next.js App Router project?"
level: medium
type: design
tags: [nextjs, app-router, route-groups, private-folders, colocation, server-only]
related: [architecture/feature-vs-layer-folders, architecture/import-boundaries, architecture/api-client-layer]
---

## Question
You are starting a new Next.js (App Router) product with a marketing site, an authenticated dashboard and an admin area. Show the folder structure. Where do route groups, private folders, shared components and server-only code (database, auth checks) go?

## Clues
- The `app/` folder defines URLs. Which folder naming conventions let you organize it without changing the URL?
- Only `page` and `route` files make a segment public. What does that mean for colocating other files?
- Where should code that must never reach the browser live, and how do you enforce that?

## Interview Answer
I keep `app/` mostly about routing and put the real logic in `src/features` and `src/shared`. I use route groups such as `(marketing)`, `(app)` and `(admin)` to give each area its own layout without adding a segment to the URL. Route-specific components that nothing else uses get colocated in a private `_components` folder next to the page, which keeps them out of routing. Anything that touches the database, secrets or session checks goes into a server-only data layer, and each of those modules starts with `import "server-only"` so that importing it from a Client Component fails the build. Pages stay thin: they read params, call the data layer, and compose feature components.

## Explanation
### The tree

```txt
.
├── proxy.ts                         # request proxy (renamed from middleware.ts in Next.js 16)
├── next.config.ts
└── src/
    ├── app/
    │   ├── layout.tsx               # root layout: <html>, fonts, providers
    │   ├── (marketing)/
    │   │   ├── layout.tsx           # public header + footer
    │   │   ├── page.tsx             # → /
    │   │   └── pricing/page.tsx     # → /pricing
    │   ├── (app)/
    │   │   ├── layout.tsx           # sidebar shell, checks session
    │   │   ├── dashboard/
    │   │   │   ├── page.tsx         # → /dashboard
    │   │   │   ├── loading.tsx
    │   │   │   └── _components/     # private: not routable, used only here
    │   │   │       └── RevenueChart.tsx
    │   │   └── projects/[id]/page.tsx
    │   ├── (admin)/admin/...        # → /admin/...
    │   └── api/webhooks/stripe/route.ts
    ├── features/
    │   ├── projects/
    │   │   ├── components/          # ProjectCard, ProjectForm (client or server)
    │   │   ├── actions.ts           # "use server" Server Actions
    │   │   ├── queries.ts           # import "server-only"; DB reads + auth checks
    │   │   └── schema.ts            # Zod schemas shared by form + action
    │   └── billing/...
    ├── shared/
    │   ├── ui/                      # design system (Button, Dialog...)
    │   └── lib/                     # cn(), formatters, fetch wrapper
    └── server/
        ├── db.ts                    # import "server-only"; DB client
        └── auth.ts                  # import "server-only"; getSession(), verifySession()
```

### Why each convention exists

| Convention | What it does | Use it for |
|---|---|---|
| `(group)` | Folder is left out of the URL | Different layouts per area; organizing by team or section |
| `_folder` | Folder and its children are excluded from routing | Colocating route-only components and helpers |
| `[param]` | Dynamic segment | `/projects/[id]` |
| `src/` | Optional; separates app code from config files | Cleaner root |

Colocation inside `app/` is already safe, because a segment is public only when it contains `page` or `route`. Private folders make the intent explicit and protect you from clashing with future special file names.

### Where server code lives
Server Components let you query the database directly in a page, but scattering queries across pages makes authorization easy to forget. Use a **data access layer**: one module per domain that checks the session and then returns only the fields the UI needs.

```ts
// src/features/projects/queries.ts
import "server-only";
import { db } from "@/server/db";
import { verifySession } from "@/server/auth";

export async function getProject(id: string) {
  const session = await verifySession(); // throws or redirects if not logged in
  const project = await db.project.findFirst({
    where: { id, ownerId: session.userId },
    select: { id: true, name: true, updatedAt: true }, // a DTO, not the raw row
  });
  return project;
}
```

```tsx
// src/app/(app)/projects/[id]/page.tsx
import { getProject } from "@/features/projects/queries";
import { notFound } from "next/navigation";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // params is async in Next.js 15+
  const project = await getProject(id);
  if (!project) notFound();
  return <h1>{project.name}</h1>;
}
```

### Rules of thumb
- Keep `page.tsx` thin. It wires params to data and composes UI.
- Keep `"use client"` at the leaves, such as `ProjectForm`, rather than whole layouts.
- Put auth checks in the data layer, not only in `proxy.ts`. The proxy handles optimistic redirects, and the DAL is the real gate.

## Follow-ups
- **Why not put everything inside `app/`?** — You can, and Next.js is unopinionated about it. The catch is that code shared across routes has no natural home in a route tree, so a top-level `features/` and `shared/` usually reads better at scale.
- **Can route groups give you multiple root layouts?** — Yes. Remove the top-level `app/layout.tsx` and give each group its own layout with `<html>` and `<body>`. Moving between those groups causes a full page load.

## Common Mistakes
- Putting `"use client"` on a layout, which turns its entire imported tree into client code.
- Querying the DB in many pages with copy-pasted auth checks instead of one data layer.
- Forgetting `import "server-only"`, so a module holding secrets ends up in a client bundle by accident.

## Tips
- Name the three conventions quickly (route groups, private folders, `server-only`), then spend your time on *where authorization lives*. That part signals seniority.

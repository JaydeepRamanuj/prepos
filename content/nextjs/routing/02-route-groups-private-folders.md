---
title: "What are route groups and private folders, and when would you use them?"
level: easy
type: concept
tags: [app-router, route-groups, layouts, project-structure]
related: [nextjs/app-router-file-conventions, nextjs/layout-vs-template]
---

## Question
What does wrapping a folder name in parentheses, like `app/(marketing)/about/page.tsx`, do? How is that different from prefixing it with an underscore, like `app/_components`? Give real use cases for each.

## Interview Answer
A route group, `(folderName)`, is a folder that organises routes without adding a URL segment, so `app/(marketing)/about/page.tsx` still serves `/about`. Its main use is giving a set of routes their own layout. For example, `(marketing)` pages get a public header while `(app)` pages get a dashboard sidebar, and I can even give each group its own root layout. A private folder, `_folderName`, is the opposite: it opts the folder and everything inside it out of routing completely, so it's a safe place for components or utilities colocated in `app/`. The caveats are that two groups can't resolve to the same path, and navigating between different root layouts triggers a full page load.

## Explanation
### Route groups: organise without touching the URL

```txt
app/
├── (marketing)/
│   ├── layout.tsx        ← public header + footer
│   ├── page.tsx          → /
│   └── pricing/page.tsx  → /pricing
├── (app)/
│   ├── layout.tsx        ← authenticated sidebar shell
│   ├── dashboard/page.tsx → /dashboard
│   └── settings/page.tsx  → /settings
└── layout.tsx            ← root layout (html, body)
```

Common uses:

1. **Different layouts for sibling sections.** You don't have to put `/pricing` under a `/marketing` URL just to share a header.
2. **Opting only some routes into a layout.** Move `checkout/` into `(shop)` to give it the shop layout, and leave `account/` out.
3. **Multiple root layouts.** Remove `app/layout.tsx` and give each group its own `<html>`/`<body>`. This is useful when sections differ completely, for example a marketing site and an admin app with different fonts and providers.
4. **Team ownership.** You can group by domain without changing public URLs.

### Caveats
- **Conflicting paths error.** `(marketing)/about/page.tsx` and `(shop)/about/page.tsx` both map to `/about`, and the build fails.
- **Full reload across root layouts.** With multiple root layouts, going from `/cart` (shop root) to `/blog` (marketing root) is a hard navigation, not a client transition, because the `<html>` document itself changes.
- **Home route placement.** Without a top-level `app/layout.tsx`, `/` must live inside one of the groups, for example `app/(marketing)/page.tsx`.

### Private folders: opt out of routing

```txt
app/
├── blog/
│   ├── _components/PostCard.tsx   ← never routable
│   └── page.tsx
└── _lib/format-date.ts
```

Colocation already works without the underscore, because only `page`/`route` files are public. The underscore states your intent and guarantees that a future `page.tsx` placed in there won't accidentally become a URL. It also avoids clashes with future Next.js special file names.

| | `(group)` | `_private` |
|---|---|---|
| In URL? | No | No |
| Routes inside work? | Yes | No, the whole subtree is excluded |
| Typical use | Shared layouts, multiple root layouts | Colocated components, helpers |

## Follow-ups
- **Can a route group have its own `loading.tsx` or `error.tsx`?** — Yes. It's a normal segment for file conventions; it just doesn't appear in the URL.
- **How do you `revalidatePath` a page inside a group?** — Use the URL path (`/pricing`). When you pass a route pattern with a `type`, you can include the group, for example `revalidatePath('/(main)/blog/[slug]', 'page')`.

## Common Mistakes
- Thinking `(marketing)` becomes `/marketing` in the URL.
- Creating two groups with the same child path and being surprised by the build error.
- Using multiple root layouts for small styling differences and then paying a full page reload on every cross-section navigation.

## Tips
- One-liner: **parentheses = organise, underscore = hide.**
- Mention the full-reload caveat of multiple root layouts. Most candidates miss it, and it shows you understand that the root layout owns the document.

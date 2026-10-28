---
title: "Design a tag strategy: cacheTag, revalidateTag and updateTag"
level: hard
type: design
tags: [cacheTag, revalidateTag, updateTag, tags, invalidation, stale-while-revalidate]
related: [nextjs/revalidate-after-mutation, nextjs/use-cache-pitfalls, nextjs/time-vs-on-demand-revalidation, nextjs/stale-data-after-mutation]
---

## Question
You have products, categories, a homepage that lists featured products, and an admin panel. Design a tagging scheme so edits show up promptly where needed without invalidating more than necessary. Which API do you call from admin Server Actions versus a CMS webhook?

## Clues
- Tags are attached where data is cached, not where it is mutated.
- A tag can be shared by many cache entries across routes.
- The admin who edits needs to see changes immediately; the public can tolerate slight staleness.

## Interview Answer
I tag at the data-function level with two granularities: a collection tag like `products` for lists and an entity tag like `product-${id}` for detail views. A function that renders a product page tags `product-${id}`, list functions tag `products`, and the homepage featured strip tags both `products` and `featured`. When an admin edits product 42, the Server Action calls `updateTag('product-42')` so the admin's next render waits for fresh data (read-your-writes) and `revalidateTag('products', 'max')` so public lists refresh with stale-while-revalidate. A CMS webhook arrives in a Route Handler where `updateTag` isn't available, so it uses `revalidateTag(tag, profile)`. I keep tag names in one module, avoid over-broad tags like `all`, and pair tags with `cacheLife` so entries expire even if a webhook is missed.

## Explanation
### Attach tags where data is cached

```ts
// lib/data.ts
import { cacheLife, cacheTag } from "next/cache";

export const tags = {
  products: "products",
  product: (id: string) => `product-${id}`,
  featured: "featured",
} as const;

export async function getProduct(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.product(id));
  return db.product.findUnique({ where: { id } });
}

export async function getProducts() {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.products);
  return db.product.findMany();
}

export async function getFeatured() {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.products, tags.featured);        // multiple tags per entry
  return db.product.findMany({ where: { featured: true } });
}
```

### The invalidation APIs

| API | Behaviour | Where | Use for |
|---|---|---|---|
| `updateTag(tag)` | expires immediately; next read waits for fresh data | Server Actions only | the user who made the change must see it |
| `revalidateTag(tag, profile)` | marks stale; serves stale while refreshing | Server Actions, Route Handlers | webhooks, background updates, other users |
| `revalidatePath(path)` | invalidates entries for a route path | Server Actions, Route Handlers | when you don't have tags |
| `refresh()` | re-renders current route; no cache changes | Server Actions | uncached data |

`revalidateTag(tag)` without a second argument is deprecated in Next.js 16; the profile (such as `'max'`, or a custom `cacheLife` profile) controls how long stale content may be served.

### Admin edit

```ts
"use server";
export async function updateProduct(id: string, fd: FormData) {
  await requireAdmin();
  await db.product.update({ where: { id }, data: parse(fd) });

  updateTag(tags.product(id));                  // admin sees the new detail page now
  revalidateTag(tags.products, "max");          // lists refresh in background for everyone else
  revalidateTag(tags.featured, "max");
}
```

### Webhook

```ts
// app/api/revalidate/route.ts
export async function POST(req: Request) {
  if (req.headers.get("x-secret") !== process.env.REVALIDATE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await req.json();
  revalidateTag(tags.product(id), "max");
  revalidateTag(tags.products, "max");
  return Response.json({ ok: true });
}
```

Authenticate the webhook; invalidation endpoints are attack surface.

### Design rules
1. Two levels of tags (collection, entity) cover most apps.
2. Tags describe data, not pages; use `revalidatePath` only when you can't tag.
3. Over-invalidation is cheap but wasteful; under-invalidation is a bug. Start broad, then refine.
4. Always keep `cacheLife` as a safety net.
5. Tags are shared across routes and across the client cache; invalidation also refreshes related prefetches.
6. Test: mutate, then load as another user in a private window.

### Common failure modes
- Typos or mismatched tags between `cacheTag` and invalidation.
- Calling `updateTag` from a Route Handler (not allowed).
- Tagging only the detail function and forgetting lists/featured strips.

## Follow-ups
- **How many tags can an entry have?** — Several via `cacheTag(a, b)`; there are length and count limits, so keep tags short and bounded.
- **Does `revalidateTag` clear the client router cache?** — Called from a Server Action, it refreshes the current page's client cache; elsewhere the client cache expires by its `stale` time.

## Common Mistakes
- One giant `all` tag.
- Using `revalidatePath("/")` for everything.
- Not authenticating the webhook.

## Tips
- Show the tag module and the two-level scheme; it reads as design, not just API knowledge.

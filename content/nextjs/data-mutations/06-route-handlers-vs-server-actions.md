---
title: "Route Handlers vs Server Actions: which do you use for what?"
level: medium
type: concept
tags: [route-handlers, server-actions, api, webhooks, mutations]
related: [nextjs/how-server-actions-work, nextjs/server-actions-are-public-endpoints, nextjs/revalidate-after-mutation, nextjs/client-side-data-fetching]
---

## Question
In the App Router you can mutate data with Server Actions or by writing Route Handlers (`route.ts`). Compare them, and say which you'd choose for a form submission, a webhook, a mobile app API, and a client-side search query.

## Interview Answer
Server Actions are async functions invoked from the UI with a POST that Next.js manages: they integrate with forms, transitions, `useActionState`, revalidation, redirects and progressive enhancement, and can return the updated UI in one round trip. Route Handlers are plain HTTP endpoints built on the Web Request/Response APIs: any method, any content type, callable by anything, including third parties and mobile apps, and `GET` handlers are usable for reads. So I use Server Actions for mutations triggered from my own UI, like form submissions, and Route Handlers for public or external APIs, webhooks (Stripe, CMS), file downloads or streaming responses, OAuth callbacks, and endpoints a client query library calls for reads. Actions are sequential per client and aren't designed for data fetching, so reads go through Server Components or Route Handlers. Both are public network surface and need their own authentication, authorisation and input validation.

## Explanation
### Comparison

| | Server Action | Route Handler |
|---|---|---|
| Invoked by | your React UI (`<form action>`, handlers, `startTransition`) | any HTTP client |
| HTTP method | POST only | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS |
| URL | opaque, managed by Next.js | explicit path you define |
| Input | `FormData` or serialisable args | `Request` (JSON, form, stream, headers) |
| Output | serialisable return values and updated UI | any `Response` (JSON, file, SSE, redirect) |
| Revalidation | `updateTag`, `revalidateTag`, `revalidatePath`, `refresh` and client cache refresh in one trip | `revalidateTag`, `revalidatePath` only |
| Progressive enhancement | works before JS loads when used with forms | n/a |
| Concurrency | actions from one client are queued | normal parallel requests |
| Caching | never cached | `GET` follows the prerendering model; other methods not cached |
| CSRF protection | Origin vs Host check built in | you implement (tokens, SameSite, CORS) |

### Choosing

```ts
// Form submission from my UI -> Server Action
"use server";
export async function createPost(prev: State, fd: FormData) { /* validate, authorise, write, updateTag */ }
```

```ts
// Stripe webhook -> Route Handler (needs raw body, signature verification, any caller)
// app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;
  const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  // …
  return new Response(null, { status: 200 });
}
```

| Scenario | Choice | Why |
|---|---|---|
| Form submission | Server Action | forms, pending state, revalidation, no manual fetch |
| Webhook | Route Handler | external caller, signature verification, raw body |
| Mobile/other clients | Route Handler (or a separate API) | stable, documented URL and contract |
| Search suggestions | Route Handler (GET) with a query library, or URL state + Server Component | actions run sequentially and aren't for reads |
| File download / streaming / SSE | Route Handler | custom `Response` |
| Optimistic like button | Server Action + `useOptimistic` | integrated pending/rollback |
| Cron job | Route Handler | called by scheduler |

### Shared concerns
- Both are reachable by direct HTTP requests; authenticate and authorise in each, and validate input (for example with Zod).
- Put business logic in a shared server-only module so both entry points call the same function.
- Handlers accept `NextRequest` for cookies and URL helpers; actions can use `cookies()`/`headers()`.
- Error handling: actions return expected errors as state; handlers return proper status codes.

### With Cache Components
`GET` handlers run at request time unless they only use static or cached data, in which case they are prerendered. Use `"use cache"` helper functions and tags inside them if you want caching.

## Follow-ups
- **Can a client component call a Route Handler from a Server Action?** — Pointless; call the shared function directly on the server.
- **Why not use Server Actions for GET-like reads?** — They use POST, are queued, and bypass HTTP caching.

## Common Mistakes
- Using Route Handlers for every form because of habit, losing progressive enhancement and revalidation helpers.
- Exposing webhooks without signature verification.
- Skipping auth in Server Actions because the page is protected.

## Tips
- Answer by caller: "my UI → action; anyone else → route handler".

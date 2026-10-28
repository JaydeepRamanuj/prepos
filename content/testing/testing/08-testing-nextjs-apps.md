---
title: "How do you test a Next.js App Router app: Server Components, Server Actions and route handlers?"
level: hard
type: design
tags: [nextjs-testing, server-components, server-actions, route-handlers, vitest, playwright]
related: [testing/test-pyramid-trophy, testing/playwright-e2e-basics, nextjs/server-vs-client-components]
---

## Question
Design a testing strategy for a Next.js 16 app that uses async Server Components, Server Actions with Zod validation, Route Handlers and a client-side form. Which tests would you write at each level, and how do you structure code to make it testable?

## Clues
- Async Server Components aren't supported by Vitest/Jest renderers today.
- Move logic into plain functions that can be unit tested.
- Use E2E tests for the composed server+client behaviour.

## Interview Answer
I make the app testable by structuring it: data access and business logic live in plain async functions (a DAL), validation in Zod schemas, and components are thin. Then I test at each level. Pure functions and schemas get fast unit tests with Vitest. Client Components and synchronous Server Components render in Testing Library with MSW for network. Server Actions are plain async functions, so I unit test them by calling them with `FormData` and mocking only the DB/auth boundaries (e.g. an in-memory or test database, `cookies()` mocked via `vi.mock("next/headers")`), asserting returned state, thrown errors and calls to `updateTag`/`revalidateTag`. Route Handlers are tested by invoking `GET`/`POST` with a `Request` and asserting the `Response`. Because Testing Library can't render async Server Components yet, the composed pages, caching behaviour, redirects, auth and middleware/proxy flows are covered by Playwright against a production build. I add a11y checks (axe) and a few visual snapshots, and run all but E2E on every PR.

## Explanation
### Structure for testability

```txt
lib/schemas/post.ts      Zod schema (shared by form and action)
lib/dal/posts.ts         server-only data functions (DB/auth)
app/posts/actions.ts     thin Server Action calling schema + DAL
app/posts/page.tsx       async Server Component: fetches via DAL, renders <PostList posts={…}/>
components/post-list.tsx presentational (sync) component, easy to test
components/post-form.tsx "use client" form using useActionState
app/api/posts/route.ts   Route Handler wrapping the DAL
```

### Unit: schema and logic

```ts
test("rejects short titles", () => {
  const r = postSchema.safeParse({ title: "ab", body: "x" });
  expect(r.success).toBe(false);
  expect(r.error!.flatten().fieldErrors.title).toBeDefined();
});
```

### Unit/integration: Server Actions

```ts
vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/dal/session", () => ({ verifySession: vi.fn().mockResolvedValue({ userId: "u1" }) }));
vi.mock("@/lib/db", () => ({ db: { post: { create: vi.fn().mockResolvedValue({ id: "p1" }) } } }));

test("createPost returns field errors for invalid input", async () => {
  const fd = new FormData();
  fd.set("title", "a");
  const state = await createPost(null, fd);
  expect(state).toMatchObject({ ok: false, fieldErrors: { title: expect.any(Array) } });
  expect(db.post.create).not.toHaveBeenCalled();
});

test("createPost writes and invalidates the cache", async () => {
  const fd = new FormData();
  fd.set("title", "Hello world");
  fd.set("body", "Content");
  await createPost(null, fd);
  expect(db.post.create).toHaveBeenCalled();
  expect(updateTag).toHaveBeenCalledWith("posts");
});
```

A thrown `redirect()` appears as an error with a `NEXT_REDIRECT` digest; assert with `await expect(createPost(...)).rejects.toThrow("NEXT_REDIRECT")`, or isolate redirects in the thin action layer.

Also test authorisation: with `verifySession` rejecting, the action must not touch the DB.

### Route Handlers

```ts
import { GET } from "@/app/api/posts/route";

test("GET returns posts", async () => {
  vi.mocked(listPosts).mockResolvedValue([{ id: "1", title: "A" }]);
  const res = await GET(new Request("http://localhost/api/posts"));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual([{ id: "1", title: "A" }]);
});
```

### Components

```tsx
test("PostList renders posts", () => {
  render(<PostList posts={[{ id: "1", title: "Hello" }]} />);
  expect(screen.getByRole("link", { name: "Hello" })).toHaveAttribute("href", "/posts/1");
});
```

For the async page, test its parts: DAL (integration against a test DB) and presentational components (unit). Mock `next/navigation` hooks in Client Components; for `next/image`, `next/link` the real components work in jsdom.

### E2E for composition

```ts
test("author can publish a post", async ({ page }) => {
  await page.goto("/posts/new");
  await page.getByLabel("Title").fill("Hello world");
  await page.getByLabel("Body").fill("…");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/posts\/.+/);
  await expect(page.getByRole("heading", { name: "Hello world" })).toBeVisible();
});

test("anonymous users are redirected to login", async ({ page }) => {
  await page.goto("/posts/new");
  await expect(page).toHaveURL(/\/login/);
});
```

E2E covers: server rendering, caching/revalidation (publish then see on the list without reload), proxy redirects, cookies, streaming/Suspense fallbacks (`expect(fallback).toBeVisible()` then content), error boundaries (`error.tsx`), `not-found`, metadata (`await expect(page).toHaveTitle(...)`).

### Test data and environments
- Test database per run (Docker/Testcontainers) with migrations and seeds; reset between tests or use transactions.
- Mock external services (payments, email) with MSW/Playwright route handlers or sandbox accounts.
- Run E2E against `next build && next start` to mirror production behaviour (dev mode differs for caching and prefetching).
- Control time and randomness in server code via injected clocks where possible.

### CI layout
1. Typecheck + lint.
2. Unit/integration (Vitest) in parallel.
3. Build the app.
4. E2E smoke subset on PR; full suite nightly or on main.
5. Lighthouse/Web Vitals budgets and axe checks on key pages.

## Follow-ups
- **Why not render async Server Components in tests?** — The test renderers don't yet understand server-component semantics (async rendering, server-only APIs); the framework docs recommend E2E for async components.
- **Can you test Server Actions invoked from a form without a browser?** — You can call the function directly with `FormData`, but not the transport details (CSRF/origin, serialization); E2E covers those.

## Common Mistakes
- Trying to unit test the whole async page tree.
- Mocking so heavily that actions are never really exercised.
- Running E2E against `next dev`.

## Tips
- Lead with "make logic plain functions; test composition in the browser".

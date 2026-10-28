---
title: "Design a data access layer (DAL) with DTOs, server-only and taint APIs"
level: advanced
type: design
tags: [data-access-layer, dto, server-only, security, taint, architecture]
related: [nextjs/optimistic-auth-checks-proxy, nextjs/request-memoization-react-cache, nextjs/server-actions-are-public-endpoints, architecture/api-client-error-handling]
---

## Question
Design a data access layer for a Next.js App Router app. What belongs in it, how do you prevent accidental leaks of sensitive fields to Client Components, and how do you keep it consistent across reads, mutations and caching?

## Clues
- Centralise authentication, authorisation and shaping of data.
- Think about what is allowed to import the DAL, and about what it returns.
- Environment variables and DB clients should be reachable only from one place.

## Interview Answer
A DAL is a server-only internal library through which all data reads and writes pass. It does three jobs: it authenticates and authorises each call, it returns minimal Data Transfer Objects instead of database rows, and it is the only module that touches the database client and secrets such as `process.env.DB_URL`. I mark it with `import "server-only"` so importing it from client code fails the build. Functions that need the current user use a `cache()`-wrapped `verifySession()`, so the lookup happens once per request, and per-resource functions check ownership or roles before returning. DTO functions pick and compute fields, such as hiding a phone number unless the viewer is allowed to see it. Server Actions are thin wrappers that call the DAL, and caching is added inside the DAL with `"use cache"`, passing user-independent arguments only. React's taint APIs can add a safety net but don't replace explicit DTOs.

## Explanation
### Structure

```txt
src/
  data/
    db.ts            server-only: client + env secrets (only file reading process.env.DB_URL)
    auth.ts          verifySession(), getCurrentUser()
    users.ts         DTO functions: getProfile(slug), listTeamMembers()
    posts.ts         getPost(id), createPost(input), deletePost(id)
  app/…              pages/actions call data/* only
```

### Example

```ts
// data/db.ts
import "server-only";
export const db = createClient(process.env.DATABASE_URL!);
```

```ts
// data/users.ts
import "server-only";
import { cache } from "react";
import { db } from "./db";
import { verifySession } from "./auth";

export type ProfileDTO = { username: string; phone: string | null };

const canSeePhone = (viewer: { id: string; team: string; role: string }, team: string) =>
  viewer.role === "admin" || viewer.team === team;

export const getProfile = cache(async (slug: string): Promise<ProfileDTO | null> => {
  const viewer = await verifySession();                      // authenticate
  const row = await db.user.findUnique({ where: { slug } });
  if (!row) return null;
  return {                                                   // minimal, computed fields
    username: row.username,
    phone: canSeePhone(viewer, row.team) ? row.phone : null,
  };
});
```

```ts
// data/posts.ts: mutation with authorisation
export async function deletePost(postId: string) {
  const viewer = await verifySession();
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== viewer.userId) throw new Error("Forbidden");
  await db.post.delete({ where: { id: postId } });
}
```

```ts
// app/actions.ts: thin
"use server";
import { deletePost } from "@/data/posts";
export async function deletePostAction(id: string) {
  await deletePost(id);
  updateTag("posts");
}
```

### Preventing leaks

| Measure | Effect |
|---|---|
| `import "server-only"` | build error if imported from a client module |
| DTO return types | clients only receive what's explicitly selected |
| Only the DAL reads `process.env` secrets | secrets can't be imported by accident |
| No `NEXT_PUBLIC_` for secrets | those are bundled for the browser |
| `experimental.taint` + `taintObjectReference` / `taintUniqueValue` | blocks tainted objects or values from reaching the client; a safety net |
| Class instances for sensitive objects | functions/classes can't be serialised to Client Components by default |
| Narrow Client Component props | accept `{ name }`, not `User` |

### Caching in the DAL
Wrap cacheable, user-independent reads in `"use cache"` with `cacheLife`/`cacheTag`; keep per-user results out of shared caches or key them explicitly by coarse arguments. `React.cache` dedupes inside a request.

### Consistency rules
1. One approach per codebase (DAL, HTTP APIs, or component-level queries); don't mix.
2. Every exported DAL function authenticates, and authorises when touching specific resources.
3. Input validation (Zod) at the boundary: actions and route handlers validate, the DAL trusts typed input but enforces permissions.
4. Errors: return typed results or throw domain errors; map to HTTP/UI at the edges.
5. Tests: unit-test the DAL with a test DB; verify that unauthorised calls fail.

### When a DAL is overkill
Prototypes and small apps may query in components, accepting the risk; migrate as the surface grows. Existing organisations with backend APIs can keep calling those from Server Components with a zero-trust model.

## Follow-ups
- **Why DTOs if the DB model is typed?** — Types don't remove fields at runtime; DTOs make exposure explicit.
- **Where do Zod schemas live?** — Shared module imported by actions/handlers (and by forms for client validation).

## Common Mistakes
- Returning full rows to the client.
- Auth checks only in pages.
- Putting `"use server"` on the whole DAL file, which turns every export into a public endpoint.

## Tips
- Warn about `"use server"` on DAL files: exports become callable actions.

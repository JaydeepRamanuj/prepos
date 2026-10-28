---
title: "Implement role-based and resource-level authorization in the App Router"
level: hard
type: implement
tags: [authorization, rbac, idor, forbidden, server-components, server-actions]
related: [nextjs/data-access-layer, nextjs/optimistic-auth-checks-proxy, nextjs/server-actions-are-public-endpoints]
---

## Question
Implement authorization for a multi-tenant app: users have roles (`viewer`, `editor`, `admin`) within an organisation, and each document belongs to an organisation. Show a reusable permission helper, how Server Components, Server Actions and Route Handlers use it, and how you avoid IDOR bugs and role-based UI leaks.

## Clues
- Authorisation is about permission to act on a specific resource, not only about being logged in.
- Put the policy in one place and call it from every entry point.
- Never trust ids or roles that come from the client.

## Interview Answer
I centralise the policy in a server-only module with a `can(user, action, resource)` function and a role-to-permissions map, and expose DAL functions that call it before touching data. The session gives the user id and membership; for a document I load it, check that its organisation matches the user's membership (this prevents IDOR, where changing an id in a URL exposes someone else's record) and that the role grants the action, then return a DTO. Pages call the same DAL function and show `notFound()` or `forbidden()` as appropriate; Server Actions and Route Handlers call it again because they are separate entry points; client components receive only the capabilities they need (for example `canEdit: boolean`) to hide buttons, which is cosmetic, not security. For list queries I filter by organisation in the query itself rather than filtering after fetching.

## Explanation
### Policy

```ts
// lib/authz.ts
import "server-only";

type Role = "viewer" | "editor" | "admin";
type Action = "doc:read" | "doc:update" | "doc:delete" | "member:invite";

const permissions: Record<Role, ReadonlySet<Action>> = {
  viewer: new Set(["doc:read"]),
  editor: new Set(["doc:read", "doc:update"]),
  admin: new Set(["doc:read", "doc:update", "doc:delete", "member:invite"]),
};

export function can(role: Role, action: Action) {
  return permissions[role].has(action);
}
```

### DAL functions that enforce it

```ts
// data/docs.ts
import "server-only";
import { cache } from "react";
import { forbidden, notFound } from "next/navigation";
import { verifySession } from "./auth";
import { can } from "@/lib/authz";

async function membership(orgId: string) {
  const { userId } = await verifySession();
  const m = await db.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
  return m ? { userId, role: m.role as Role } : null;
}

export const getDoc = cache(async (docId: string) => {
  const doc = await db.doc.findUnique({ where: { id: docId } });
  if (!doc) notFound();
  const m = await membership(doc.orgId);          // tenant check: IDOR protection
  if (!m) notFound();                             // don't reveal the doc exists
  if (!can(m.role, "doc:read")) forbidden();
  return { id: doc.id, title: doc.title, body: doc.body, canEdit: can(m.role, "doc:update") };   // DTO
});

export async function updateDoc(docId: string, input: { title: string; body: string }) {
  const doc = await db.doc.findUnique({ where: { id: docId } });
  if (!doc) throw new Error("Not found");
  const m = await membership(doc.orgId);
  if (!m || !can(m.role, "doc:update")) throw new Error("Forbidden");
  await db.doc.update({ where: { id: docId }, data: input });
}

export async function listDocs() {
  const { userId } = await verifySession();
  return db.doc.findMany({                         // filter in the query, not after
    where: { org: { memberships: { some: { userId } } } },
    select: { id: true, title: true },
  });
}
```

### Entry points

```tsx
// app/docs/[id]/page.tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDoc(id);                    // enforces auth + authorisation
  return <Editor doc={doc} readOnly={!doc.canEdit} />;
}
```

```ts
// app/docs/actions.ts
"use server";
export async function saveDoc(id: string, fd: FormData) {
  const input = schema.parse({ title: fd.get("title"), body: fd.get("body") });
  await updateDoc(id, input);                      // re-checks permissions
  updateTag(`doc-${id}`);
}
```

```ts
// app/api/docs/[id]/route.ts
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return Response.json(await getDoc(id));          // same DAL function, same rules
}
```

### Avoiding common bugs
1. **IDOR**: always scope by tenant/owner; don't fetch by id alone.
2. **Hidden fields**: derive `orgId`, `userId` and role on the server.
3. **List endpoints**: filter in SQL; post-filtering leaks counts and timing.
4. **404 vs 403**: return 404 for resources the user can't know about; 403 when the user knows it exists but lacks permission.
5. **Capabilities to the client**: pass booleans (`canEdit`) rather than roles and policies.
6. **Caching**: do not cache authorised results in shared caches unless keyed by the permission scope.
7. **Auditing**: log denied attempts.
8. **Tests**: table-driven tests for `can`, plus integration tests that a user from org A can't read org B's doc.

### Beyond roles
For complex rules (ownership, attributes, sharing links) move to ABAC/ReBAC (for example Cerbos, OpenFGA, CASL) while keeping the same call sites.

## Follow-ups
- **Where does the `forbidden()` UI come from?** — A `forbidden.tsx` file; the feature requires enabling `authInterrupts`.
- **How do you hide admin nav?** — Pass `isAdmin` from a Server Component, but still enforce on the server.

## Common Mistakes
- Checking roles in the UI only.
- Fetching by id without tenant scope.
- Trusting a `role` field in the request body.

## Tips
- Say "policy in one function, enforcement in the DAL, UI flags are cosmetic".

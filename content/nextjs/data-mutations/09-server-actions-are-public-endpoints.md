---
title: "Why are Server Actions public endpoints, and how do you secure them?"
level: advanced
type: concept
tags: [server-actions, security, authorization, csrf, idor, validation]
related: [nextjs/how-server-actions-work, nextjs/data-access-layer, nextjs/route-handlers-vs-server-actions, nextjs/server-action-error-handling]
---

## Question
Your admin page checks the session and redirects non-admins before rendering a "Delete user" button wired to a Server Action. Is that secure? Explain what Next.js protects automatically, what it doesn't, and what a secure action looks like.

## Clues
- An action is invoked with a POST request, not by rendering a component.
- Authentication ("who are you") and authorisation ("may you do this to this record") are separate checks.
- Look at what Next.js adds: action ids, an origin check, dead-code elimination, closure encryption.

## Interview Answer
No, the page check only controls whether the button renders. Every exported Server Action is reachable by a direct POST request with a valid action id, regardless of where it's used, so the action must independently verify authentication, authorisation for the specific resource (to prevent IDOR), and validate all input. Next.js helps: it creates encrypted non-guessable action ids, removes unused actions from the client bundle, compares the `Origin` to `Host` for CSRF protection, caps body size, and encrypts closure variables for inline actions. These are defence in depth, not authorisation. A secure action reads the session from cookies, checks the user's role and ownership of the target, validates input with a schema, performs the write, revalidates, and returns minimal data. I put that logic in a server-only data access layer so every action and read goes through the same checks.

## Explanation
### The vulnerable version

```tsx
// app/admin/page.tsx
export default async function Page() {
  const session = await auth();
  if (!session?.user.isAdmin) redirect("/login");          // protects rendering only
  return (
    <form action={deleteUser}>                               {/* deleteUser has no checks */}
      <input type="hidden" name="id" value="123" />
      <button>Delete</button>
    </form>
  );
}

// actions.ts
"use server";
export async function deleteUser(fd: FormData) {
  await db.user.delete({ where: { id: String(fd.get("id")) } });   // anyone who can POST can run this
}
```

An attacker who obtains the action id (visible in client code for any action in use) can POST arbitrary ids.

### Secure version

```ts
// actions.ts
"use server";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";

const input = z.object({ id: z.string().uuid() });

export async function deleteUser(fd: FormData) {
  const actor = await requireAdmin();                       // authentication + role, throws if not admin
  const { id } = input.parse({ id: fd.get("id") });          // validate untrusted input
  if (id === actor.id) throw new Error("You can't delete yourself");   // business rule

  await db.user.delete({ where: { id } });
  await db.auditLog.create({ data: { actorId: actor.id, action: "user.delete", target: id } });
  updateTag("users");
}
```

```ts
// lib/dal.ts
import "server-only";
import { cache } from "react";

export const getSession = cache(async () => { /* read & verify cookie */ });

export async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  if (session.role !== "admin") throw new Error("Forbidden");
  return session;
}
```

### What Next.js gives you

| Feature | What it does | What it doesn't do |
|---|---|---|
| Secure action ids | encrypted, non-deterministic ids, regenerated between builds | hide actions you use; stop authenticated callers |
| Dead-code elimination | unused actions removed from the client bundle | protect used actions |
| Origin vs Host check | blocks cross-site form posts (CSRF) | protect against attacks from allowed origins; configure `serverActions.allowedOrigins` for proxies |
| Body size limit (1 MB default) | limits abuse | validate content |
| Closure variable encryption | protects captured variables sent to the client | replace validation; set a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` across instances |
| POST only | no GET side effects | auth |

### Checklist per action
1. Authenticate: verify the session or token (not a client-provided flag).
2. Authorise: role and ownership for this resource (IDOR protection).
3. Validate input shape and bounds; treat `FormData`, hidden fields and bound arguments as untrusted.
4. Return a DTO of minimal fields; never return secrets or full database rows.
5. Rate-limit sensitive actions (login, reset, payments).
6. Audit log important changes.
7. Keep secrets in env variables read only from the server-only layer.
8. Revalidate after writing.

### Other tips
- Don't put secrets in closures expecting privacy beyond what Next.js encrypts; keep them on the server.
- Behind proxies/CDNs, configure `allowedOrigins`; CSRF checks compare host headers.
- Treat inline `"use server"` closures as separate entry points too.
- Lint/code review rule: no action without an auth call at the top.

## Follow-ups
- **Does the CSRF check cover everything?** — It stops cross-origin form posts; same-site attacks, XSS or stolen sessions still require standard defences (SameSite cookies, CSP).
- **Where should the check live, middleware/proxy or the action?** — In the action (or the DAL it calls); proxy checks are optimistic and can be bypassed by matcher gaps.

## Common Mistakes
- Relying on page-level redirects as authorisation.
- Trusting hidden fields such as `userId` or `role`.
- Returning whole database rows from actions.

## Tips
- Use the words "authentication vs authorisation" and "IDOR"; they signal security awareness.

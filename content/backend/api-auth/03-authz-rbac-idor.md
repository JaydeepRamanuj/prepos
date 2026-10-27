---
title: "Authentication vs authorization: RBAC, ownership checks and preventing IDOR"
level: hard
type: concept
tags: [authorization, rbac, abac, idor, access-control, server-actions, data-access-layer]
related: [backend/jwt-vs-sessions, nextjs/data-access-layer, backend/rest-api-design]
---

## Question
What is the difference between authentication and authorization? How do you implement role-based and ownership-based access control, and how do you prevent Insecure Direct Object Reference (IDOR) bugs, including in Next.js Server Components and Server Actions?

## Clues
- Hiding a button is a UX choice, not a security control.
- Every data access needs both "who is this?" and "may they touch this record?"
- Centralise the checks.

## Interview Answer
Authentication proves who the caller is; authorization decides what that caller may do. Broken access control is the top OWASP risk, and the classic form is **IDOR**: the API takes an id (`/invoices/123`), loads it, and returns it without checking that it belongs to the caller, so changing the id exposes other users' data. I implement authorization on the server for every read and write, using layers: route/page-level checks (is there a session?), role checks (RBAC: admin, editor, viewer mapped to permissions), and, most importantly, resource-level checks (does this user own or have access to *this* record?). The cleanest way is to scope queries by the user in the data layer (`WHERE id = $1 AND owner_id = $2`) so unauthorised rows are simply not found, and return 404 or 403 consistently. In Next.js I put these checks in a Data Access Layer used by Server Components, Route Handlers and Server Actions, never relying on the proxy/middleware alone or on hidden UI, and I treat Server Action arguments as untrusted input because anyone can invoke them directly.

## Explanation
### Models

| Model | Idea | Fit |
|---|---|---|
| RBAC | users have roles; roles grant permissions | most apps |
| ABAC | rules over attributes (user dept, resource owner, time) | complex policies |
| ReBAC | relationships (owner, member of team, shared with) | docs/collab products |
| ACL | per-resource lists of allowed principals | fine-grained sharing |

Keep permissions as verbs on resources (`invoice:read`, `invoice:refund`) and map roles to them; check permissions, not role names, in code.

### The IDOR bug and the fix
```ts
// ❌ vulnerable: any logged-in user can read any invoice by guessing ids
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json(await db.invoice.findUnique({ where: { id } }));
}

// ✅ scoped by owner (or by tenant) in the query itself
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();                       // throws 401 if no session
  const { id } = await params;
  const invoice = await db.invoice.findFirst({ where: { id, ownerId: user.id } });
  if (!invoice) return new Response("Not found", { status: 404 });   // don't reveal existence
  return Response.json(invoice);
}
```
Unguessable ids (UUIDs) reduce enumeration but are **not** authorization.

### Centralised policy

```ts
type Action = "read" | "update" | "delete";
const can = {
  invoice: (user: User, invoice: Invoice, action: Action) =>
    user.role === "admin" || (invoice.ownerId === user.id && action !== "delete"),
};

export async function getInvoice(id: string) {
  const user = await requireUser();
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice || !can.invoice(user, invoice, "read")) return null;
  return toDto(invoice);                                   // return only the fields the caller may see
}
```

### Next.js specifics
- **Proxy (middleware)** is for optimistic, coarse redirects (is there a session cookie?); it is not a complete authorization layer.
- **Data Access Layer**: one module that verifies the session and policy, then returns DTOs; Server Components, Route Handlers and Server Actions all call it.
- **Server Actions** are public POST endpoints: re-check authentication and authorization inside each action, validate inputs with a schema, and never trust ids or flags (`isAdmin`) from the client.
- **Props to Client Components** are serialised into the page: don't pass entire user or DB objects; pass only what the UI needs.

### Related issues
- **Mass assignment:** don't spread request bodies into DB updates (`update({ data: body })`); allowlist fields so users cannot set `role` or `ownerId`.
- **Multi-tenancy:** every query includes the tenant id; consider database row-level security (Postgres RLS) as defence in depth.
- **Function-level access:** admin routes need explicit checks, not just obscure URLs.
- **Horizontal vs vertical privilege escalation:** same-role other user's data vs gaining a higher role.
- **Field-level authorization:** hide sensitive fields (salary, email) from unauthorised roles in DTOs.
- **Consistency of responses:** 404 vs 403 should not leak existence unintentionally.
- **Testing:** write tests that call endpoints as user A with user B's ids; add authorization checks to code review checklists.
- **Auditing:** log denied attempts and sensitive operations.

## Follow-ups
- **Where should authorization live in a microservice setup?** — At each service for its own resources (zero trust), with a shared policy library or engine (OPA, Cedar), not only at the gateway.
- **Is it OK to rely on JWT role claims?** — For coarse roles yes, but object-level checks need current data from the database.

## Common Mistakes
- Checking permissions only in the UI.
- Looking up by id alone, then checking ownership inconsistently.
- Trusting client-sent role or owner fields.

## Tips
- Use the phrase "scope the query by the caller" and show the two versions of the endpoint.

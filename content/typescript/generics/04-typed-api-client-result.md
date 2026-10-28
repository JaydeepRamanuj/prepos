---
title: "Design a typed API client with generics and a Result type"
level: hard
type: design
tags: [generics, api-client, result-type, error-handling, zod, fetch]
related: [typescript/type-guards-predicates, architecture/api-client-error-handling, typescript/generic-functions-constraints]
---

## Question
Design a small typed wrapper around `fetch` that: returns typed JSON, makes errors explicit instead of throwing, validates responses at runtime, and lets callers pass a schema to infer the result type. Show the generic signatures and the usage.

## Clues
- A discriminated union can model success and failure.
- Runtime validation turns `unknown` into `T`.
- Infer `T` from a schema rather than asking callers to write type arguments.

## Interview Answer
I'd return a `Result<T, ApiError>` discriminated union, so callers must handle failure to access `data`, and have the client accept a schema (Zod or any object with a `parse` method) so `T` is inferred from it instead of asserted. The function is generic over the schema: `request<S extends Schema<unknown>>(url, schema: S): Promise<Result<Output<S>>>`. Inside, it calls `fetch`, maps network failures and non-2xx statuses to typed error variants, parses the body as `unknown`, and validates it; only validated data is returned as success. This keeps `any` out, makes error handling explicit and exhaustive, and keeps the types and runtime checks in sync because both come from the same schema. Callers can use helper functions like `unwrapOr` or pattern match on `ok`.

## Explanation
### Types

```ts
export type Result<T, E = ApiError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export type ApiError =
  | { kind: "network"; cause: unknown }
  | { kind: "http"; status: number; body?: unknown }
  | { kind: "validation"; issues: string[] };

// A minimal schema interface; Zod, Valibot and others satisfy it
interface Schema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: { message: string } };
}
type Output<S> = S extends Schema<infer T> ? T : never;
```

### Client

```ts
export async function request<S extends Schema<unknown>>(
  url: string,
  schema: S,
  init?: RequestInit
): Promise<Result<Output<S>>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (cause) {
    return { ok: false, error: { kind: "network", cause } };
  }

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    return { ok: false, error: { kind: "http", status: res.status, body } };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: { kind: "validation", issues: [parsed.error.message] } };
  }
  return { ok: true, data: parsed.data as Output<S> };
}
```

### Usage

```ts
import { z } from "zod";

const UserSchema = z.object({ id: z.number(), name: z.string() });

const result = await request("/api/user/1", UserSchema);   // Result<{ id: number; name: string }>

if (!result.ok) {
  switch (result.error.kind) {
    case "network":    showOffline(); break;
    case "http":       result.error.status === 404 ? showNotFound() : showError(); break;
    case "validation": report(result.error.issues); break;
  }
} else {
  console.log(result.data.name);                 // typed, validated
}
```

### Helpers

```ts
export const unwrapOr = <T, E>(r: Result<T, E>, fallback: T): T => (r.ok ? r.data : fallback);

export function mapResult<T, U, E>(r: Result<T, E>, fn: (t: T) => U): Result<U, E> {
  return r.ok ? { ok: true, data: fn(r.data) } : r;
}
```

### Design decisions
- **Result vs throwing**: expected failures (network, 404, validation) are part of the contract; programmer errors can still throw.
- **Schema-driven inference**: no `as User[]` casts at call sites.
- **`unknown` body**: nothing is trusted until validated.
- **Typed errors**: callers can exhaustively handle, and UI can map errors to messages.
- **Extensibility**: add `signal` (AbortController), retries, auth headers, a base URL, and an endpoint map (`api.users.get(id)`) built on top.
- **TanStack Query** integration: the `queryFn` can throw the `error` for the library to catch or return `Result`; many teams throw typed errors in `queryFn` to use its error state.

### Pitfalls
- `res.json()` returns `Promise<any>`: assign to `unknown` immediately.
- Distinguish aborted requests (`AbortError`) from network failures.
- Don't validate huge payloads on hot paths without considering cost.
- Keep the `as Output<S>` cast confined to one line; `Schema<infer T>` extraction can't be proven by the compiler.

## Follow-ups
- **Why not just `Promise<T>` and throw?** — Callers can forget `try/catch`, and thrown errors are untyped in TypeScript.
- **How would you type endpoints?** — A map of route → `{ params, response }` types and a generic `call<K extends keyof Endpoints>(route: K, …)`.

## Common Mistakes
- Trusting `await res.json()` as `T`.
- Returning `{ data?: T; error?: E }` instead of a discriminated union.

## Tips
- Mention "parse, don't assert" and the discriminated union.

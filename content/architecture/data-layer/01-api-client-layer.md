---
title: "Design a frontend API client layer: structure, typing and separation from components"
level: medium
type: design
tags: [api-client, data-layer, fetch-wrapper, typing, separation-of-concerns, tanstack-query]
related: [architecture/api-client-error-handling, architecture/separation-of-concerns-react, typescript/typed-api-client-result]
---

## Question
How would you structure the network layer of a frontend app so components don't call `fetch` directly? Cover a base client, endpoint modules, typed responses, query hooks, auth, and testing.

## Interview Answer
I separate concerns into layers: a thin base HTTP client (wrapping `fetch`) that handles the base URL, headers, auth tokens, JSON parsing, timeouts, cancellation and error normalisation; per-domain API modules (`users.ts`, `orders.ts`) exposing typed functions like `getOrders(params)`; a caching/state layer (TanStack Query or framework data loading) with query-key factories and hooks like `useOrders`; and components that only consume hooks. Types come from a schema (OpenAPI codegen, tRPC, GraphQL codegen, or Zod parsers) rather than hand-written assertions, so runtime validation and compile-time types agree. Cross-cutting concerns live in the base client or middleware: attaching the token, refreshing on 401, request ids, retry policy for idempotent requests, and mapping errors to a consistent shape. This keeps components free of URLs and JSON handling, makes the API easy to mock in tests (MSW at the network boundary), and allows swapping transport or backend details in one place.

## Explanation
### Layers

```txt
UI components
   │ use
Hooks (useOrders, useCreateOrder)          ← TanStack Query: keys, caching, invalidation
   │ call
API modules (orders.ts)                     ← typed functions per resource
   │ use
HTTP client (http.ts)                       ← base URL, headers, auth, errors, abort, retry
   │
fetch / network
```

### Base client

```ts
// lib/http.ts
export class HttpError extends Error {
  constructor(public status: number, public body: unknown, message?: string) { super(message ?? `HTTP ${status}`); }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; params?: Record<string, string | number | undefined>; signal?: AbortSignal };

export async function http<T>(path: string, { body, params, headers, ...init }: Options = {}): Promise<T> {
  const url = new URL(path, process.env.NEXT_PUBLIC_API_URL);
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => undefined);
    throw new HttpError(res.status, payload);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
```

(For auth tokens, cross-cutting concerns and the refresh flow, see the error handling question.)

### Resource modules

```ts
// lib/api/orders.ts
import { z } from "zod";
import { http } from "../http";

export const orderSchema = z.object({ id: z.string(), total: z.number(), status: z.enum(["pending", "paid", "shipped"]) });
export type Order = z.infer<typeof orderSchema>;

export const ordersApi = {
  list: async (params: { status?: Order["status"]; page?: number }, signal?: AbortSignal) =>
    z.array(orderSchema).parse(await http<unknown>("/orders", { params, signal })),     // runtime validation at the boundary
  get: async (id: string, signal?: AbortSignal) => orderSchema.parse(await http<unknown>(`/orders/${id}`, { signal })),
  create: async (input: { items: string[] }) => orderSchema.parse(await http<unknown>("/orders", { method: "POST", body: input })),
};
```

### Query hooks

```ts
// features/orders/queries.ts
export const orderKeys = {
  all: ["orders"] as const,
  list: (p: object) => [...orderKeys.all, "list", p] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
};

export const useOrders = (params: { status?: Order["status"]; page?: number }) =>
  useQuery({ queryKey: orderKeys.list(params), queryFn: ({ signal }) => ordersApi.list(params, signal), placeholderData: keepPreviousData });

export const useCreateOrder = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ordersApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }) });
};
```

Components import `useOrders`, never the client.

### Typing options

| Approach | Pros | Cons |
|---|---|---|
| Zod schemas as source | runtime + static types; validates untrusted data | duplicates server definitions unless generated |
| OpenAPI codegen (openapi-typescript, orval, hey-api) | types generated from the contract; typed `fetch` clients | build step; types don't validate at runtime unless you add it |
| tRPC | end-to-end types in TS monorepos, no codegen | couples client and server; TS-only |
| GraphQL codegen | typed operations, fragments | GraphQL overhead; caching complexity |
| Hand-written interfaces | quick | drift, no runtime guarantees |

### Server and client usage
In Next.js, call the same API modules from Server Components (with `fetch` caching options or `"use cache"`) and from client hooks; keep server-only secrets (API keys) in server modules (`import "server-only"`), and use a different base client (forwarding cookies) on the server.

### Testing
MSW handlers at the network boundary for integration tests; unit tests for API modules with a mocked `http`; contract tests (Pact, OpenAPI diff in CI) to catch backend drift.

### Anti-patterns
- `fetch` calls scattered in components and effects.
- URL strings duplicated across the codebase.
- `as User[]` casts on `res.json()`.
- Swallowing errors; inconsistent error shapes.
- Business logic in the client layer; keep it transport-focused.

## Follow-ups
- **Axios or fetch?** — Native `fetch` is sufficient; axios adds interceptors and request cancellation conveniences at a bundle cost.
- **Where do DTO → domain model mappings go?** — In the API module (anti-corruption layer), so components use stable domain types.

## Common Mistakes
- Mixing fetching with UI concerns.
- No runtime validation of external data.
- Query keys scattered as strings.

## Tips
- Draw the four layers and name one responsibility for each.

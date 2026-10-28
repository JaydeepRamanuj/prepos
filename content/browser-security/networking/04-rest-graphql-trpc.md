---
title: "REST vs GraphQL vs tRPC: trade-offs from the frontend's perspective"
level: medium
type: concept
tags: [rest, graphql, trpc, api-design, over-fetching, caching, type-safety]
related: [architecture/api-contracts-caching-strategy, architecture/api-client-layer, browser-security/http-caching]
---

## Question
Compare REST, GraphQL and tRPC for a frontend team. What problems does each solve, what are the costs, and how would you decide?

## Interview Answer
REST models resources with URLs and HTTP verbs; it uses the web's built-in caching, status codes and tooling, but can cause over-fetching (fields you don't need), under-fetching (several round trips for one screen) and endpoint sprawl. GraphQL exposes one endpoint with a typed schema where the client asks for exactly the fields it needs across related entities in one request, which suits many different clients and graph-shaped data, at the cost of server complexity (resolvers, N+1 queries, query-cost limits), harder HTTP caching (mostly POST to one URL, so you need persisted queries or a normalised client cache like Apollo/Relay), and more rigorous error handling (HTTP 200 with an `errors` array). tRPC lets a TypeScript client call server procedures with end-to-end inferred types and no schema or codegen, perfect for a full-stack TS monorepo with one client, but it couples client and server, is TypeScript-only and is not a public API. I choose by team and clients: public or multi-language → REST/OpenAPI; many clients with varied data needs → GraphQL; one Next.js app with the backend in the same repo → tRPC or just Server Actions.

## Explanation
### Same screen, three styles

```ts
// REST: two requests (or a custom aggregate endpoint)
const user = await fetch(`/api/users/42`).then(r => r.json());
const posts = await fetch(`/api/users/42/posts?limit=5`).then(r => r.json());

// GraphQL: one request, exact fields
const { data } = await client.query({
  query: gql`query { user(id: 42) { name avatar posts(first: 5) { id title } } }`,
});

// tRPC: typed function call, inferred from the server router
const profile = await trpc.user.profile.query({ id: 42 });   // return type known at compile time
```

### Comparison

| | REST | GraphQL | tRPC |
|---|---|---|---|
| Contract | OpenAPI (optional) | schema (SDL), introspection | TypeScript types of the router |
| Over/under-fetching | common | solved by selection sets | solved by designing procedures per need |
| HTTP caching | excellent (GET, ETag, CDN) | difficult; persisted queries, normalised cache | GET queries cacheable but usually not CDN-cached |
| Type safety | via codegen | via codegen | built in, no codegen |
| Tooling/ecosystem | universal | Apollo, Relay, urql, GraphiQL | TanStack Query integration |
| Learning curve | low | medium-high | low for TS devs |
| Real-time | SSE/WebSockets separately | subscriptions | subscriptions (WebSocket/SSE) |
| Public API suitability | best | possible (GitHub does) | poor |
| Errors | HTTP status codes | 200 + `errors[]` (partial data) | typed errors, HTTP codes |
| File upload | simple (multipart) | spec-less, extra libraries | via separate route/FormData |
| Versioning | URL/headers | deprecate fields, additive evolution | refactor together (same repo) |

### Caching in more detail
- REST: `GET /products/1` with `Cache-Control` and ETag works everywhere, including CDNs.
- GraphQL: normalised client caches store entities by `__typename:id` so a mutation result updates every list showing that entity. On the server side, persisted queries (hash → query) allow GET requests and CDN caching.
- tRPC: use TanStack Query's client cache; for server caching rely on your own layers.

### GraphQL costs worth naming
- **N+1** resolver queries (mitigated with DataLoader batching).
- **Unbounded queries**: need depth/complexity limits and timeouts.
- **Authorisation** per field/resolver.
- **Observability** is harder because everything is `POST /graphql`; use operation names.
- **Error semantics**: partial success and `errors` array require explicit handling.
- **Bundle size** of clients like Apollo; Relay needs a compiler.

### tRPC notes
Zod input validation shared with the client, middleware for auth, and procedures grouped into routers. The client imports only the *type* of the router, so no server code is bundled. Works well with Next.js, though in the App Router many teams use Server Components and Server Actions for the same benefit without a separate RPC layer.

### REST done well
Consistent resource naming, correct status codes and verbs, pagination (cursor-based), filtering, `ETag`/conditional requests, problem+json errors, OpenAPI spec for generated clients and docs, idempotency keys for POST.

### Decision guide
- External developers or mobile apps in other languages → REST + OpenAPI.
- Complex graph of related data and several client types (web, iOS, Android) wanting different shapes → GraphQL.
- Single TypeScript codebase, internal use, fast iteration → tRPC (or Server Actions).
- Mixed: a BFF can expose GraphQL or tRPC to the frontend while talking REST to backend services.

## Follow-ups
- **Does GraphQL replace REST?** — No; it's a different trade-off. Many organisations run both, using GraphQL as an aggregation layer.
- **What about gRPC-web?** — Efficient binary contracts for service-to-service; browsers need a proxy, so it is less common for frontends.

## Common Mistakes
- Choosing GraphQL only to avoid writing endpoints.
- Ignoring caching consequences.
- Treating tRPC as a public API.

## Tips
- Talk in terms of who owns the contract and how many clients exist.

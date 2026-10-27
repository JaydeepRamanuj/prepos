---
title: "Typed API contracts and a caching strategy across server, client and CDN"
level: advanced
type: design
tags: [api-contracts, openapi, trpc, graphql, caching, bff, revalidation]
related: [architecture/api-client-layer, nextjs/caching-layers-overview, state/why-tanstack-query]
---

## Question
Your team is choosing how the frontend talks to the backend: REST with OpenAPI, GraphQL, or tRPC. How do you keep types in sync, and what caching strategy do you use at each layer (browser, client cache, server, CDN)? Include a BFF option and how to decide.

## Clues
- A contract that is machine-readable can generate types and validators.
- Caching has several layers with different invalidation costs.
- Personalised data must not enter shared caches.

## Interview Answer
I choose based on the organisation: with a separate backend team or multiple clients, an OpenAPI (REST) contract with generated TypeScript types and runtime validators gives a language-neutral source of truth enforced in CI (breaking-change detection); with a TypeScript monorepo and one client, tRPC provides end-to-end types without codegen; GraphQL fits graph-shaped data and many clients with varied needs, at the cost of caching complexity and server infrastructure. A Backend-for-Frontend (often Next.js route handlers or server code) can aggregate services, hide secrets and shape payloads for the UI. For caching I layer deliberately: HTTP caching and CDN (`Cache-Control`, `s-maxage`, `stale-while-revalidate`) for public data; server-side caches (`"use cache"` with tags, or Redis) for shared expensive reads; a client cache (TanStack Query) with `staleTime` tuned per resource for interactive data; and no shared caching for personal data. Invalidation follows writes: tags or query-key invalidation, plus time-based safety nets. Types are generated from the contract and responses are validated at the boundary.

## Explanation
### Contract options

| Option | Source of truth | Types | Strengths | Weaknesses |
|---|---|---|---|---|
| REST + OpenAPI | spec file (YAML/JSON) | generated (openapi-typescript, orval, hey-api) | language-agnostic, HTTP caching, tooling, contract tests | codegen step; over/under-fetching |
| tRPC | server router types | inferred | zero codegen, great DX, shared Zod validators | TS-only, coupled repos, not public API friendly |
| GraphQL | schema (SDL) | generated per operation | exact data per screen, strong typing, fragments | caching complexity, N+1 on server, query cost control |
| gRPC/Protobuf | `.proto` | generated | efficient, strong contracts | needs gateway for browsers |

Process for REST:
1. Backend publishes OpenAPI (generated from code or design-first).
2. CI diffs the spec (oasdiff) and fails on breaking changes without a version bump.
3. Frontend generates types/clients/Zod schemas (`orval`, `openapi-zod-client`) in a package or on build.
4. MSW handlers generated from the spec for tests (`msw-auto-mock`/`orval`).
5. Runtime validation on critical boundaries (or in dev/test only for performance).

### BFF (Backend for Frontend)
A thin server layer owned by the frontend team:
- Aggregates multiple APIs into screen-shaped responses, reducing round trips.
- Keeps secrets and tokens off the browser (cookie sessions; exchanges for upstream tokens).
- Normalises errors and pagination, adds caching, rate limiting.
- In Next.js: Server Components/Route Handlers/Server Actions can act as a BFF; keep it thin to avoid a second backend.

### Caching layers

```txt
Browser HTTP cache → CDN → (BFF/Next.js server cache) → origin services → DB
         ↑
Client query cache (TanStack Query) in memory
```

| Layer | Controls | Best for | Invalidation |
|---|---|---|---|
| Browser HTTP cache | `Cache-Control`, ETag | static assets, public GETs | URL fingerprinting, short TTL, revalidation |
| CDN | `s-maxage`, `stale-while-revalidate`, surrogate keys | public pages/API responses | purge by key/tag, TTL |
| Server cache (`use cache`, Redis) | `cacheLife`, tags | expensive shared reads | `updateTag`/`revalidateTag`, events |
| Client cache | `staleTime`, `gcTime`, keys | interactive state, navigation | `invalidateQueries`, mutations |
| In-process memoisation | `React.cache` | per-request dedupe | automatic |

Rules:
1. **Never cache personalised responses in shared layers** (`Cache-Control: private`/`no-store`; key by coarse segments only).
2. **Cache close to where the cost is** (expensive queries at the server; navigation snappiness at the client).
3. **Pick freshness per resource**: reference data (countries) long TTL; inventory short; user profile after edit invalidated immediately.
4. **Invalidate on write** through a single mechanism per resource (tags/keys), plus TTL as a safety net.
5. **Stale-while-revalidate** wherever staleness is acceptable for latency.
6. **Avoid double caching surprises**: e.g. Next.js server cache + CDN + client cache each holding a version; know the longest staleness window users can see.
7. **Idempotent, cacheable GETs**: design endpoints so URLs fully identify the resource (no cache-busting params, stable ordering).
8. **Conditional requests (ETag/If-None-Match)** to save bandwidth.

### GraphQL specifics
Normalised client caches (Apollo, urql, Relay) store entities by id; mutations return updated fields to update the cache automatically; persisted queries and GET requests enable CDN caching; avoid unbounded query depth with complexity limits.

### tRPC specifics
Types flow from router to client automatically; use with TanStack Query (the integration provides query keys); keep input/output Zod schemas shared; publish an OpenAPI adapter if external consumers need REST.

### Decision guide
- Multiple clients (web, mobile, partners), separate teams → REST + OpenAPI (or GraphQL).
- Single TS full-stack team (Next.js monorepo) → tRPC or Server Actions + typed DAL.
- Complex relational UIs with many shapes → GraphQL with codegen.
- Public API → REST/OpenAPI.

### Pitfalls
- Hand-maintained types that drift.
- Generated types without runtime validation for third-party data.
- Caching keyed by user id in shared caches (low hit rate, privacy risk).
- Inconsistent invalidation across layers leading to "works after refresh" bugs.
- Over-fetching in REST; N+1 requests from components (fix with BFF aggregation or batching).

## Follow-ups
- **How do you handle breaking API changes?** — Versioned endpoints (`/v2`) or additive-only changes with deprecation windows; contract tests in CI.
- **REST vs GraphQL for caching?** — REST maps naturally to HTTP caches; GraphQL needs persisted queries or normalised client caches.

## Common Mistakes
- Choosing GraphQL for the buzz without the supporting infrastructure.
- Caching authenticated responses at the CDN.
- No contract tests.

## Tips
- Tie the choice to team topology (who owns the contract), then enumerate cache layers.

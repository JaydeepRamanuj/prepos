---
title: "Error handling in the API layer: normalisation, retries, auth refresh and user feedback"
level: hard
type: design
tags: [error-handling, retries, token-refresh, 401, idempotency, error-boundaries, toasts]
related: [architecture/api-client-layer, typescript/typed-api-client-result, react/error-boundaries]
---

## Question
Design error handling for the frontend data layer. How do you normalise errors, decide what to retry, handle expired sessions (401) with refresh tokens without duplicate refreshes, map errors to UI (inline, toast, error boundary), and avoid leaking sensitive details?

## Clues
- Not all failures are equal: network errors, 4xx client errors, 5xx server errors, validation errors.
- Retrying is only safe for idempotent operations.
- Concurrent requests may hit 401 at the same time.

## Interview Answer
I normalise every failure into a small typed taxonomy at the lowest layer (network/timeouts, HTTP status errors with parsed bodies, validation/parse errors, aborts), so the rest of the app never inspects raw `Response` objects. Retries are policy-driven: retry network errors and 502/503/504 with exponential backoff and jitter for idempotent requests (GET, PUT, DELETE, or POST with an idempotency key), never for 4xx other than 408/429 (honouring `Retry-After`). For authentication, a 401 triggers a single shared token refresh (a promise cached so concurrent requests wait for the same refresh), then the original request is retried once; if refresh fails the user is signed out. The UI maps categories to presentation: field-level validation errors inline, recoverable action failures as toasts with retry, page-level data failures as inline error states, and unexpected render errors to error boundaries; messages shown to users are friendly and never include stack traces or raw server messages, while detailed errors go to logging/monitoring with a request id. TanStack Query centralises retry and global error handling through its defaults and `QueryCache`/`MutationCache` callbacks.

## Explanation
### Error taxonomy

```ts
export type AppError =
  | { kind: "network"; cause: unknown }                                    // offline, DNS, CORS, timeout
  | { kind: "timeout" }
  | { kind: "aborted" }                                                    // user navigated away: ignore
  | { kind: "http"; status: number; code?: string; message?: string; fields?: Record<string, string[]>; requestId?: string; retryAfter?: number }
  | { kind: "parse"; issues: string[] };                                   // response didn't match the schema

export const isRetryableStatus = (s: number) => [408, 425, 429, 500, 502, 503, 504].includes(s);
```

The server should return a consistent error body (e.g. RFC 9457 `application/problem+json`: `type`, `title`, `status`, `detail`, plus extensions like `errors`) so the client can map reliably.

### Retry policy

```ts
async function withRetry<T>(fn: (attempt: number) => Promise<T>, { retries = 3, base = 300, idempotent = true } = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      const err = toAppError(e);
      const retryable = idempotent && (err.kind === "network" || err.kind === "timeout" || (err.kind === "http" && isRetryableStatus(err.status)));
      if (!retryable || attempt >= retries) throw e;
      const delay = err.kind === "http" && err.retryAfter ? err.retryAfter * 1000 : base * 2 ** attempt * (0.8 + Math.random() * 0.4);   // backoff + jitter
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
```

Non-idempotent POSTs need an `Idempotency-Key` header to be safely retried. Circuit-breaker or max concurrency protects a struggling backend.

### 401 handling with a shared refresh

```ts
let refreshing: Promise<void> | null = null;

async function refreshOnce() {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
    .then((r) => { if (!r.ok) throw new Error("refresh failed"); })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function authedFetch(input: RequestInfo, init?: RequestInit) {
  let res = await fetch(input, { ...init, credentials: "include" });
  if (res.status === 401) {
    try {
      await refreshOnce();                       // concurrent 401s await the same promise
      res = await fetch(input, { ...init, credentials: "include" });   // retry once
    } catch {
      signOut();                                 // clear client state, redirect to login
      throw new HttpError(401, undefined);
    }
  }
  return res;
}
```

Prefer HttpOnly cookie sessions (refresh handled server-side) over storing tokens in JS-accessible storage. Never retry a refresh loop indefinitely.

### Mapping to UI

| Error | Presentation |
|---|---|
| Validation (422) with field errors | inline by field (set into the form) |
| Conflict/business rule (409) | message near the action, maybe a dialog |
| 401 after refresh failure | redirect to sign-in with return URL |
| 403 | "You don't have access" page/state |
| 404 | not-found state (or empty state) |
| 429 | toast with retry-after hint, disable the action briefly |
| 5xx/network | retry button, toast, offline banner; keep stale data visible |
| Unexpected render errors | error boundary with reset |
| Aborted | ignore silently |

With TanStack Query:

```ts
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: (count, err) => isRetryable(err) && count < 3, staleTime: 30_000 } },
  queryCache: new QueryCache({ onError: (err, query) => { if (query.state.data !== undefined) toast.error("Couldn't refresh. Showing saved data."); } }),
  mutationCache: new MutationCache({ onError: (err) => reportError(err) }),
});
```

Show errors only when there's no stale data to display, or show non-blocking notices alongside stale data.

### Safety and observability
- Don't show raw `message` from the server; map `code` to localised copy.
- Include a **request id** (from a response header) in the UI details and logs for support.
- Report unexpected errors to Sentry/Datadog with context (route, user id hash, endpoint) but scrub PII.
- Distinguish expected errors (validation) from exceptions to keep alerts meaningful.
- Offline handling: detect via `navigator.onLine` plus failed requests; queue mutations if the product requires it (TanStack paused mutations).

### Testing
MSW handlers for 401, 429, 500, network failure, slow responses; assertions on retries (count and timing with fake timers), refresh deduplication (two parallel 401s trigger one refresh), and UI mapping.

## Follow-ups
- **Should GET retries be unlimited?** — No; cap attempts and total time; backoff with jitter prevents thundering herds.
- **Where to put error handling: client wrapper or UI?** — Normalise in the client; decide presentation in the UI/query layer.

## Common Mistakes
- Retrying non-idempotent requests blindly.
- Parallel refresh calls racing.
- Showing generic "Something went wrong" for validation errors.

## Tips
- Say "normalise low, present high" and describe the single-flight refresh.

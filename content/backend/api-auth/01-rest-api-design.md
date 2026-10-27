---
title: "Design a REST API: resources, methods, status codes, pagination and errors"
level: medium
type: design
tags: [rest, api-design, status-codes, pagination, idempotency, versioning, problem-json]
related: [backend/jwt-vs-sessions, backend/rate-limiting, architecture/api-contracts-caching-strategy]
---

## Question
Design a REST API for a `tasks` feature (create, list, update, delete). Explain URL structure, HTTP methods, status codes, pagination, filtering, error format, idempotency and versioning.

## Interview Answer
I model nouns as resources and let HTTP methods express the action: `GET /tasks`, `POST /tasks`, `GET /tasks/{id}`, `PATCH /tasks/{id}`, `DELETE /tasks/{id}`. Use plural nouns, no verbs in paths, nesting only one level (`/projects/{id}/tasks`). Methods carry semantics: GET is safe and cacheable, PUT/DELETE are idempotent, POST creates (returns `201 Created` with a `Location` header) and is not idempotent unless the client sends an `Idempotency-Key`. Status codes are accurate: 200/201/204 for success; 400 for malformed input, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 validation failure, 429 rate limited; 5xx only for server faults. Collections use cursor-based pagination (`?limit=20&cursor=...`) with filtering and sorting through query parameters. Errors share one shape, ideally RFC 9457 problem details (`type`, `title`, `status`, `detail`, plus field errors). I version additively and deprecate rather than break clients, and document the contract with OpenAPI.

## Explanation
### Endpoints

| Action | Request | Success | Notes |
|---|---|---|---|
| List | `GET /tasks?status=open&sort=-createdAt&limit=20&cursor=abc` | 200 | filter/sort/page via query string |
| Create | `POST /tasks` | 201 + `Location: /tasks/42` | return the created resource |
| Read | `GET /tasks/42` | 200 / 404 | support `ETag` |
| Partial update | `PATCH /tasks/42` | 200 | send only changed fields |
| Replace | `PUT /tasks/42` | 200 | whole representation, idempotent |
| Delete | `DELETE /tasks/42` | 204 | idempotent: deleting again returns 204 or 404 consistently |
| Actions that do not fit CRUD | `POST /tasks/42/complete` | 200 | pragmatic verb sub-resource |

### Status code guide

| Code | Use |
|---|---|
| 200 / 201 / 204 | OK / created / no content |
| 304 | not modified (conditional GET) |
| 400 | malformed JSON, bad query syntax |
| 401 | missing/invalid credentials (should send `WWW-Authenticate`) |
| 403 | authenticated but not allowed |
| 404 | not found (also used to hide existence) |
| 409 | conflict (duplicate, version mismatch) |
| 412 / 428 | precondition failed / required (`If-Match` optimistic locking) |
| 422 | well-formed but semantically invalid (field validation) |
| 429 | rate limited, include `Retry-After` |
| 500 / 502 / 503 | server error / bad upstream / unavailable |

### Error format
```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "One or more fields are invalid.",
  "errors": { "title": ["Required"], "dueDate": ["Must be in the future"] },
  "requestId": "req_8f2c"
}
```
Content-Type `application/problem+json`. Never leak stack traces or SQL.

### Pagination
- **Offset** (`?page=3&limit=20`): easy, supports jumping to a page, but slow on big offsets and unstable when rows are inserted.
- **Cursor/keyset** (`?after=<opaque>`): stable and fast (`WHERE (created_at, id) < (...) ORDER BY ... LIMIT n`); response returns `nextCursor`.
- Always cap `limit`, and return metadata (`hasMore`, optional `total` only if cheap).

### Idempotency and concurrency
- `Idempotency-Key` header on POST: the server stores the key and response for a window so client retries do not create duplicates.
- Optimistic locking: return `ETag`, require `If-Match` on PATCH/PUT, respond 412 if stale.

### Versioning and evolution
Prefer additive changes (new optional fields) which clients ignore safely. For breaking changes use `/v2` or a header, support both during a deprecation window (`Deprecation`/`Sunset` headers).

### Cross-cutting
- Auth via `Authorization: Bearer` or session cookies; authorise every resource access (object-level checks to prevent IDOR).
- Validate input with a schema (Zod), set size limits, and sanitise output.
- Caching headers on GETs, CORS configuration, rate limits, request ids and structured logs.
- Consistent naming (camelCase JSON), ISO 8601 UTC timestamps, string ids.
- OpenAPI spec as the contract for docs, mocks and generated clients.

## Follow-ups
- **PUT vs PATCH?** — PUT replaces the whole resource; PATCH changes part of it. JSON Merge Patch is simple; JSON Patch is operation-based.
- **401 vs 403?** — 401: "who are you?"; 403: "I know you, and no."

## Common Mistakes
- Always returning 200 with an error body.
- Verbs in URLs (`/getTasks`).
- Offset pagination on large, changing tables.

## Tips
- Show an example request/response pair for create and list.

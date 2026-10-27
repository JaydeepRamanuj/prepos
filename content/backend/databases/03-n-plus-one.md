---
title: "The N+1 query problem: detecting it and fixing it with joins, batching and DataLoader"
level: medium
type: debugging
tags: [n-plus-one, orm, prisma, dataloader, eager-loading, graphql, performance]
related: [backend/db-indexes, backend/rest-api-design, browser-security/rest-graphql-trpc]
---

## Question
A page listing 50 posts with their authors takes 2 seconds. Logs show 51 SQL queries. What is happening, how do you confirm it, and how do you fix it in an ORM, in REST and in GraphQL?

## Interview Answer
This is the N+1 problem: one query fetches the list (1), then the code runs an additional query for each row to load a related record (N), usually hidden by lazy loading in an ORM or by per-item resolvers in GraphQL. With 50 posts that's 51 round trips; each is fast alone, but latency and connection load add up and scale linearly with the list size. I confirm it with query logging or APM traces showing repeated, near-identical queries differing only by id. The fixes: eager load the relation in the same query (a JOIN) or in a second batched query using `WHERE id IN (...)` (`include`/`with`/`prefetch`/`select_related` depending on the ORM); in GraphQL, batch per request with DataLoader so all author lookups in one tick become one query; and where appropriate denormalise, cache, or return the needed fields directly from a purpose-built query. After fixing, add a test or monitoring that asserts the number of queries for key endpoints to catch regressions.

## Explanation
### The shape of the bug
```ts
// 1 query
const posts = await db.post.findMany({ take: 50 });

// N queries — one per post
for (const post of posts) {
  post.author = await db.user.findUnique({ where: { id: post.authorId } });
}
```
Logs:
```txt
SELECT * FROM posts LIMIT 50
SELECT * FROM users WHERE id = 1
SELECT * FROM users WHERE id = 2
… (50 times)
```

### Fixes

**1. Eager load (ORM)**
```ts
const posts = await db.post.findMany({ take: 50, include: { author: true } });
// Prisma: runs 2 queries (posts, then users WHERE id IN (...)) or a join depending on strategy
```
Select only the columns you need (`select: { title: true, author: { select: { name: true } } }`).

**2. Manual batching**
```ts
const posts = await db.post.findMany({ take: 50 });
const authors = await db.user.findMany({ where: { id: { in: [...new Set(posts.map(p => p.authorId))] } } });
const byId = new Map(authors.map(a => [a.id, a]));
const result = posts.map(p => ({ ...p, author: byId.get(p.authorId) }));
```
Two queries regardless of N.

**3. SQL join**
```sql
SELECT p.id, p.title, u.name AS author_name
FROM posts p JOIN users u ON u.id = p.author_id
ORDER BY p.created_at DESC LIMIT 50;
```
One query. Beware joining one-to-many relations, which multiplies rows; use a separate batched query or aggregation (`json_agg`) for collections.

**4. GraphQL DataLoader**
```ts
const userLoader = new DataLoader<string, User>(async (ids) => {
  const users = await db.user.findMany({ where: { id: { in: [...ids] } } });
  const map = new Map(users.map(u => [u.id, u]));
  return ids.map(id => map.get(id)!);              // results must align with ids order
});

const resolvers = { Post: { author: (post, _, ctx) => ctx.userLoader.load(post.authorId) } };
```
Create loaders per request (not globally) so caching never leaks between users. DataLoader batches all `load` calls made in the same tick and also caches within the request.

### Detecting it
- Enable query logging in dev (Prisma `log: ["query"]`, Django debug toolbar, Rails Bullet gem, SQLAlchemy echo).
- APM trace waterfalls showing dozens of repeated DB spans.
- Tests asserting max queries per request (`assertNumQueries`-style helpers).
- Database `pg_stat_statements` showing a hot query with huge call counts.

### Frontend-side N+1 (same pattern, different layer)
A component per row calling `fetch('/api/users/' + id)` yields N HTTP requests. Fixes: have the list endpoint include the needed fields, expose a batch endpoint (`/users?ids=1,2,3`), or deduplicate through a cache layer like TanStack Query (still N requests if ids differ; batching remains better). In React Server Components, `React.cache` dedupes identical calls within a request, but distinct ids still need batching.

### Trade-offs
- Joins vs separate `IN` queries: `IN` avoids row multiplication and works across services; joins reduce round trips for single-valued relations.
- Eager loading everything "just in case" fetches unused data; load what the response needs.
- Add indexes on the foreign key columns used by the batched queries (`posts.author_id`, `comments.post_id`).
- Pagination interacts with joins: paginate the parent first, then load children for those ids.

## Follow-ups
- **Why not a global DataLoader?** — Its cache would persist data across requests and users, leaking stale or private data.
- **Is N+1 always bad?** — For N of 3 it doesn't matter; the problem is unbounded N and network latency per query.

## Common Mistakes
- Hiding lazy loading behind getters so the loop looks innocent.
- "Fixing" it with a cache while still issuing N queries on a cold cache.
- Joining one-to-many relations and paginating the multiplied rows.

## Tips
- Name the symptom (query count scales with rows) and give the `IN`-batching fix.

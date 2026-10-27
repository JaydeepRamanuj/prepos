---
title: "Database indexes: how B-trees speed queries, composite index order and the cost of indexing"
level: hard
type: concept
tags: [indexes, b-tree, composite-index, explain, query-performance, postgres, selectivity]
related: [backend/n-plus-one, backend/transactions-acid, backend/sql-vs-nosql]
---

## Question
What is a database index and how does it make queries faster? Explain B-tree indexes, composite index column order, covering indexes, when an index is not used, and the downsides of over-indexing. How do you diagnose a slow query?

## Clues
- Without an index the database may scan every row (sequential scan).
- Column order in a composite index follows the "leftmost prefix" rule.
- Indexes speed reads but slow writes and consume space.

## Interview Answer
An index is an auxiliary sorted data structure (usually a B-tree) that lets the database find rows by a column's value in O(log n) instead of scanning the whole table. A B-tree keeps keys ordered, so it accelerates equality lookups, range queries (`>`, `BETWEEN`), `ORDER BY`, and prefix `LIKE 'abc%'`. A composite index on `(a, b, c)` works for queries that filter on `a`, `a,b`, or `a,b,c` (leftmost prefix) but not for `b` alone; the usual rule is equality columns first, then the range or sort column. A covering index contains all columns a query needs so the database can answer from the index alone (index-only scan). Indexes aren't free: every INSERT/UPDATE/DELETE must maintain them, they use storage and memory, and too many hurt write throughput; an index is also ignored when it isn't selective or the query defeats it (functions on the column, leading wildcard, type mismatch). I find slow queries from logs/APM, run `EXPLAIN (ANALYZE, BUFFERS)` to see whether it does a sequential scan, how many rows it estimates versus actually reads, and then add or reshape an index and re-measure.

## Explanation
### The idea
```txt
users table (1M rows)              B-tree index on email
SELECT * FROM users                      [m]
WHERE email = 'a@x.com';              /       \
  no index: scan 1,000,000 rows     [d]       [t]     …  ~3–4 page reads to reach the row
  with index: ~4 lookups
```

### Common index types (Postgres terms)

| Type | Good for |
|---|---|
| B-tree (default) | equality, range, sorting, prefix match |
| Hash | equality only (rarely needed) |
| GIN | JSONB, arrays, full-text search |
| GiST / SP-GiST | geometric, range types, nearest neighbour |
| BRIN | huge, naturally ordered tables (timestamps) with tiny index size |
| Partial index | `WHERE deleted_at IS NULL`; indexes only relevant rows |
| Unique index | enforces uniqueness (primary and unique constraints use them) |

### Composite indexes and order
```sql
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);

-- uses the index: equality on user_id then ordered by created_at, no sort step
SELECT * FROM orders WHERE user_id = 42 ORDER BY created_at DESC LIMIT 20;

-- cannot use it efficiently (skips the leading column)
SELECT * FROM orders WHERE created_at > now() - interval '1 day';
```
Rule of thumb: equality columns first, then range/sort columns. Put the more selective column first only when both are equality filters and queries use either alone.

### Covering and index-only scans
```sql
CREATE INDEX idx_orders_cover ON orders (user_id) INCLUDE (status, total);
SELECT status, total FROM orders WHERE user_id = 42;     -- served from the index
```

### Why an index might not be used
- Low selectivity (e.g. boolean with 50/50 values): scanning is cheaper.
- Function on the column: `WHERE lower(email) = ...` (create an expression index on `lower(email)`).
- Leading wildcard `LIKE '%abc'` (use trigram/GIN or full-text search).
- Implicit casts or mismatched types.
- Stale statistics (`ANALYZE` / autovacuum) leading to bad plans.
- Very small tables where a sequential scan is faster.
- `OR` across different columns, or returning most of the table.

### Costs
- Each write updates every index on the table; many indexes slow inserts and updates and bloat storage.
- Indexes consume RAM (buffer cache); unused indexes waste it. Find unused ones via `pg_stat_user_indexes`.
- Creating indexes on big tables locks writes unless built `CONCURRENTLY`.
- Foreign keys often need an index on the referencing column (Postgres does not create it automatically), or joins and cascading deletes become slow.

### Diagnosing a slow query
1. Identify it: slow query log, `pg_stat_statements`, APM traces, ORM logging.
2. `EXPLAIN (ANALYZE, BUFFERS) SELECT ...` shows plan nodes (Seq Scan, Index Scan, Index Only Scan, Bitmap Heap Scan, Sort, Hash Join), estimated vs actual rows, timings.
3. Look for: sequential scans on large tables, large estimate mismatches (stats), sorts spilling to disk, nested loops over many rows.
4. Fix: add/adjust an index, rewrite the query, select fewer columns, paginate with keyset instead of `OFFSET`, denormalise or cache if needed.
5. Re-measure with realistic data volumes.

### Keyset pagination and indexes
`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20` with an index on `(created_at DESC, id DESC)` stays fast on page 10,000; `OFFSET 200000` must walk past the skipped rows.

### Frontend relevance
Search boxes, infinite scroll feeds and filtered tables are only as fast as the queries behind them; designing API filters and sort options means knowing which are indexed.

## Follow-ups
- **Primary key vs unique index?** — A primary key is a unique, not-null constraint backed by an index; one per table.
- **Why UUIDv4 primary keys can hurt?** — Random inserts scatter across the B-tree causing page splits; time-ordered ids (UUIDv7, ULID) improve locality.

## Common Mistakes
- Indexing every column "just in case".
- Wrong column order in composite indexes.
- Wrapping indexed columns in functions.

## Tips
- Walk through an `EXPLAIN` before/after on a concrete query.

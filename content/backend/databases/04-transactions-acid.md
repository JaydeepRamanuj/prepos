---
title: "Transactions and ACID: isolation levels, race conditions and optimistic locking"
level: hard
type: concept
tags: [transactions, acid, isolation-levels, race-conditions, optimistic-locking, deadlock, idempotency]
related: [backend/db-indexes, backend/redis-caching, backend/rest-api-design]
---

## Question
What does ACID mean? Explain transaction isolation levels and the anomalies they prevent, show how a race condition can happen in a "check then update" flow, and describe fixes such as atomic updates, row locks and optimistic concurrency control.

## Clues
- A transaction groups statements so they succeed or fail as one unit.
- Concurrency anomalies appear when two transactions interleave.
- Prefer a single atomic statement over read-modify-write in application code.

## Interview Answer
ACID describes transaction guarantees: **Atomicity** (all statements commit or none do), **Consistency** (constraints and invariants hold before and after), **Isolation** (concurrent transactions do not see each other's intermediate states, to a degree set by the isolation level) and **Durability** (committed data survives crashes). Isolation levels trade safety for concurrency: Read Committed (the Postgres default) avoids dirty reads; Repeatable Read (snapshot) also prevents non-repeatable reads and phantoms in Postgres; Serializable prevents all anomalies by aborting conflicting transactions, so the app must retry. The classic bug is read-modify-write: two requests read stock = 1, both decide it's available, both decrement, and you oversell. Fixes are to push the check into one atomic statement (`UPDATE ... SET stock = stock - 1 WHERE id = $1 AND stock > 0`, checking affected rows), lock the row (`SELECT ... FOR UPDATE`) inside a transaction, use optimistic concurrency with a version column (`WHERE id = $1 AND version = $2`) and retry on conflict, or rely on constraints (unique, check) as the final guard. Keep transactions short, always roll back on error, and make operations idempotent so retries are safe.

## Explanation
### ACID in practice
```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;      -- or ROLLBACK on any error: no money disappears
```
Atomicity and durability come from the write-ahead log; consistency from constraints and your invariants; isolation from MVCC/locking.

### Anomalies and isolation levels

| Anomaly | Meaning |
|---|---|
| Dirty read | reading another transaction's uncommitted data |
| Non-repeatable read | same row read twice returns different values (someone committed between) |
| Phantom read | same query returns different rows (new rows committed between) |
| Lost update | two transactions read then write, one overwrites the other |
| Write skew | two transactions read overlapping data and make disjoint writes that break an invariant (two doctors both go off-call) |

| Level | Prevents (standard) | Notes |
|---|---|---|
| Read Uncommitted | nothing | Postgres treats it as Read Committed |
| Read Committed | dirty reads | each statement sees latest committed data (Postgres default) |
| Repeatable Read | + non-repeatable reads (and phantoms in Postgres) | snapshot at transaction start; can fail with serialization errors |
| Serializable | all anomalies, including write skew | behaves as if transactions ran one at a time; retry on failure |

### The oversell race
```ts
// ❌ read-modify-write: race between SELECT and UPDATE
const { stock } = await db.product.findUnique({ where: { id } });
if (stock > 0) await db.product.update({ where: { id }, data: { stock: stock - 1 } });
```
Two requests both read `stock = 1`, both pass the check.

### Fixes

**Atomic conditional update** (best when possible)
```sql
UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0;
-- rowCount = 0 → out of stock
```

**Pessimistic lock**
```sql
BEGIN;
SELECT stock FROM products WHERE id = $1 FOR UPDATE;   -- other transactions wait on this row
UPDATE products SET stock = stock - 1 WHERE id = $1;
COMMIT;
```
Safe but serialises contention; keep the critical section tiny; lock rows in a consistent order to avoid deadlocks.

**Optimistic concurrency (version column)**
```sql
UPDATE documents SET body = $1, version = version + 1
WHERE id = $2 AND version = $3;     -- 0 rows → someone else changed it; reload and retry or ask the user
```
Great for low-contention edits (forms, documents). Expose it in APIs with `ETag` and `If-Match`, returning 412/409 on conflict.

**Constraints as a safety net**: `CHECK (stock >= 0)`, unique indexes (`UNIQUE (user_id, coupon_id)`) turn races into errors you handle.

**Serializable + retry loop**: simplest reasoning, but implement retries for serialization failures (`40001`).

### Other practical points
- **Deadlocks:** two transactions waiting on each other's locks; the database aborts one. Keep lock order consistent and transactions short; retry.
- **Long transactions** hold locks/snapshots, block vacuum and hurt performance. Never keep a transaction open while calling external APIs or waiting for user input.
- **Idempotency:** retries (client or queue) must not duplicate effects; use idempotency keys or unique constraints.
- **Distributed operations:** a DB transaction can't span your database and Stripe. Use patterns like the outbox, sagas, and idempotent webhooks, with a compensating action on failure.
- **ORMs:** Prisma `$transaction([...])` or interactive transactions; ensure all statements use the transaction client.
- **Connection pooling in serverless:** transactions need the same connection for all statements; use drivers/poolers that support them.

### Frontend relevance
Double-clicked submit buttons, duplicate webhooks and retries after timeouts create the same race conditions. Disable buttons while pending, send idempotency keys, and make the server safe regardless.

## Follow-ups
- **Optimistic vs pessimistic locking?** — Optimistic assumes conflicts are rare and detects them at write time; pessimistic blocks up front and suits high-contention hot rows.
- **What does MVCC do?** — Keeps multiple row versions so readers don't block writers; each transaction sees a consistent snapshot.

## Common Mistakes
- Doing check-then-act in application code without atomicity.
- Holding transactions open across network calls.
- Assuming Read Committed prevents lost updates.

## Tips
- Present the oversell example and then list the three fixes in order of preference.

---
title: "SQL vs NoSQL: how to choose a database for a product"
level: medium
type: concept
tags: [sql, nosql, postgres, mongodb, relational, document-store, consistency, schema]
related: [backend/db-indexes, backend/transactions-acid, backend/redis-caching]
---

## Question
Compare relational (SQL) and NoSQL databases. When would you choose PostgreSQL, a document store like MongoDB, a key-value store like Redis or DynamoDB, and how do you decide for a new product?

## Interview Answer
Relational databases store data in tables with a defined schema, relationships via foreign keys, powerful querying with SQL (joins, aggregates, window functions) and strong ACID transactions. They are the safe default for most products because the data is relational, requirements change, and ad hoc queries and reporting come up constantly. NoSQL is a family: document stores (MongoDB, Firestore) hold JSON-like documents that map naturally to nested objects and scale horizontally; key-value stores (Redis, DynamoDB) give very fast lookups by key; wide-column (Cassandra) and graph (Neo4j) databases target specific workloads. NoSQL trades flexibility in querying and cross-entity consistency for scale, schema flexibility or latency, and usually requires you to design around your access patterns up front. My default is PostgreSQL (which also supports JSONB for flexible fields), adding Redis for caching and queues, and reaching for a specialised store only when a measured requirement demands it, such as massive write throughput, simple key access at very low latency, or graph traversals.

## Explanation
### Comparison

| | Relational (Postgres, MySQL) | Document (MongoDB, Firestore) | Key-value / wide-column (Redis, DynamoDB) |
|---|---|---|---|
| Data model | tables, rows, foreign keys | JSON documents, embedded or referenced | key → value / partition + sort key |
| Schema | enforced, migrated | flexible (validated optionally) | free-form values |
| Queries | rich SQL, joins, ad hoc | query by fields, limited joins | by key / key ranges; design per access pattern |
| Transactions | full ACID across tables | per document; multi-document transactions exist with cost | limited (DynamoDB transactions exist, restricted) |
| Scaling | vertical + read replicas; sharding is hard | horizontal sharding built in | horizontal by design |
| Consistency | strong by default | tunable | tunable / eventual |
| Best for | business data, reporting, most apps | content, catalogues, event payloads, rapid prototypes | caching, sessions, counters, massive-scale lookups |

### Data modelling difference
Relational: normalise (users, orders, order_items) and join at query time; the model is independent of access patterns. Document: embed data read together (`order.items[]`) to avoid joins; duplication (denormalisation) is accepted and updates must keep copies consistent. Key-value/DynamoDB: start from the queries ("get orders by user sorted by date") and shape keys accordingly (single-table design); changing access patterns later is costly.

### Practical guidance
- **Default to Postgres** unless there is a reason not to: reliable, mature, JSONB, full-text search, extensions (pgvector), row-level security.
- **Use a document store** when records are self-contained, schema varies per record, and you rarely join (e.g. CMS content, user profiles with nested settings).
- **Use Redis** for caching, rate limits, sessions, queues, leaderboards, pub/sub; treat as a derived, rebuildable store.
- **Use DynamoDB/Cassandra** for huge scale with known access patterns and predictable single-digit-ms latency.
- **Use a search engine** (Elasticsearch/OpenSearch/Typesense) for relevance-ranked search, not as the system of record.
- **Use a graph database** only for deep relationship traversal (recommendations, fraud rings).
- **Polyglot persistence:** one source of truth plus specialised derived stores kept in sync (events, CDC).

### CAP and consistency (brief)
In a partition, distributed systems choose consistency or availability. Many NoSQL systems favour availability with eventual consistency, so reads might be stale; relational single-node databases give strong consistency but scaling writes requires sharding or specialised distributed SQL (CockroachDB, Spanner).

### Frontend-flavoured considerations
- Firestore/Realtime DB suit client-driven apps with realtime sync and security rules, but complex queries and reporting are limited. (This project stores per-user progress in a single Firestore document.)
- With ORMs (Prisma, Drizzle) SQL schemas give type-safe queries end to end.
- Serverless: connection limits matter for Postgres (use a pooler like PgBouncer or serverless drivers); HTTP-based databases avoid connection exhaustion.

### Common decision mistakes
- Choosing NoSQL because "schemaless is faster to build", then reimplementing joins and consistency in application code.
- Choosing MongoDB for highly relational data (orders, payments).
- Premature sharding or microservice-per-database.
- Ignoring operational concerns: backups, migrations, managed hosting.

## Follow-ups
- **Does NoSQL mean no transactions?** — Not anymore; MongoDB and DynamoDB support transactions, but they are costlier and narrower than relational ones.
- **Can Postgres replace MongoDB?** — Often yes, with JSONB columns and GIN indexes for document-shaped data.

## Common Mistakes
- Treating the choice as ideological instead of workload-driven.
- Forgetting query patterns when picking a key-value store.
- Using Redis as the only copy of important data.

## Tips
- Say "start with Postgres; add specialised stores for measured needs".

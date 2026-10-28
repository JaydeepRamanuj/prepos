---
title: "Design an in-app notification centre with unread counts and real-time delivery"
level: advanced
type: scenario
tags: [notifications, realtime, unread-count, pagination, optimistic-ui, web-push, preferences]
related: [browser-security/websockets-sse-polling, state/why-tanstack-query, backend/redis-caching]
---

## Question
Design the notification feature of a SaaS app: a bell icon with an unread badge, a dropdown list that updates live, mark read/unread, bulk actions, per-type preferences and optionally web push. Cover data model, API, frontend state, real-time delivery and edge cases.

## Clues
- Unread count and the list are separate pieces of state that must stay consistent.
- Delivery is at-least-once; the UI must tolerate duplicates and gaps.
- Notifications are produced by many parts of the system, so decouple producers from delivery.

## Interview Answer
Backend: producers publish domain events; a notification service decides recipients and channels based on user preferences, writes a `notifications` row per recipient (id, type, payload, `createdAt`, `readAt`, optional `groupKey`) and fans out to channels (in-app, email, web push). The API exposes cursor-paginated `GET /notifications`, a cheap `GET /notifications/unread-count` (backed by an indexed query or a maintained counter), `POST /notifications/read` (ids or "all up to cursor"), and preference endpoints. Frontend: TanStack Query holds the list (infinite query) and the count; an SSE or WebSocket stream pushes new notifications, which are merged into the cache (deduped by id) and bump the count; marking read is optimistic with rollback; the badge and list are derived from one source of truth to prevent drift. On reconnect I refetch the count and the first page to close gaps. I'd batch/group noisy events ("5 people commented"), cap badge display (99+), respect preferences and quiet hours, make the dropdown accessible, and add web push through a service worker for background delivery with explicit user consent.

## Explanation
### Data model
```sql
notifications(
  id uuid primary key,
  user_id uuid not null,
  type text not null,             -- 'comment.mention', 'invoice.paid'
  payload jsonb not null,         -- minimal data + links, not full copies
  group_key text,                 -- optional collapse key
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on notifications (user_id, created_at desc);
create index on notifications (user_id) where read_at is null;      -- fast unread counting
notification_preferences(user_id, type, channel, enabled)
```
Retention: archive or delete old notifications (e.g. 90 days). For big scale, store counters in Redis and reconcile periodically.

### API
| Endpoint | Purpose |
|---|---|
| `GET /notifications?limit=20&cursor=…&unread=true` | keyset pagination by `(created_at, id)` |
| `GET /notifications/unread-count` | tiny, cacheable for a few seconds |
| `POST /notifications/read` `{ids}` or `{upTo}` | idempotent; returns new count |
| `POST /notifications/read-all` | mark everything read |
| `PUT /notification-preferences` | per type and channel |
| `GET /notifications/stream` (SSE) | new items, count updates |

### Frontend state
```tsx
const list = useInfiniteQuery({ queryKey: ["notifications"], queryFn: fetchPage, getNextPageParam: (p) => p.nextCursor, initialPageParam: null });
const unread = useQuery({ queryKey: ["notifications", "unread"], queryFn: fetchUnreadCount, staleTime: 15_000 });

useEffect(() => {
  const es = new EventSource("/api/notifications/stream");
  es.onmessage = (e) => {
    const n = JSON.parse(e.data) as Notification;
    qc.setQueryData(["notifications"], (old) => prependIfMissing(old, n));      // dedupe by id
    qc.setQueryData(["notifications", "unread"], (c: number = 0) => c + 1);
  };
  es.onerror = () => { /* auto-reconnect; refetch on open to close gaps */ };
  es.onopen = () => { qc.invalidateQueries({ queryKey: ["notifications"] }); };
  return () => es.close();
}, [qc]);

const markRead = useMutation({
  mutationFn: (ids: string[]) => api.post("/notifications/read", { ids }),
  onMutate: async (ids) => { /* snapshot, set readAt locally, decrement count */ },
  onError: (_e, _ids, ctx) => { /* roll back from snapshot */ },
  onSettled: () => qc.invalidateQueries({ queryKey: ["notifications", "unread"] }),
});
```

### UX and accessibility
- Bell is a `button` with `aria-label="Notifications, 3 unread"`; the dropdown is a popover with focus management and Escape to close; list items are links with clear read/unread styling that doesn't rely on colour alone.
- Announce new arrivals politely (`aria-live="polite"` with a throttled summary), not each one.
- Mark as read when the user opens the item (or on view with a short dwell), plus "Mark all as read".
- Group similar events; show relative times with absolute time in a tooltip.
- Empty and error states; "You're all caught up".
- Cap the badge at "99+" and keep it in sync across tabs (`BroadcastChannel` or shared stream).

### Delivery channels
- **In-app**: SSE/WebSocket as above; polling every 30–60 s as fallback.
- **Email**: digest/batching, unsubscribe links, send only if unread after N minutes.
- **Web Push** (Push API + service worker + VAPID): request permission in context after the user shows interest, not on page load; handle subscription expiry; payloads kept small; clicking opens the relevant URL via `notificationclick`. Safari/iOS require an installed web app for push.
- **Preferences**: per type per channel, quiet hours, digest frequency; defaults should be conservative.

### Edge cases
- Duplicate delivery or events arriving before the list loads: dedupe by id.
- Race between "mark read" and a new notification: counts derived by server truth after settle.
- Multi-device: read state is server-side so devices converge.
- Deleted or inaccessible resources: render a graceful fallback; recheck permissions when opening.
- High-volume users: group, cap, or sample; paginate the list.
- Privacy: payloads shouldn't leak sensitive data into push notifications visible on lock screens.

## Follow-ups
- **Counter table vs counting rows?** — With a partial index on unread rows counting is cheap for typical volumes; use a maintained counter when counts become hot or huge.
- **How do you test it?** — Contract tests for the API, a fake SSE server in component tests, Playwright with two tabs to verify sync, and chaos tests with dropped connections.

## Common Mistakes
- Letting the badge and the list drift apart.
- Asking for push permission on first load.
- Pushing every event individually instead of grouping.

## Tips
- Structure the answer as model → API → client cache → delivery → UX/edge cases.

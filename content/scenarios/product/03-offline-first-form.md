---
title: "Make a field-agent form work offline and sync reliably"
level: advanced
type: scenario
tags: [offline, pwa, service-worker, indexeddb, sync, conflict-resolution, idempotency]
related: [browser-security/service-worker-caching-strategies, browser-security/browser-storage-options, backend/transactions-acid]
---

## Question
Field agents fill in inspection forms (with photos) in places with poor or no connectivity. The form must never lose data, and submissions should sync automatically when the network returns. Design the frontend (and what you need from the backend).

## Clues
- `navigator.onLine` is only a hint; real failures happen mid-request.
- Queued writes can be retried or duplicated, so the server must be idempotent.
- Large binary data (photos) needs different storage than small JSON.

## Interview Answer
I'd build it as an offline-first PWA. The app shell and static assets are precached by a service worker so it loads without a network. Every edit is written immediately to local storage in **IndexedDB** (via a small wrapper like `idb`/Dexie), including drafts autosaved on change, and photos stored as Blobs there too. Submissions go into an **outbox queue**: each item has a client-generated UUID (idempotency key), payload, attachment references, status and retry metadata. A sync engine drains the queue when connectivity returns, using Background Sync where supported and falling back to triggers on `online`, app focus and a timer; it retries with exponential backoff, uploads photos separately (chunked or resumable), and marks items synced only after the server confirms. The backend accepts the idempotency key so retries never duplicate, returns authoritative IDs/versions, and defines conflict rules (last-write-wins per field, or versioned merge with user prompts for conflicts). The UI always shows truthful status per record (draft, queued, syncing, synced, failed with retry) and protects against storage eviction by requesting persistent storage and exporting a fallback.

## Explanation
### Architecture
```txt
UI (React) ──write──► IndexedDB: drafts, outbox, photo blobs, cached reference data
     ▲                      │
     │ status               ▼
     └────────── Sync engine (page + service worker)
                    │  POST /inspections  (Idempotency-Key: uuid)
                    │  PUT  /uploads/{id} (resumable)
                    ▼
                  API (idempotent, versioned)
Service worker: precache shell, runtime-cache reference data (stale-while-revalidate)
```

### Local data layer
- IndexedDB stores: `drafts`, `outbox`, `attachments` (Blobs), `refData` (lookup lists the form needs), `meta`.
- **Autosave** on change (debounced ~500 ms) so a crash or accidental close loses at most seconds.
- Keep the form state model serialisable; version the local schema and migrate on upgrade.
- `navigator.storage.persist()` to reduce eviction risk; monitor quota with `navigator.storage.estimate()`; compress images client-side before storing (canvas resize, e.g. long edge 1600 px).

### Outbox pattern
```ts
type OutboxItem = {
  id: string;                    // client UUID = idempotency key
  payload: InspectionDraft;
  attachmentIds: string[];
  status: "queued" | "syncing" | "failed" | "synced";
  attempts: number;
  nextAttemptAt: number;
  error?: string;
};

async function drain() {
  for (const item of await outbox.dueItems()) {
    await outbox.update(item.id, { status: "syncing" });
    try {
      await uploadAttachments(item);                                        // resumable, skip already-uploaded
      await api.post("/inspections", item.payload, { headers: { "Idempotency-Key": item.id } });
      await outbox.update(item.id, { status: "synced" });
    } catch (e) {
      const retryable = isNetworkOrServerError(e);
      await outbox.update(item.id, {
        status: retryable ? "queued" : "failed",
        attempts: item.attempts + 1,
        nextAttemptAt: Date.now() + backoff(item.attempts),
        error: String(e),
      });
    }
  }
}
```
Triggers: `online` event, `visibilitychange` (foreground), app start, periodic timer, and the Background Sync API (`registration.sync.register("drain")`) where available (Chromium; not a baseline everywhere, so don't depend on it).

### Server requirements
- Idempotent create: same `Idempotency-Key` returns the original result.
- Validation errors return 4xx so the client marks the item `failed` and asks the user to fix it, instead of retrying forever.
- **Conflicts** for edits to existing records: use `version`/`ETag`; on mismatch return 409 with the current version. Strategies: last-write-wins for simple fields, field-level merge, or manual resolution UI. CRDTs only when true collaborative editing is needed.
- Resumable uploads (tus, S3 multipart) for photos with poor networks.
- Time: store both device capture time and server receive time; don't trust device clocks for ordering.

### UX
- Clear indicators: offline banner, per-record status, pending count, "last synced".
- Never block the user from saving; "Save" always succeeds locally.
- Show failures with actions (retry, edit, export).
- Reference data (picklists, assignments) pre-fetched and versioned, with a "data last updated" note.
- Authentication: allow working offline with a cached session; refresh tokens on reconnect; handle expiry gracefully by queueing until re-login without discarding data.
- Test with DevTools offline mode, throttling, "lie-fi" (connected but dropping), killing the app mid-sync, and low storage.

### Pitfalls
- Trusting `navigator.onLine`.
- Marking items synced before server confirmation.
- Retrying 4xx errors forever.
- Large base64 strings in `localStorage` (size limits, sync API blocking).
- iOS Safari storage eviction after periods of inactivity for non-installed sites; install to home screen and keep data export as a safeguard.
- Multiple tabs draining the same queue: use Web Locks (`navigator.locks`) or leader election.

## Follow-ups
- **Why generate IDs on the client?** — They give idempotency for retries and let offline records reference each other before the server has seen them.
- **PWA vs native for this?** — Native gives more reliable background sync and storage; PWA is cheaper to deploy. Decide by reliability requirements and device constraints.

## Common Mistakes
- Treating offline as an edge case instead of the default path.
- Duplicate submissions from retries.
- Losing data on storage eviction without warning.

## Tips
- Mention the outbox, idempotency keys and honest per-record status.

---
title: "Web Workers: offloading CPU-heavy work without blocking the UI"
level: hard
type: implement
tags: [web-workers, off-main-thread, postMessage, transferable, comlink, shared-array-buffer]
related: [performance/long-tasks-main-thread, performance/inp-fixes, javascript/event-loop-basics]
---

## Question
A CSV import parses and aggregates 200 MB in JavaScript and freezes the page. Move the work to a Web Worker: show the worker code, the main-thread API with progress and cancellation, and explain data transfer costs (structured clone vs transferables vs `SharedArrayBuffer`), plus limitations.

## Clues
- Workers run in a separate thread with their own event loop and no DOM access.
- Messages are copied with structured clone unless you transfer ownership.
- Terminate workers you no longer need.

## Interview Answer
A Web Worker runs JavaScript on a separate thread, so CPU-heavy tasks (parsing, compression, image processing, search indexing, crypto) don't block rendering or input. The main thread creates the worker, sends messages with `postMessage`, and receives results via `onmessage`; workers can't touch the DOM. Data is copied using the structured clone algorithm, which is expensive for large objects, so I transfer ownership of `ArrayBuffer`s (zero-copy) or use `SharedArrayBuffer` with `Atomics` when I need shared memory (requires cross-origin isolation). For ergonomics I wrap the worker in a promise-based API (Comlink or a small helper) with request ids, progress events and `AbortController` cancellation that terminates or signals the worker. For the CSV, I stream the file to the worker (`file.stream()` or `Blob.slice`) and send back aggregates rather than all rows. Limits: startup cost, no DOM, serialisation overhead, bundler configuration, and debugging complexity, so I only use workers when tasks are long enough to justify it.

## Explanation
### Worker

```js
// csv.worker.js
self.onmessage = async (e) => {
  const { id, file } = e.data;
  try {
    let rows = 0, sum = 0, carry = "";
    const decoder = new TextDecoder();
    const reader = file.stream().getReader();
    let read = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.byteLength;
      const text = carry + decoder.decode(value, { stream: true });
      const lines = text.split("\n");
      carry = lines.pop() ?? "";
      for (const line of lines) {
        rows++;
        sum += Number(line.split(",")[2]) || 0;
      }
      self.postMessage({ id, type: "progress", value: read / file.size });
    }
    self.postMessage({ id, type: "done", result: { rows, sum } });
  } catch (err) {
    self.postMessage({ id, type: "error", message: String(err) });
  }
};
```

### Main thread API

```js
let nextId = 0;

export function parseCsv(file, { onProgress, signal } = {}) {
  const worker = new Worker(new URL("./csv.worker.js", import.meta.url), { type: "module" });
  const id = ++nextId;

  return new Promise((resolve, reject) => {
    const cleanup = () => worker.terminate();

    signal?.addEventListener("abort", () => { cleanup(); reject(signal.reason); }, { once: true });

    worker.onmessage = ({ data }) => {
      if (data.id !== id) return;
      if (data.type === "progress") onProgress?.(data.value);
      else if (data.type === "done") { cleanup(); resolve(data.result); }
      else { cleanup(); reject(new Error(data.message)); }
    };
    worker.onerror = (e) => { cleanup(); reject(e.error ?? new Error(e.message)); };

    worker.postMessage({ id, file });              // File objects are cloneable without copying the data
  });
}
```

`new Worker(new URL(..., import.meta.url))` is understood by Vite, webpack 5, Turbopack/Next.js and others, which bundle the worker separately.

### Data transfer options

| Mechanism | Copy? | Notes |
|---|---|---|
| Structured clone (default `postMessage`) | deep copy | supports many types (Map, Set, Date, typed arrays), not functions/DOM; cost grows with size |
| Transferables (`postMessage(buf, [buf])`) | zero-copy move | `ArrayBuffer`, `MessagePort`, `ImageBitmap`, `OffscreenCanvas`, streams; sender loses access |
| `SharedArrayBuffer` + `Atomics` | shared memory | needs cross-origin isolation (COOP/COEP headers); race conditions are your problem |
| `File`/`Blob` | reference | cheap to send; read in the worker |

```js
const buffer = new Float64Array(1_000_000).buffer;
worker.postMessage({ buffer }, [buffer]);         // transferred; buffer.byteLength is 0 afterwards
```

### Ergonomic wrappers
- **Comlink**: exposes worker functions as async proxies (`const api = Comlink.wrap(worker); await api.parse(file)`).
- **Worker pools** (workerpool, custom) for parallel tasks across cores (`navigator.hardwareConcurrency`).
- **React**: create the worker in an effect or a module singleton; terminate on unmount; `useSyncExternalStore` or state for progress.

### Types of workers
- **Dedicated**: one page, one worker.
- **Shared Workers**: shared among tabs of the same origin (limited support).
- **Service Workers**: network proxy/offline/push, not for CPU work.
- **Worklets**: audio/paint/animation, specialised.
- **OffscreenCanvas** in a worker for rendering off the main thread.

### Limits and pitfalls
- No DOM, `window`, or `localStorage`; has `fetch`, `IndexedDB`, `crypto`, `WebAssembly`, `OffscreenCanvas`.
- Startup cost (~tens of ms, plus parsing the worker script); reuse workers instead of creating one per task.
- Big messages can stall the main thread during clone; prefer transfer or chunking.
- Error handling: `onerror` and `onmessageerror`; unhandled exceptions kill the task but not the page.
- CSP and bundlers: workers need `worker-src` allowance; blob URL workers may be blocked.
- Debugging: DevTools shows workers under Sources → Threads.
- Use `requestIdleCallback` or chunking for tasks too small for a worker; message overhead can exceed the savings for < ~5–10 ms jobs.

### WebAssembly
For compute-heavy numeric work, WebAssembly in a worker can be several times faster than JS for specific workloads (image codecs, parsers).

## Follow-ups
- **Does a worker make INP better?** — Yes if long main-thread tasks were the cause; the worker keeps the thread free for input and rendering.
- **How do you cancel?** — Terminate the worker (cheap but loses state) or send a cancel message the worker checks between chunks (graceful).

## Common Mistakes
- Posting huge objects repeatedly (clone cost).
- Creating a new worker per call.
- Trying to access `document` in a worker.

## Tips
- Mention transferables and the structured clone cost; it's the key trade-off.

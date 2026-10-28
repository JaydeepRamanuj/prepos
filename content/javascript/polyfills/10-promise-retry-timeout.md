---
title: "Implement retry with backoff, a timeout wrapper and a concurrency limiter"
level: advanced
type: implement
tags: [promises, retry, backoff, timeout, concurrency, abort]
related: [javascript/promise-all-polyfill, javascript/abort-controller-cancellation, javascript/promise-combinators]
---

## Question
Implement three utilities:

1. `retry(fn, { retries, delay })`: call an async `fn`, retrying on failure with exponential backoff.
2. `withTimeout(promise, ms)`: reject if the promise does not settle in time.
3. `pLimit(concurrency)`: return a function that runs async tasks with at most `concurrency` running at once.

```js
await retry(() => fetchJson("/api"), { retries: 3, delay: 200 });
const limit = pLimit(2);
await Promise.all(urls.map((u) => limit(() => fetch(u))));
```

## Clues
- Use `await` in a loop for retry, and `setTimeout` wrapped in a promise for delay.
- A timeout is a race between the promise and a rejecting timer; remember to clear the timer.
- A limiter needs a queue and a counter of active tasks; when a task finishes, start the next.

## Interview Answer
For retry, I loop up to `retries + 1` attempts, await the function, and on failure wait `delay * 2 ** attempt` (ideally with jitter) before trying again, rethrowing the last error when attempts run out. For timeouts I `Promise.race` the promise against a timer that rejects, and clear the timer in `finally` so it does not keep running; to actually stop the work I pass an `AbortSignal`. For the limiter I keep a queue of pending tasks and a counter of active ones; calling the limiter returns a promise, enqueues the task, and starts as many as capacity allows; whenever a task settles I decrement the counter and start the next in the queue.

## Explanation
### `retry`

```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn, { retries = 3, delay = 200, factor = 2, shouldRetry = () => true } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);                      // await so rejections are caught here
    } catch (err) {
      lastError = err;
      if (attempt === retries || !shouldRetry(err)) break;
      const backoff = delay * factor ** attempt;
      const jitter = Math.random() * backoff * 0.2;  // avoid thundering herd
      await sleep(backoff + jitter);
    }
  }
  throw lastError;
}
```

`return await` matters: without `await`, a rejection would bypass the `catch`. Only retry transient failures (network errors, 5xx, 429), not 4xx validation errors; that is what `shouldRetry` is for. Retry only idempotent operations.

### `withTimeout`

```js
function withTimeout(promise, ms, message = "Timed out") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```

This stops waiting but does not cancel the work. To cancel, use `AbortSignal.timeout(ms)` with APIs that accept a signal.

### `pLimit`

```js
function pLimit(concurrency) {
  const queue = [];
  let active = 0;

  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    const { task, resolve, reject } = queue.shift();
    active++;
    Promise.resolve()
      .then(task)                                    // task may throw synchronously
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();                                      // pull the next waiting task
      });
  };

  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      next();
    });
}
```

Usage with 100 URLs and `pLimit(5)` keeps at most five requests in flight while `Promise.all` still returns results in input order.

### Combining them

```js
const limit = pLimit(4);
const results = await Promise.allSettled(
  ids.map((id) =>
    limit(() => retry(() => withTimeout(fetchUser(id), 3000), { retries: 2 }))
  )
);
```

### Edge cases
- Cap the maximum backoff (`Math.min(backoff, 10_000)`).
- Respect `Retry-After` headers.
- Cancel pending retries when the caller aborts: check `signal.aborted` before each attempt.
- Limiter with priority or with `clearQueue`.

### Complexity
Retry: O(attempts). Limiter: O(1) per enqueue and dequeue (use an index or linked queue for large queues, since `shift` is O(n) on arrays in worst case).

## Follow-ups
- **Why jitter?** — So many clients that failed together do not retry at the same instant.
- **How does TanStack Query handle retries?** — Default 3 retries with exponential backoff, configurable per query.

## Common Mistakes
- Using `return fn()` without `await` inside the `try`.
- Forgetting to clear the timeout timer.
- Retrying non-idempotent or non-transient errors.

## Tips
- Name idempotency and jitter; those two points separate strong answers.

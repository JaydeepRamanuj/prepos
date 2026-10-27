---
title: "How do you handle errors and shut down a Node.js server gracefully?"
level: advanced
type: implement
tags: [node, error-handling, graceful-shutdown, signals, unhandledRejection]
related: [backend/node-event-loop, backend/streams-backpressure, backend/transactions-acid]
---

## Question
How should errors be handled in a Node.js HTTP service: operational errors vs programmer errors, async errors, `uncaughtException` and `unhandledRejection`? Then implement a graceful shutdown: when the process receives `SIGTERM` (for example during a deploy in Kubernetes or Docker), it should stop taking new requests, finish in-flight ones, close the database pool and exit.

## Clues
- Separate errors you expect and can handle (bad input, a DB timeout) from bugs (`undefined is not a function`). After a bug, can you trust the process state?
- Since Node 15, an unhandled promise rejection crashes the process by default. What should the global handlers do: recover, or log and exit?
- `server.close()` stops new connections but waits for existing ones, and keep-alive sockets can hold it open forever. You need a timeout.

## Interview Answer
I separate operational errors, which are expected failures like invalid input, a 404, or a downstream timeout, from programmer errors, which are bugs. Operational errors I handle where they happen: validate input, map known errors to the right status code, retry or degrade where that makes sense, and send everything else through one central error handler that logs with context and returns a generic 500 without leaking stack traces. For async code I make sure every promise is awaited or has a `.catch`. `uncaughtException` and `unhandledRejection` are last-resort handlers: log the error, then shut down, because after an unknown bug the process state can't be trusted, and the orchestrator restarts it. For graceful shutdown, on `SIGTERM` I mark the app as not ready so the load balancer stops sending traffic, call `server.close()` so in-flight requests can finish, then close the DB pool and other resources and exit with code 0. A hard timeout forces `exit(1)` if something hangs.

## Explanation
### Two kinds of errors

| | Operational | Programmer (bug) |
|---|---|---|
| Examples | invalid input, 404, DB timeout, ECONNRESET | `TypeError`, reading undefined, wrong argument |
| Expected? | yes | no |
| Handling | handle locally: 4xx, retry, fallback | fix the code; at runtime log and restart |

### Async errors: the main source of crashes
```js
// BAD: nobody catches the rejection → unhandledRejection → crash (Node ≥ 15)
app.get("/user/:id", (req, res) => {
  db.getUser(req.params.id).then((u) => res.json(u));
});

// GOOD
app.get("/user/:id", async (req, res, next) => {
  try {
    const user = await db.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (err) {
    next(err); // central error handler
  }
});
```
(Express 5 forwards rejected promises from async handlers to `next` automatically; Express 4 doesn't.)

A central handler keeps responses consistent:
```js
class AppError extends Error {
  constructor(message, status = 500, code = "INTERNAL") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

app.use((err, req, res, _next) => {
  const status = err instanceof AppError ? err.status : 500;
  logger.error({ err, path: req.path, requestId: req.id }); // full detail in logs
  res.status(status).json({
    error: status === 500 ? "Internal server error" : err.message, // no stack traces to clients
  });
});
```

### Graceful shutdown
```js
import http from "node:http";
import { app } from "./app.js";
import { pool } from "./db.js"; // e.g. a pg Pool

const server = http.createServer(app);
server.listen(3000);

let shuttingDown = false;
app.get("/healthz", (_req, res) => res.status(shuttingDown ? 503 : 200).end());

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return; // ignore a second signal
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  // Safety net: never hang forever. unref() so the timer itself doesn't keep the process alive.
  setTimeout(() => {
    console.error("forced exit after timeout");
    process.exit(1);
  }, 10_000).unref();

  try {
    // 1. Stop accepting new connections; resolves once in-flight requests finish.
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    server.closeIdleConnections(); // close idle keep-alive sockets holding the server open

    // 2. Release resources after the last request is done.
    await pool.end();

    process.exit(exitCode);
  } catch (err) {
    console.error("error during shutdown", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM")); // docker stop, Kubernetes, most PaaS
process.on("SIGINT", () => shutdown("SIGINT"));   // Ctrl+C locally

// Last-resort handlers: log, then exit. Don't keep running in an unknown state.
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection", reason);
  shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err);
  shutdown("uncaughtException", 1);
});
```

Order of operations and why:
1. **Readiness fails** (`/healthz` → 503), so the load balancer stops routing new traffic here.
2. **`server.close()`** stops accepting connections and waits for active requests to finish.
3. **Close idle keep-alive connections**, otherwise `close()` can wait for idle sockets until they time out.
4. **Close resources** (DB pool, Redis, message consumers) *after* requests finish, since requests still need them.
5. **Hard timeout**, because some request or socket will eventually hang.

The orchestrator also has a grace period (Docker's default `docker stop` timeout is 10 s; Kubernetes' default `terminationGracePeriodSeconds` is 30 s) before it sends `SIGKILL`, which can't be caught. Keep your timeout shorter than that.

### Gotchas
- If you start Node via `npm start` in a container, the signal may go to npm rather than your process. Run `node server.js` directly (or use an init like `tini`) so the signal reaches Node.
- `process.exit()` right after `console.log` on some pipes can drop logs; structured loggers usually provide a flush.

## Follow-ups
- **Why not just keep running after `uncaughtException`?** — The exception may have left half-finished state (open transactions, locks, corrupted in-memory data); restarting a clean process is safer than guessing.
- **What about long-lived connections like WebSockets or SSE?** — Track them, send a close/reconnect message on shutdown, and close them yourself; `server.close()` won't end them.
- **How does this apply on serverless (e.g. Vercel functions)?** — The platform manages the lifecycle, so there's no `SIGTERM` handler to write; focus on per-request error handling and not leaving work running after the response.

## Common Mistakes
- Catching `uncaughtException` and continuing as if nothing happened.
- Closing the DB pool before in-flight requests finish, which turns a clean deploy into a burst of 500s.
- No hard timeout, so a single stuck socket stops the pod from ever terminating.
- Leaking stack traces and internal messages in 500 responses.

## Tips
- Summarise shutdown as **stop accepting → finish in-flight → close resources → exit, with a timeout**.
- Mentioning readiness probes and `SIGKILL` after the grace period shows you've thought about real deploys, not just local Ctrl+C.

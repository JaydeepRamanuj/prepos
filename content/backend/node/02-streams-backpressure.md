---
title: "What are Node.js streams, and what is backpressure?"
level: hard
type: concept
tags: [node, streams, backpressure, pipeline, memory]
related: [backend/node-event-loop, backend/error-handling-graceful-shutdown]
---

## Question
What are streams in Node.js and why would you use them instead of reading a whole file into memory? What is backpressure, and how do you handle it? Write code that serves a large file, gzipped, over HTTP.

## Clues
- Compare memory usage of `fs.readFile` on a 2 GB file with processing it in 64 KB chunks.
- Look at the return value of `writable.write(chunk)`. What does `false` mean, and which event tells you to continue?
- `stream.pipeline` handles backpressure, errors and cleanup for you.

## Interview Answer
A stream processes data in chunks as it arrives instead of buffering it all in memory. That gives you constant memory use and a faster time-to-first-byte, which matters for big files, uploads, CSV exports or proxying. There are four kinds: Readable, Writable, Duplex and Transform. Backpressure is what happens when the consumer is slower than the producer, for example reading from a fast disk and writing to a slow client. `writable.write()` returns `false` when its internal buffer passes `highWaterMark`, and the producer should stop until the `drain` event fires. Otherwise chunks pile up in memory. In practice I don't wire that up by hand: I use `pipeline` from `node:stream/promises`, which pipes the streams together, respects backpressure, and destroys every stream and rejects if any of them fail.

## Explanation
### Why streams
```js
// Buffers the entire file in memory: 2 GB file → ~2 GB of RAM per request
const data = await fs.promises.readFile("big.csv");
res.end(data);
```
With 10 concurrent downloads you'd run out of memory. A stream holds only a few chunks at a time.

| Type | Example |
|---|---|
| Readable | `fs.createReadStream`, `http.IncomingMessage` (req) |
| Writable | `fs.createWriteStream`, `http.ServerResponse` (res) |
| Duplex | TCP socket |
| Transform | `zlib.createGzip()`, a CSV parser |

### Backpressure, manually
```js
import fs from "node:fs";

const src = fs.createReadStream("big.log");
const dest = fs.createWriteStream("copy.log");

src.on("data", (chunk) => {
  const ok = dest.write(chunk); // false → dest's buffer is above highWaterMark
  if (!ok) {
    src.pause();                         // stop producing
    dest.once("drain", () => src.resume()); // continue when the buffer has emptied
  }
});
src.on("end", () => dest.end());
```

`highWaterMark` is a threshold, not a hard limit: `write()` still accepts the chunk, it just tells you to slow down. If you ignore `false`, memory grows without bound. This is the classic slow-client memory leak.

### The right way: `pipeline`
```js
import http from "node:http";
import fs from "node:fs";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";

http
  .createServer(async (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Encoding", "gzip");
    try {
      await pipeline(
        fs.createReadStream("./big.log"), // Readable
        zlib.createGzip(),                // Transform
        res,                              // Writable
      );
    } catch (err) {
      // file missing, client disconnected, gzip error, ...
      // pipeline has already destroyed all three streams
      console.error("stream failed:", err.message);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  })
  .listen(3000);
```

Why `pipeline` beats `.pipe()`:
- `.pipe()` handles backpressure but **not errors**: if the source errors, the destination isn't closed, and you leak file descriptors.
- `pipeline` forwards errors, destroys every stream on failure (including when the client aborts), and gives you one promise to `await`.

### Writing a Transform
```js
import { Transform } from "node:stream";

const upper = new Transform({
  transform(chunk, _encoding, callback) {
    callback(null, chunk.toString().toUpperCase()); // push transformed chunk
  },
});
```

Readable streams are also async iterables, which is often the most readable approach:

```js
for await (const chunk of fs.createReadStream("big.log")) {
  // `for await` pulls a chunk only when the body finishes → natural backpressure
}
```

### Frontend connection
The same idea exists on the web: `fetch` response bodies are Web Streams (`ReadableStream`), and React/Next.js streaming SSR sends HTML in chunks. Node supports Web Streams too, and `Readable.fromWeb` / `Readable.toWeb` convert between the two.

## Follow-ups
- **What's object mode?** — Streams that carry JS objects instead of bytes; `highWaterMark` then counts objects (default 16) instead of bytes.
- **How would you stream a large DB export as CSV?** — A DB cursor as a Readable (or async generator → `Readable.from`), a Transform to CSV rows, piped to `res` with `pipeline`.
- **How do you handle an upload without buffering it?** — Pipe `req` to its destination (disk, S3 multipart upload) and enforce a size limit in a Transform.

## Common Mistakes
- Using `readFile` or `res.json(hugeArray)` for large payloads.
- Ignoring the return value of `write()`, which causes unbounded memory growth with slow consumers.
- Using `.pipe()` chains without error handling, which leaks file descriptors when one stream fails.

## Tips
- One-liner to remember: **`write()` returning `false` means "stop until `drain`"**, and `pipeline` does that for you.
- Mention memory being constant regardless of file size. That's the "why" interviewers look for.

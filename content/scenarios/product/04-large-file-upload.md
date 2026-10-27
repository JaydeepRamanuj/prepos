---
title: "Implement large file uploads with progress, resume and validation"
level: hard
type: scenario
tags: [file-upload, presigned-url, multipart, progress, resumable, validation, security]
related: [backend/rest-api-design, browser-security/cors-preflight, machine-coding/form-wizard]
---

## Question
Users upload videos up to 2 GB from browsers on unreliable networks. Uploads through your Next.js server time out and consume memory. Design a robust upload flow with progress, cancel, resume and security.

## Clues
- Large bytes should not pass through your application server.
- Splitting into parts enables retries and resume.
- Never trust client-side validation or the file extension.

## Interview Answer
I'd upload directly from the browser to object storage (S3, GCS, R2) using **presigned URLs** issued by my backend, so my server only handles small JSON requests. For large files I use multipart/resumable uploads: the client asks the API to start an upload (the server authenticates the user, validates declared type and size limits, and creates the multipart upload), then slices the `File` with `Blob.slice` into parts (e.g. 8–16 MB), gets a presigned URL per part, uploads several parts in parallel with limited concurrency, retries failed parts with backoff, tracks bytes uploaded for a progress bar, and finally calls a "complete" endpoint with the ETags. Progress comes from `XMLHttpRequest.upload.onprogress` (or from completed parts), since `fetch` doesn't expose upload progress in a portable way; cancel uses `AbortController`/`xhr.abort()` plus an abort call to clean up the multipart upload. Resume works by listing already uploaded parts (S3 ListParts) and persisting the upload id so a reload can continue. Security and integrity: server-side validation of content type/size, restricted presigned URL scope and short expiry, unique non-guessable keys, malware scanning and post-upload processing via events, checksum verification, CORS configured on the bucket, and private storage with signed download URLs.

## Explanation
### Flow
```txt
1 POST /api/uploads            {name, size, type}  → {uploadId, key, partSize}
2 POST /api/uploads/:id/parts  {partNumbers:[1..N]} → presigned PUT URLs
3 PUT  <presigned url>  (browser → storage)  part bytes → ETag header
4 POST /api/uploads/:id/complete {parts:[{n, etag}]}
5 Storage event → worker: scan, transcode, thumbnail → mark ready (webhook/poll)
```

### Client sketch
```ts
async function uploadFile(file: File, onProgress: (pct: number) => void, signal: AbortSignal) {
  const { uploadId, partSize } = await api.post("/uploads", { name: file.name, size: file.size, type: file.type });
  const parts = Math.ceil(file.size / partSize);
  const uploaded = new Array<number>(parts).fill(0);
  const etags: { n: number; etag: string }[] = [];

  const queue = Array.from({ length: parts }, (_, i) => i + 1);
  const worker = async () => {
    for (let n = queue.shift(); n; n = queue.shift()) {
      const blob = file.slice((n - 1) * partSize, n * partSize);
      const [{ url }] = await api.post(`/uploads/${uploadId}/parts`, { partNumbers: [n] });
      const etag = await retry(() => putWithProgress(url, blob, signal, (loaded) => {
        uploaded[n - 1] = loaded;
        onProgress(Math.round((uploaded.reduce((a, b) => a + b, 0) / file.size) * 100));
      }));
      etags.push({ n, etag });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));                       // 4 parallel parts
  await api.post(`/uploads/${uploadId}/complete`, { parts: etags.sort((a, b) => a.n - b.n) });
}

function putWithProgress(url: string, blob: Blob, signal: AbortSignal, onLoaded: (n: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onLoaded(e.loaded);
    xhr.onload = () => (xhr.status < 300 ? resolve(xhr.getResponseHeader("ETag")!) : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error("network"));
    signal.addEventListener("abort", () => { xhr.abort(); reject(new DOMException("Aborted", "AbortError")); });
    xhr.send(blob);
  });
}
```
For the browser to read the `ETag` response header, the bucket's CORS config must expose it (`ExposeHeaders: ["ETag"]`).

### Alternatives
| Option | Use when |
|---|---|
| Single presigned PUT | files under ~100 MB, simple |
| S3 multipart (above) | large files, parallelism, resume |
| tus protocol (tusd, Uppy) | standardised resumable uploads, open source clients |
| Provider SDK (Uploadthing, Cloudinary, Mux direct upload, Vercel Blob client uploads) | faster to ship, built-in processing |
| Proxy via server | small files only; subject to serverless body/time limits |

### Validation and security
- **Client**: size and type checks for quick feedback only.
- **Server**: enforce max size (presign with content-length conditions or check on complete), allowlist MIME types, verify magic bytes post-upload, sanitise filenames (store under generated keys; keep the original name as metadata).
- **Isolation**: private bucket, short-lived presigned URLs bound to key/method/content type; separate origin/domain for serving user content to prevent XSS via uploaded HTML/SVG; `Content-Disposition: attachment` where appropriate.
- **Scanning**: antivirus/content moderation in an async pipeline; the file stays `pending` until cleared.
- **Quotas and rate limits** per user; clean up abandoned multipart uploads with lifecycle rules.
- **Integrity**: send a checksum (`Content-MD5` or SHA-256) and verify.
- **Authorisation**: the user may only complete uploads they started.

### UX details
Drag-and-drop plus button (keyboard accessible), previews via `URL.createObjectURL` (revoke afterwards), per-file progress with `role="progressbar"`, pause/resume/cancel, clear error messages, warn before leaving during upload (`beforeunload`), and keep going in the background if possible (service worker-based background fetch for supported browsers). For images, resize/compress client-side before upload.

## Follow-ups
- **How do you resume after a page refresh?** — Persist `uploadId` and file fingerprint in IndexedDB; ask the user to re-select the file, verify the fingerprint, list uploaded parts, and continue.
- **Why not `fetch` with a stream?** — Upload streaming with `fetch` has limited support and no progress callback; XHR remains the practical choice for progress.

## Common Mistakes
- Proxying gigabytes through serverless functions.
- Trusting the file extension or declared type.
- Leaving abandoned multipart uploads accumulating cost.

## Tips
- Say "presigned multipart, parallel parts with retries, server-side validation and async scanning".

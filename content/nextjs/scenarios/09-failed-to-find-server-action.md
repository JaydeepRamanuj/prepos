---
title: "Users get 'Failed to find Server Action' after a deployment"
level: hard
type: debugging
tags: [server-actions, version-skew, deploymentId, encryption-key, rolling-deploy]
related: [nextjs/vercel-vs-self-hosting, nextjs/how-server-actions-work, nextjs/server-actions-are-public-endpoints, nextjs/multi-instance-cache-inconsistency]
---

## Question
After each deploy, a few users see errors like "Failed to find Server Action 'xxxx'. This request might be from an older or newer deployment", and form submissions fail until they reload. A self-hosted app runs several instances with rolling updates. Why does it happen and how do you fix it?

## Clues
- Action ids and the closure-encryption key are generated per build.
- A page loaded before the deploy may call a server that is running a different build.
- Next.js has a deployment identifier that lets it detect this and force a reload.

## Interview Answer
Server Actions are referenced by encrypted ids generated at build time, and closure variables are encrypted with a key that is unique per build by default. During a rolling deployment, a user with a page loaded from build A can submit a form that is routed to an instance running build B (or the reverse), and build B doesn't know that action id or can't decrypt the payload, which causes this error. The same happens between instances if they were built separately and have different keys. The fixes are: build once and run the same artifact on every instance, set a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, configure a `deploymentId` so Next.js detects the mismatch and forces a hard reload on navigation, keep old static assets available during rollout (immutable assets), and where possible use connection draining or version-aware routing at the load balancer. For the user, a graceful message with a reload prompt is better than a raw error.

## Explanation
### Causes

| Cause | Detail |
|---|---|
| Rolling deploy | old page, new server: action ids/keys changed with the build |
| Multi-instance with different builds | each instance built separately → different encryption key |
| Cached page HTML | CDN serves HTML from build A while origin runs build B |
| Long-lived tabs | users keep tabs open for days |
| Stale prefetched payloads | client navigates with old RSC data |
| Missing old assets | JS chunks from the old build 404 |

### Fixes

1. **Same artifact everywhere**: build once in CI, ship the image to all instances.
2. **Stable key**:

```bash
export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(openssl rand -base64 32)"
next build        # embedded in the build output; reuse the same value across builds only if you want ids to stay decryptable across deploys
```

The key must be base64 with a valid AES length (16, 24 or 32 bytes). Keeping it constant across builds helps closure-encrypted actions survive deploys, but action ids themselves still change between builds, so you still need skew handling.

3. **Deployment id**:

```ts
// next.config.ts
export default { deploymentId: process.env.GIT_SHA };
```

Static assets get `?dpl=…`, client navigations send `x-deployment-id`, and on mismatch Next.js does a hard navigation (full reload) instead of a client transition. Component state is lost on that reload, so keep important state in the URL or storage.

4. **Immutable assets**: keep previous deployments' `_next/static` files (CDN bucket or `supportsImmutableAssets`) so old pages can still load chunks.

5. **Routing**: use blue/green or canary releases with connection draining so in-flight users finish on the old version; or version-aware routing keyed by the deployment id.

6. **CDN**: avoid caching HTML longer than the rollout window, or purge on deploy.

### User-facing handling

```tsx
"use client";
const [state, action] = useActionState(async (prev, fd) => {
  try { return await save(prev, fd); }
  catch (e) { return { ok: false, message: "This page is out of date. Reload to continue.", stale: true }; }
}, initial);
{state.stale && <button onClick={() => location.reload()}>Reload</button>}
```

Do not auto-reload while a user is mid-form.

### Verify
Simulate: load page on build A, deploy build B, submit the form. With skew protection in place, the submission should either work or lead to a clean reload flow, not a broken state.

### Platforms
On managed platforms with skew protection (such as Vercel), clients are pinned to the deployment that served them; self-hosting needs the pieces above.

## Follow-ups
- **Are action ids stable across builds?** — No; they're regenerated per build (and cached for a maximum of 14 days in the build cache).
- **Why does an unused Server Action disappear?** — Dead-code elimination removes unreferenced actions from the client bundle, so they have no public id.

## Common Mistakes
- Building separately on each node.
- Forgetting a stable encryption key in multi-instance setups.
- Purging old assets immediately after deploy.

## Tips
- Name three things: same artifact, stable key, deployment id.

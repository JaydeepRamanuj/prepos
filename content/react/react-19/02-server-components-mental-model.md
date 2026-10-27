---
title: "What are React Server Components and what is the mental model?"
level: hard
type: concept
tags: [server-components, rsc, use-client, serialization, bundle-size]
related: [react/use-client-boundary, react/suspense-streaming, nextjs/server-vs-client-components]
---

## Question
Explain React Server Components (RSC): what runs where, how they differ from SSR, what they can and can't do, and how data flows between server and client components.

## Clues
- SSR renders to HTML on the server and then hydrates in the browser. Server Components never hydrate.
- A "use client" file creates a boundary for what ships as JavaScript.
- Props passed from server to client must be serialisable.

## Interview Answer
Server Components render only on the server (at build time or per request) and send the result to the client as a serialized React tree, not as JavaScript. Their code and dependencies, like a markdown parser or an ORM client, never reach the browser, they can be `async` and read from databases or the filesystem directly, and they can't use state, effects or browser APIs. Client Components, marked with `"use client"`, are the interactive parts: they are server-rendered to HTML for the first load too (SSR) and then hydrated. RSC is different from SSR: SSR is about producing HTML for a component tree, while RSC is about which components' code is on the client at all. The boundary rule: Server Components can import Client Components and pass them serialisable props or JSX as children; Client Components can't import Server Components, but can render them if they're passed as `children`.

## Explanation
### Two kinds of components

| | Server Component (default in App Router) | Client Component (`"use client"`) |
|---|---|---|
| Runs | server only | server (SSR) + browser |
| Ships JS | no | yes |
| `useState`, `useEffect`, event handlers | no | yes |
| Browser APIs | no | yes |
| Direct DB / fs / secrets | yes | no |
| `async` component | yes | no |
| Context | can't create or consume (can read via props) | yes |

### Example

```tsx
// app/products/page.tsx — Server Component
import { db } from "@/lib/db";
import AddToCart from "./AddToCart";

export default async function Page() {
  const products = await db.product.findMany();     // no API route needed
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>
          {p.name}
          <AddToCart id={p.id} />                   {/* serialisable prop */}
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// AddToCart.tsx — Client Component
"use client";
import { useState } from "react";
export default function AddToCart({ id }: { id: string }) {
  const [added, setAdded] = useState(false);
  return <button onClick={() => setAdded(true)}>{added ? "Added" : "Add"}</button>;
}
```

### Data flow and the RSC payload
The server renders the tree into the RSC payload: a streamed description containing rendered output of Server Components, placeholders referencing Client Component bundles, and their props. The client React runtime merges it into the tree. Subsequent navigations fetch only a new payload, preserving client state.

```txt
Server: render Server Components -> RSC payload (+ HTML for first load via SSR)
Client: load JS only for Client Components -> hydrate -> navigate by fetching payloads
```

### Rules
- Props from server to client must be serialisable: primitives, plain objects/arrays, Date, Map/Set, promises, JSX; not functions (except Server Actions), class instances, or DOM nodes.
- Composition: pass Server Components to Client Components as `children` or props:

```tsx
<Modal>            {/* Client Component */}
  <ServerStats />  {/* still rendered on the server */}
</Modal>
```

- Put `"use client"` as deep as possible, on the interactive leaf, to keep the bundle small.
- Third-party libraries using hooks need a thin `"use client"` wrapper.
- Shared modules can be imported from either side; `server-only` / `client-only` packages guard misuse.

### Why use RSC
Smaller bundles, data fetching next to the component without waterfalls from the browser, secrets never exposed, streaming with Suspense. Cost: a new mental model, more constraints, and a framework/bundler requirement (Next.js App Router, React Router, Waku, etc.).

### Common confusions
- "Client Components run only in the browser": they are also pre-rendered on the server.
- "Server Components replace SSR": they complement it.
- "`async` Server Components can't re-render": they re-run on navigation or refresh, not on client state change.

## Follow-ups
- **How do Server Components update?** — By refetching the payload (navigation, `router.refresh()`, Server Action revalidation).
- **Can a Client Component fetch data?** — Yes, using `use()` with a promise from a server parent, or a query library.

## Common Mistakes
- Marking everything `"use client"`.
- Passing functions/class instances from server to client.
- Importing a Server Component into a Client file.

## Tips
- Contrast "where code runs" with "where HTML is produced".

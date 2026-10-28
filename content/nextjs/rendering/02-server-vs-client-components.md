---
title: "Server vs Client Components in Next.js: how do you decide where to put 'use client'?"
level: medium
type: concept
tags: [server-components, client-components, use-client, composition, bundle-size]
related: [react/server-components-mental-model, react/use-client-boundary, nextjs/server-client-composition-patterns, nextjs/data-access-layer]
---

## Question
In the App Router, when should a component be a Server Component and when a Client Component? How do you decide where to put the `"use client"` directive and what is the effect of the boundary on the bundle?

## Interview Answer
Components are Server Components by default in the App Router. I keep them on the server when they fetch data, read secrets or use heavy dependencies, because none of their code ships to the browser and they can be `async`. I add `"use client"` only to components that need state, effects, event handlers, browser APIs or hooks like `useRouter`. The directive marks a boundary: that file and everything it imports becomes part of the client bundle. So I push it as far down the tree as possible, to the interactive leaf (the like button, not the whole post page), and pass server-rendered content into client components as `children` or props. Props crossing the boundary must be serialisable, and server-only code must never be imported from client files.

## Explanation
### Decision table

| Need | Server | Client |
|---|---|---|
| Fetch data, DB access, secrets | ✅ | ❌ |
| Large libraries only used for rendering (markdown, syntax highlight) | ✅ (no JS shipped) | ❌ |
| `useState`, `useEffect`, `useRef` | ❌ | ✅ |
| `onClick`, `onChange` | ❌ | ✅ |
| `window`, `localStorage`, geolocation | ❌ | ✅ |
| Context providers / consumers | ❌ (provider must be a client component) | ✅ |
| `async` component | ✅ | ❌ |

### Boundary effect

```tsx
// app/post/[id]/page.tsx — Server Component
export default async function Post({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);            // DB call stays on the server
  return (
    <article>
      <h1>{post.title}</h1>
      <Markdown source={post.body} />         {/* heavy lib: not in the client bundle */}
      <LikeButton postId={post.id} initial={post.likes} />   {/* tiny client leaf */}
    </article>
  );
}
```

```tsx
// like-button.tsx
"use client";
import { useState } from "react";

export function LikeButton({ postId, initial }: { postId: string; initial: number }) {
  const [likes, setLikes] = useState(initial);
  return <button onClick={() => setLikes(likes + 1)}>♥ {likes}</button>;
}
```

If `"use client"` were placed on the page, the entire post tree, including the markdown renderer, would move to the client bundle.

### What crosses the boundary
Server → client props must be serialisable: primitives, plain objects/arrays, `Date`, `Map`/`Set`, promises, JSX, and Server Actions. Not functions (other than Server Actions), class instances or DOM nodes.

### Both environments
- Client Components are also rendered to HTML on the server for the first load, then hydrated.
- Modules without a directive that are imported from a Client Component are included in the client graph too.
- `import "server-only"` makes accidental client import a build error; `import "client-only"` does the inverse.

### Practical guidelines
1. Start on the server, and add `"use client"` when the compiler or you need an interactive feature.
2. Split components: static shell on the server, interactive pieces as leaves.
3. Pass data down as props instead of fetching again in the client.
4. Wrap third-party client-only components in your own `"use client"` file (see the composition patterns question).
5. Keep context providers near the root as thin client wrappers that accept `children`.
6. Use `NEXT_PUBLIC_` env vars only for values safe to expose.

## Follow-ups
- **Does `"use client"` make everything inside client-only?** — Everything it imports does, but `children` passed from a Server Component stays server-rendered.
- **Can a Client Component be async?** — No.

## Common Mistakes
- Adding `"use client"` to layouts or pages "to fix an error".
- Passing non-serialisable props.
- Importing database code in a client file.

## Tips
- Use the "interactive leaf" phrase and give a concrete component.

---
title: "Composition patterns across the server/client boundary: providers, children, and third-party components"
level: hard
type: design
tags: [composition, context, providers, children, third-party, use-client]
related: [nextjs/server-vs-client-components, react/children-slots, react/use-context-rerenders, nextjs/code-splitting-lazy]
---

## Question
You need a theme provider, a client-only chart library and a cart drawer that shows server-fetched product data. How do you structure these in the App Router so most of the tree stays on the server?

## Clues
- A Client Component can render Server Components passed to it as `children` or props.
- Context providers must be Client Components.
- Third-party components that use hooks need a `"use client"` wrapper if the library hasn't marked them.

## Interview Answer
I make thin client wrappers that accept `children`. A `ThemeProvider` marked `"use client"` renders `<Context value>` around `{children}` in the root layout; because `children` is created by the Server Component layout, those pages stay server-rendered even though they sit inside a client provider. For a third-party library that uses state or browser APIs but isn't marked `"use client"`, I create one re-export file with the directive and import that wrapper, and for components that touch `window` I lazy-load them with `next/dynamic` and `ssr: false` inside a Client Component. For the cart drawer, I keep the interactive shell (open/close state) as a client component and pass the server-fetched content as a slot prop or `children`, so the product data fetching and markup are not shipped as JavaScript. I always check that I'm not importing a Server Component directly into a client file, which would silently turn it into a client component.

## Explanation
### 1. Providers

```tsx
// components/theme-provider.tsx
"use client";
import { createContext, useState, type ReactNode } from "react";

export const ThemeContext = createContext<"light" | "dark">("light");

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useState<"light" | "dark">("light");
  return <ThemeContext value={theme}>{children}</ThemeContext>;
}
```

```tsx
// app/layout.tsx — Server Component
import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>   {/* children stay Server Components */}
      </body>
    </html>
  );
}
```

Render providers as deep as is practical so that Next.js can optimise the static parts, and keep each provider small.

### 2. Third-party components

```tsx
// components/chart.tsx
"use client";
export { LineChart } from "some-chart-lib";        // library uses hooks internally
```

Now `import { LineChart } from "@/components/chart"` works in Server Components, which can render it with serialisable props.

If a library touches `window` during import, it fails on the server; lazy-load it on the client:

```tsx
"use client";
import dynamic from "next/dynamic";
const Map = dynamic(() => import("./map-impl"), { ssr: false, loading: () => <p>Loading map…</p> });
```

`ssr: false` must be used from a Client Component.

### 3. Slots for server content inside client shells

```tsx
// cart-drawer.tsx
"use client";
import { useState, type ReactNode } from "react";

export function CartDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Cart</button>
      {open && <aside>{children}</aside>}
    </>
  );
}
```

```tsx
// app/layout.tsx (or a server component)
<CartDrawer>
  <CartItems />            {/* async Server Component: fetches the cart on the server */}
</CartDrawer>
```

Note that `{children}` is rendered on the server whether or not the drawer is open (the payload contains it); gate heavy content with `Suspense` or a route if that matters.

### 4. Passing data

Pass props that are serialisable; pass Server Actions for mutations; if the client needs a server-started promise, pass it as a prop and read it with `use()`.

### 5. Guardrails
- `import "server-only"` in data-access modules.
- Avoid importing a Server Component from a `"use client"` file: it becomes part of the client bundle and loses server abilities.
- Keep `"use client"` files small and focused.
- Prefer context for UI-level state (theme, toasts), and URL or server data for everything else.

### Outcome

```txt
RootLayout (server)
 └ ThemeProvider (client) ── children ──> pages (server) ── interactive leaves (client)
```

Only the provider, the drawer shell and leaf widgets ship JavaScript.

## Follow-ups
- **Can a Server Component consume context?** — No; context is for Client Components. Pass values as props instead.
- **What about `React.cache`?** — It dedupes work per request on the server, not across the boundary.

## Common Mistakes
- Marking the root layout `"use client"`.
- Importing server components inside client files.
- Forgetting `ssr: false` must live in a client file.

## Tips
- Say "slots, not imports" for server content inside client shells.

# Content plan

Target total: **443** questions. Level mix per track ≈ 15% easy, 35% medium, 30% hard, 20% advanced (behavioural is the exception).

## JavaScript (`javascript`) — target 75

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `fundamentals` | Fundamentals | 8 | Types, coercion, equality, hoisting, TDZ and var/let/const. |
| `scope-closures` | Scope & Closures | 7 | Lexical scope, closures, IIFEs, module pattern and closure pitfalls. |
| `this-prototypes` | this, Prototypes & Classes | 9 | How this is bound, call/apply/bind, the prototype chain and classes. |
| `async` | Async & the Event Loop | 12 | Event loop, micro/macrotasks, promises, async/await, error handling, cancellation. |
| `objects-arrays` | Objects, Arrays & Collections | 8 | Copying, immutability, iteration, Map/Set/WeakMap, destructuring and spread. |
| `functions` | Functions & Functional Patterns | 6 | Higher-order functions, currying, composition, memoization, purity. |
| `output-prediction` | Predict the Output | 10 | Tricky snippets that test real understanding of the runtime. |
| `polyfills` | Polyfills & Implementations | 10 | Write bind, map, reduce, Promise.all, debounce, throttle, deep clone and more from memory. |
| `modern-js` | Modern JavaScript | 5 | ES modules, Proxy/Reflect, iterators, symbols and recent language additions. |

## React (`react`) — target 75

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `fundamentals` | Fundamentals | 8 | JSX, components, props vs state, rendering, reconciliation and keys. |
| `hooks-core` | Core Hooks | 12 | useState, useEffect, useRef, useLayoutEffect, dependencies, cleanup and stale closures. |
| `hooks-advanced` | Advanced Hooks | 10 | useReducer, useContext, useMemo, useCallback, useId, useSyncExternalStore, useTransition, useDeferredValue and more. |
| `custom-hooks` | Custom Hooks | 7 | Design and write custom hooks from scratch. |
| `rendering-performance` | Rendering & Performance | 9 | Why components re-render, memoization, React Compiler, context performance, lists and profiling. |
| `patterns` | Component Patterns | 9 | Composition, compound components, render props, HOCs, controlled vs uncontrolled, portals, error boundaries, refs. |
| `react-19` | React 19 & Server Components | 10 | RSC mental model, server vs client, Actions, useActionState, useOptimistic, use(), Suspense and streaming. |
| `data-forms` | Data Fetching & Forms | 5 | Fetching patterns, race conditions, abort, forms and controlled inputs. |
| `debug-output` | What Renders? Debug These | 5 | Snippets: infinite loops, stale state, wrong keys, effect bugs. |

## Next.js (`nextjs`) — target 72

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `routing` | Routing & Layouts | 10 | App Router files, layouts vs templates, route groups, dynamic, parallel and intercepting routes, loading/error/not-found. |
| `rendering` | Rendering Strategies | 10 | SSR, SSG, ISR, CSR, Server vs Client Components, hydration and streaming. |
| `caching` | Caching & Revalidation | 10 | Cache Components, use cache, cacheLife/cacheTag, revalidation, and how caching changed across versions. |
| `data-mutations` | Data Fetching & Mutations | 9 | Fetching in Server Components, Server Actions, forms, Route Handlers, revalidatePath/revalidateTag. |
| `proxy-auth` | Proxy, Auth & Security | 7 | proxy.ts (formerly middleware), cookies/headers, authentication patterns, data access layer, securing Server Actions. |
| `optimization` | Optimization & SEO | 9 | next/image, next/font, scripts, bundles, lazy loading, metadata, prefetching and partial prerendering. |
| `deployment` | Config, Runtime & Deployment | 7 | Env vars, Node vs Edge runtime, Turbopack, next.config, Vercel vs self-hosting. |
| `scenarios` | Real-world Scenarios | 10 | Hydration mismatches, stale data after mutation, slow pages, Pages-to-App migration and more. |

## TypeScript (`typescript`) — target 20

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `basics` | Type System Basics | 5 | Types vs interfaces, unions, narrowing, any/unknown/never, type guards. |
| `generics` | Generics | 5 | Generic functions, constraints, defaults and real-world generic utilities. |
| `advanced-types` | Advanced Types | 6 | Utility types, mapped, conditional, infer, template literal types, satisfies. |
| `ts-react` | TypeScript with React | 4 | Typing props, events, refs, hooks, polymorphic and generic components. |

## HTML, CSS & Accessibility (`html-css`) — target 20

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `semantics-a11y` | Semantics & Accessibility | 6 | Semantic elements, ARIA, focus management, keyboard support, forms. |
| `layout` | Layout | 6 | Box model, flexbox, grid, positioning, stacking contexts and z-index. |
| `modern-css` | Cascade & Modern CSS | 5 | Specificity, cascade layers, container queries, :has(), units, responsive design. |
| `tailwind` | Tailwind CSS | 3 | Utility-first trade-offs, Tailwind v4, theming and class merging. |

## State Management & Libraries (`state`) — target 20

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `fundamentals` | State Fundamentals | 4 | Server vs client state, URL state, local vs global, choosing a tool. |
| `zustand` | Zustand | 6 | Stores, selectors, re-render control, middleware, persistence, slices. |
| `tanstack-query` | TanStack Query | 6 | Query keys, caching, staleTime vs gcTime, mutations, invalidation, optimistic updates. |
| `forms` | Forms & Validation | 4 | React Hook Form, Zod schemas, server validation and sharing schemas. |

## Performance & Optimization (`performance`) — target 18

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `web-vitals` | Core Web Vitals | 6 | LCP, INP, CLS, how they are measured, field vs lab data, fixing each. |
| `loading` | Loading Performance | 6 | Code splitting, bundle analysis, images, fonts, caching, critical rendering path. |
| `runtime` | Runtime Performance | 6 | Long tasks, layout thrashing, memory leaks, virtualization, web workers. |

## Debugging (`debugging`) — target 12

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `tools` | Tools & Method | 4 | DevTools panels, React DevTools, network and performance profiling, a debugging method. |
| `common-bugs` | Classic Bugs | 8 | Race conditions, stale closures, memory leaks, CORS errors, hydration errors and more. |

## Scenario-based (`scenarios`) — target 18

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `product` | Product & Feature Scenarios | 9 | Building features under real constraints. |
| `production` | Production & Team Scenarios | 9 | Incidents, slow apps, legacy code, conflicting requirements. |

## Frontend Architecture (`architecture`) — target 18

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `structure` | Project Structure | 5 | Folder structures, feature-based vs layer-based, colocation, module boundaries. |
| `patterns` | Architectural Patterns | 5 | Feature-sliced design, monorepos, micro-frontends, rendering architecture choices. |
| `design-systems` | Design Systems | 5 | Tokens, component APIs, theming, documentation and versioning. |
| `data-layer` | API & Data Layer | 3 | API clients, error handling, typing API responses, caching strategy. |

## Machine Coding (`machine-coding`) — target 20

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `components` | UI Components | 10 | Modal, tabs, accordion, star rating, OTP input, toast, carousel and more. |
| `features` | Features & Mini Apps | 10 | Autocomplete, infinite scroll, data table, file tree, nested comments, form wizard and more. |

## Browser, Network & Security (`browser-security`) — target 16

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `browser` | Browser Internals | 6 | Rendering pipeline, events, storage options, service workers. |
| `networking` | Networking & HTTP | 5 | HTTP caching, CORS, HTTP/2 and HTTP/3, REST vs GraphQL, WebSockets/SSE. |
| `security` | Frontend Security | 5 | XSS, CSRF, CSP, cookie flags, token storage, supply chain. |

## Testing (`testing`) — target 10

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `testing` | Testing Frontend Apps | 10 | Test pyramid/trophy, unit vs integration vs E2E, Testing Library, mocking, Playwright. |

## Backend for Frontend Devs (`backend`) — target 14

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `node` | Node.js | 4 | Event loop in Node, streams, modules, error handling. |
| `api-auth` | APIs & Auth | 5 | REST design, status codes, JWT vs sessions, OAuth/OIDC, rate limiting. |
| `databases` | Databases & Caching | 5 | SQL vs NoSQL, indexes, N+1, transactions, Redis caching. |

## AI-assisted Engineering (`ai-engineering`) — target 20

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `workflows` | Working with AI | 5 | Planning vs executing, prompting for code, iterating, when not to use AI. |
| `context` | Context Files, Rules & Skills | 5 | AGENTS.md / CLAUDE.md, rules, skills, context management. |
| `agents` | Agents, Hooks & Guardrails | 5 | Subagents, hooks, handoff, permissions, MCP, guardrails. |
| `quality` | Quality & Safety | 5 | Deterministic tools as guardrails, reviewing AI code, security, measuring output. |

## Behavioural (`behavioural`) — target 15

| Chapter folder | Title | Target | Scope |
|---|---|---|---|
| `about-you` | About You & Motivation | 5 | Introduce yourself, why switch, why us, career goals. |
| `teamwork` | Teamwork & Conflict | 5 | Disagreements, feedback, mentoring, collaboration. |
| `ownership` | Ownership & Growth | 5 | Failures, pressure, ownership, learning fast. |

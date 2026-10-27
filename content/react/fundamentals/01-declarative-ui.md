---
title: "What is React, and what does \"declarative UI\" actually mean?"
level: easy
type: concept
tags: [fundamentals, declarative, components]
related: [react/jsx-compiles-to, react/render-and-commit, react/props-vs-state]
---

## Question
What is React? Explain what people mean when they say React is *declarative*, and contrast it with the imperative way of updating the DOM.

## Interview Answer
React is a JavaScript library for building user interfaces out of components — functions that take inputs (props and state) and return a description of what the UI should look like. It is declarative because I describe *what* the screen should be for a given state, not *how* to get there step by step: `UI = f(state)`. When state changes, React re-runs my component, compares the new description with the previous one and applies the minimal DOM changes itself. In imperative code I would find nodes, toggle classes, append children and keep every piece in sync by hand, which gets error-prone as the number of states grows. React is "just" the view layer, so for routing, data fetching and server rendering I'd normally use a framework like Next.js on top of it.

## Explanation
### Imperative vs declarative
Imagine a "like" button that shows a count and turns blue when liked.

```js
// Imperative: you describe every transition
button.addEventListener("click", () => {
  liked = !liked;
  count += liked ? 1 : -1;
  button.classList.toggle("blue", liked);
  label.textContent = String(count);
});
```

Each new feature (loading state, error state, disabled state) multiplies the transitions you must handle, and forgetting one leaves the DOM out of sync with your data.

```tsx
// Declarative: you describe each state; React handles transitions
function LikeButton() {
  const [liked, setLiked] = useState(false);
  const count = liked ? 1 : 0;
  return (
    <button className={liked ? "blue" : ""} onClick={() => setLiked(!liked)}>
      {count}
    </button>
  );
}
```

You only answer "given this state, what should the UI look like?". React computes the difference and updates the DOM.

### The mental model
```txt
state/props ──▶ component() ──▶ React elements ──▶ diff with last ──▶ DOM updates
     ▲                                                                  │
     └────────────── event handler calls setState ◀─────────────────────┘
```

Three ideas carry the whole library:
- **Components** — reusable functions that return UI.
- **State drives UI** — you never touch the DOM directly to reflect data; you change state.
- **Reconciliation** — React figures out the minimal set of DOM operations.

### Library vs framework
React itself does not ship routing, data fetching conventions or a build setup. The React team sunset Create React App in 2025 and recommends starting with a framework (Next.js, React Router, Expo) or a build tool like Vite.

## Follow-ups
- **Is React fast because of the virtual DOM?** — Not inherently; diffing has a cost. The win is that React batches and minimises DOM writes so you don't have to, and the declarative model makes code predictable.
- **Can you still do imperative things?** — Yes, through refs and effects (focus an input, measure an element, integrate a non-React widget). They are escape hatches.

## Common Mistakes
- Saying "React is a framework" without nuance, or "the virtual DOM makes it faster than vanilla JS".
- Describing declarative as "uses JSX" — JSX is just syntax; the key is describing state, not transitions.

## Tips
- Say `UI = f(state)` early; it frames everything else (re-renders, purity, effects) you'll be asked about.

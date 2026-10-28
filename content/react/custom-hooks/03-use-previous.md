---
title: "Write usePrevious and explain why it works"
level: medium
type: implement
tags: [custom-hooks, useRef, useEffect, previous-value]
related: [react/use-ref-dom-vs-mutable, react/state-vs-ref-vs-variable, react/render-and-commit]
---

## Question
Write `usePrevious(value)` that returns the value from the previous render. Explain why the ref update must happen in an effect, and what it returns on the first render.

```tsx
const prev = usePrevious(count);
// count 0 -> prev undefined, count 1 -> prev 0, count 2 -> prev 1
```

## Interview Answer
I store the value in a ref and update it in an effect after each render. During render I return `ref.current`, which still holds the value from the previous commit, because effects run after the render finishes. The first render returns `undefined`. The update has to happen in an effect (not during render) so that render stays pure and the ref only changes after the UI has committed; that ordering is what makes "return current, then overwrite" work. The hook doesn't trigger a re-render by itself; it simply reflects whatever the last render saw. Alternatively, track the previous value with state, which is the pattern React docs show for "adjusting state during render".

## Explanation
### Implementation

```tsx
import { useEffect, useRef } from "react";

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;      // runs after the render has been committed
  }, [value]);

  return ref.current;         // value from the previous committed render
}
```

### Timeline

```txt
render 1: value = 0 -> returns undefined -> effect sets ref = 0
render 2: value = 1 -> returns 0         -> effect sets ref = 1
render 3: value = 2 -> returns 1         -> effect sets ref = 2
```

### Gotchas
- **Unrelated re-renders:** the hook returns the value from the previous *render*, not the previous *distinct* value. If the component re-renders for another reason while `value` is unchanged, the next call returns the same value as `value` itself. If you need the last different value, track it explicitly (see the state-based version below) or compare inside the effect.
- **StrictMode:** effects run twice in development on mount; harmless here.
- **Concurrent rendering:** reading refs during render is discouraged by the React docs because renders may be discarded. For anything critical, use state:

```tsx
function usePreviousState<T>(value: T) {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState<T | undefined>(undefined);
  if (value !== current) {         // updating state during render is allowed for this pattern
    setPrevious(current);
    setCurrent(value);
  }
  return previous;
}
```

### Use cases
- Show an up/down arrow when a number changes.
- Run an animation only when a prop changes direction.
- Debug "why did this render" by logging changes.
- Compare old and new values inside an effect (but prefer including values in dependencies).

### TypeScript
Typing the ref as `T | undefined` reflects the first render having no previous value.

## Follow-ups
- **Why not use `useState` for it?** — Setting state in an effect would add an extra re-render each time.
- **Can the React Compiler break it?** — Refs read during render are flagged by the compiler's rules; the state-based version is compiler-friendly.

## Common Mistakes
- Updating `ref.current = value` during render.
- Expecting it to cause a re-render.

## Tips
- Explain the order: render reads, effect writes.

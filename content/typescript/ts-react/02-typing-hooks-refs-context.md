---
title: "Typing useState, useRef, useReducer and context without casts"
level: medium
type: concept
tags: [react-typescript, useState, useRef, useReducer, createContext, hooks]
related: [typescript/typing-props-children-events, typescript/union-narrowing-discriminated, react/use-reducer-vs-use-state]
---

## Question
How do you type `useState` with nullable data, `useRef` for DOM nodes and mutable values, `useReducer` with discriminated actions, and `createContext` without non-null assertions?

## Interview Answer
`useState` infers from the initial value, so I add a type argument only when the initial value doesn't describe the full type, such as `useState<User | null>(null)`. `useRef<HTMLInputElement>(null)` returns a `RefObject<HTMLInputElement | null>` in React 19 types, which I pass to `ref`; for mutable instance values, I pass the initial value (`useRef<number | undefined>(undefined)`) and mutate `.current`. For `useReducer` I define a discriminated union of actions and a reducer typed `(state: State, action: Action): State`, with an exhaustive `switch`. For context I avoid `createContext<T>({} as T)`; instead I create it with `null` default and expose a custom hook that throws if the provider is missing, which narrows the type to non-null for consumers. Setter types like `Dispatch<SetStateAction<T>>` are reusable for props.

## Explanation
### `useState`

```tsx
const [count, setCount] = useState(0);                       // number
const [user, setUser] = useState<User | null>(null);         // needs the argument
const [items, setItems] = useState<string[]>([]);            // [] alone infers never[]
const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;  // type for passing the setter as a prop
```

### `useRef`

```tsx
const inputRef = useRef<HTMLInputElement>(null);             // DOM ref: RefObject<HTMLInputElement | null>
<input ref={inputRef} />
inputRef.current?.focus();                                    // may be null before mount

const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);   // mutable instance value
timer.current = setTimeout(() => {}, 100);
```

In React 19 types, `useRef` requires an argument, and `RefObject<T>.current` is mutable `T`; passing `null` initial for DOM refs yields `T | null`.

### `useReducer`

```tsx
type State = { count: number; step: number };
type Action =
  | { type: "inc" }
  | { type: "dec" }
  | { type: "setStep"; step: number }
  | { type: "reset" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "inc": return { ...state, count: state.count + state.step };
    case "dec": return { ...state, count: state.count - state.step };
    case "setStep": return { ...state, step: action.step };   // action narrowed: has `step`
    case "reset": return { count: 0, step: 1 };
  }
}

const [state, dispatch] = useReducer(reducer, { count: 0, step: 1 });
dispatch({ type: "setStep", step: 5 });
// dispatch({ type: "setStep" });      // error: step is required
```

With all cases covered, the function's inferred return type satisfies `State` without a default; add `default: const _x: never = action` if you want a guard.

### Context without `!`

```tsx
import { createContext, use, useMemo, useState, type ReactNode } from "react";

type AuthContextValue = { user: User | null; login(u: User): void; logout(): void };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const value = useMemo<AuthContextValue>(() => ({ user, login: setUser, logout: () => setUser(null) }), [user]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);                  // or useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;                                    // narrowed to AuthContextValue
}
```

### Custom hooks

```tsx
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  return [on, () => setOn((v) => !v)] as const;  // tuple, not (boolean | (() => void))[]
}
```

`as const` preserves the tuple type for array-returning hooks (or annotate the return type).

### Other typing tips
- `useCallback` and `useMemo` infer from their functions; add generics only if inference is too wide.
- `useEffect` callbacks must return `void | (() => void)`; async effects need an inner function.
- `useImperativeHandle<Handle, Props>` for ref handles (see the imperative handle question).
- `useActionState<State, Payload>(action, initial)` infers state from the action's return type.
- `useContext` returns `T | null` if you used `null` as the default; the custom hook pattern removes the `null`.

## Follow-ups
- **Why not `createContext({} as Value)`?** — It hides a missing provider until runtime failures occur.
- **How to type a ref passed as a prop?** — `ref?: React.Ref<HTMLInputElement>` (React 19) or `React.ComponentProps<"input">["ref"]`.

## Common Mistakes
- Using `useState([])` and getting `never[]`.
- Non-null assertions on refs (`ref.current!.focus()`).

## Tips
- The custom context hook with a thrown error is the idiom to show.

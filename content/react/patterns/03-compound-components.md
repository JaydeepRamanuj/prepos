---
title: "Build a compound component (Tabs) with implicit shared state"
level: hard
type: implement
tags: [compound-components, context, composition, tabs, patterns]
related: [react/children-slots, react/use-context-rerenders, react/headless-components, machine-coding/tabs]
---

## Question
Implement a compound `Tabs` component used like the example below. The parts must share state implicitly (no prop drilling), only one panel is shown, and using a part outside `Tabs` should fail with a helpful error.

```tsx
<Tabs defaultValue="a">
  <Tabs.List>
    <Tabs.Trigger value="a">First</Tabs.Trigger>
    <Tabs.Trigger value="b">Second</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="a">Panel A</Tabs.Panel>
  <Tabs.Panel value="b">Panel B</Tabs.Panel>
</Tabs>
```

## Clues
- The root owns the state; the parts need to read it without props.
- Which React feature lets deeply nested children read a parent's value?
- Wire up ARIA roles: `tablist`, `tab`, `tabpanel`.

## Interview Answer
A compound component is a set of components that work together and share implicit state, giving callers flexible markup control. The root `Tabs` holds the selected value in state (or accepts it as a controlled prop), exposes it through a context, and attaches `List`, `Trigger` and `Panel` as static properties. Each part reads the context: a trigger compares its `value` to the selected one and calls `select` on click; a panel renders its children only when it matches. A custom `useTabs` hook throws if the context is missing, so misuse fails loudly. The consumer composes layout freely, while the library controls state and accessibility.

## Explanation
### Implementation

```tsx
import { createContext, useContext, useId, useMemo, useState, type ReactNode } from "react";

type TabsContextValue = { value: string; select: (v: string) => void; baseId: string };
const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs parts must be rendered inside <Tabs>");
  return ctx;
}

function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [value, setValue] = useState(defaultValue);
  const baseId = useId();
  const ctx = useMemo(() => ({ value, select: setValue, baseId }), [value, baseId]);
  return <TabsContext value={ctx}>{children}</TabsContext>;
}

function List({ children }: { children: ReactNode }) {
  return <div role="tablist">{children}</div>;
}

function Trigger({ value, children }: { value: string; children: ReactNode }) {
  const { value: selected, select, baseId } = useTabs();
  const active = selected === value;
  return (
    <button
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={active}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={active ? 0 : -1}
      onClick={() => select(value)}
    >
      {children}
    </button>
  );
}

function Panel({ value, children }: { value: string; children: ReactNode }) {
  const { value: selected, baseId } = useTabs();
  if (selected !== value) return null;
  return (
    <div role="tabpanel" id={`${baseId}-panel-${value}`} aria-labelledby={`${baseId}-tab-${value}`}>
      {children}
    </div>
  );
}

Tabs.List = List;
Tabs.Trigger = Trigger;
Tabs.Panel = Panel;
export { Tabs };
```

### Why this pattern
- Consumers decide structure, order and styling; no `items` array of config objects.
- State is hidden but accessible through context, so there's no prop drilling.
- Compare with the alternative of cloning children (`React.Children.map` + `cloneElement`): that breaks as soon as a part is wrapped in another element or component. Context works at any depth.

### Improvements
- Controlled mode: accept `value` and `onValueChange`; fall back to internal state.
- Keyboard support: arrow keys move focus between tabs (roving tabindex), `Home`/`End`.
- Render only active panel (as above) or keep all mounted with `hidden` to preserve state.
- With React 19 you can render `<TabsContext value=...>` directly, no `.Provider`.
- Export named parts (`TabsList`) for tree-shaking and RSC compatibility; static property assignments on a function component don't work across the server/client boundary in Server Components.

### Real-world examples
Radix UI, Headless UI, Reach UI and shadcn/ui all use compound components.

## Follow-ups
- **What about performance?** — Memoise the context value; all parts re-render on selection change, which is usually fine for tabs.
- **Compound components vs render props?** — Compound components expose structure; render props expose data.

## Common Mistakes
- Using `cloneElement` and breaking with wrappers.
- Forgetting to throw a helpful error outside the provider.
- Skipping keyboard and ARIA support.

## Tips
- Mention accessibility and controlled mode; they are the follow-ups.

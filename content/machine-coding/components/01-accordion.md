---
title: "Build an accessible Accordion that supports single and multiple open panels"
level: medium
type: implement
tags: [accordion, aria, keyboard, state-design, compound-components]
related: [machine-coding/tabs-component, machine-coding/file-explorer-tree]
---

## Question
Build an `Accordion` component in React + TypeScript.

**Must-haves**
- Render a list of sections from data: `{ id, title, content }[]`.
- Clicking a header toggles its panel.
- A prop `allowMultiple` (default `false`): when false, opening one panel closes the others.
- Optional `defaultOpen` array of ids that start open.
- Proper ARIA so a screen reader announces "button, expanded/collapsed".

**Stretch goals**
- Arrow Up/Down, Home and End move focus between headers.
- Support a controlled mode (`openIds` + `onChange`).
- Animate the open/close height.

```tsx
<Accordion
  allowMultiple={false}
  defaultOpen={["shipping"]}
  items={[
    { id: "shipping", title: "Shipping", content: "Ships in 2 days." },
    { id: "returns", title: "Returns", content: "30-day returns." },
  ]}
/>
```

## Interview Answer
Before coding I would confirm whether "single" mode allows closing the only open panel (I'd say yes — collapsing everything is fine) and whether the data is static or comes from props. My state is a single `Set<string>` of open ids, which handles both modes: in single mode toggling replaces the set with just that id, in multiple mode it adds or removes. Each header is a real `<button>` inside a heading, with `aria-expanded` and `aria-controls` pointing at the panel, and the panel is a `role="region"` labelled by its header. I generate ids with `useId` so two accordions on a page never clash. Keyboard support between headers is a small `onKeyDown` on the wrapper that moves focus through a list of button refs.

## Explanation
### Component tree and state
```txt
Accordion (owns openIds: Set<string>)
 └─ for each item
     ├─ <h3><button aria-expanded aria-controls> title </button></h3>
     └─ <div role="region" aria-labelledby hidden?> content </div>
```

Why a `Set<string>` instead of `activeIndex: number`? An index cannot represent "multiple open", and ids survive reordering or filtering the items. One state shape for both modes means one toggle function, not two code paths.

Why not let each item own its own `isOpen`? Because single mode needs to close siblings — that is cross-item coordination, so the state belongs in the common parent (lift state up).

### Complete code

```tsx
// Accordion.tsx
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Item = { id: string; title: string; content: ReactNode };

type Props = {
  items: Item[];
  allowMultiple?: boolean;
  defaultOpen?: string[];
};

export function Accordion({ items, allowMultiple = false, defaultOpen = [] }: Props) {
  // Lazy initialiser: build the Set once, not on every render
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(allowMultiple ? defaultOpen : defaultOpen.slice(0, 1)),
  );
  const baseId = useId();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const isOpen = prev.has(id);
      if (!allowMultiple) return isOpen ? new Set() : new Set([id]);
      const next = new Set(prev); // never mutate state in place
      if (isOpen) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const buttons = buttonRefs.current.filter(Boolean) as HTMLButtonElement[];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return; // focus is inside a panel, not on a header

    let next: number | null = null;
    if (e.key === "ArrowDown") next = (current + 1) % buttons.length;
    if (e.key === "ArrowUp") next = (current - 1 + buttons.length) % buttons.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = buttons.length - 1;
    if (next === null) return;

    e.preventDefault(); // stop the page from scrolling
    buttons[next].focus();
  }

  return (
    <div className="accordion" onKeyDown={onKeyDown}>
      {items.map((item, i) => {
        const isOpen = openIds.has(item.id);
        const headerId = `${baseId}-header-${item.id}`;
        const panelId = `${baseId}-panel-${item.id}`;
        return (
          <div key={item.id} className="accordion-item">
            <h3 style={{ margin: 0 }}>
              <button
                ref={(el) => {
                  buttonRefs.current[i] = el;
                }}
                id={headerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                style={{ width: "100%", textAlign: "left", padding: 12 }}
              >
                {item.title}
                <span aria-hidden="true" style={{ float: "right" }}>
                  {isOpen ? "−" : "+"}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              hidden={!isOpen}
              style={{ padding: 12 }}
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

```tsx
// App.tsx
import { Accordion } from "./Accordion";

export default function App() {
  return (
    <Accordion
      allowMultiple
      defaultOpen={["shipping"]}
      items={[
        { id: "shipping", title: "Shipping", content: "Ships in 2 days." },
        { id: "returns", title: "Returns", content: "30-day returns." },
        { id: "warranty", title: "Warranty", content: "1 year." },
      ]}
    />
  );
}
```

### Accessibility checklist
| Requirement | How |
|---|---|
| Header is operable by keyboard | Real `<button type="button">` — Enter and Space work for free |
| State is announced | `aria-expanded={isOpen}` |
| Header ↔ panel relationship | `aria-controls` on button, `aria-labelledby` on panel |
| Document outline | Button wrapped in a heading (`h3`, adjust level to the page) |
| Hidden content not read | `hidden` attribute removes the panel from the accessibility tree |

The `+`/`−` icon is `aria-hidden` because `aria-expanded` already conveys the state.

### Edge cases
- **Duplicate ids in data** → React key warning and broken toggling. Ask the interviewer if ids are guaranteed unique.
- **`defaultOpen` with several ids in single mode** → only the first is honoured (`slice(0, 1)`).
- **Items removed while open** → the stale id stays in the Set but is harmless; it simply matches nothing.
- **Panels with focusable content** → the keyboard handler returns early when focus is not on a header, so arrow keys inside a textarea still work.

### Stretch: controlled mode
Accept `openIds?: string[]` and `onChange?: (ids: string[]) => void`. If `openIds` is provided, derive the Set from it and call `onChange` instead of `setOpenIds`:

```tsx
const isControlled = props.openIds !== undefined;
const open = isControlled ? new Set(props.openIds) : openIds;
// inside toggle: compute `next` from `open`, then
isControlled ? props.onChange?.([...next]) : setOpenIds(next);
```

### Stretch: animation
`hidden` cannot animate. Swap it for a CSS grid trick that animates to auto height:

```css
.panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 200ms; }
.panel[data-open="true"] { grid-template-rows: 1fr; }
.panel > div { overflow: hidden; }
```

When you do this, hide collapsed content from assistive tech and the tab order another way (e.g. `visibility: hidden` after the transition), otherwise screen readers read closed panels.

## Follow-ups
- **Why not use `<details>`/`<summary>`?** — It is a great zero-JS option with built-in semantics. Recent browsers also support the `name` attribute on `<details>` to make a group exclusive, but you get less control over controlled state and animation, so interviewers usually want the custom version.
- **How would you make it a compound component API (`<Accordion.Item>`, `<Accordion.Trigger>`)?** — Put `openIds` and `toggle` in a context provided by `Accordion`, and give each `Item` its own context with its id; triggers and panels read both.
- **What if there are 1000 sections?** — Rendering closed panels is cheap with `hidden`, but you could render content lazily only when first opened and keep it mounted afterwards to preserve its state.

## Common Mistakes
- Using a `<div onClick>` as the header — not focusable, no Enter/Space, no role.
- Storing `activeIndex: number`, then needing a second state shape when "allow multiple" is added.
- Mutating the Set (`prev.add(id); return prev`) — same reference, so React skips the re-render.
- Hard-coding ids like `panel-1`, which collide when two accordions render on one page.

## Tips
- State the state shape out loud first: "a Set of open ids handles both modes". Interviewers grade the data model more than the markup.
- Remember the ARIA pair as **"button says expanded + controls, region says labelledby"**.

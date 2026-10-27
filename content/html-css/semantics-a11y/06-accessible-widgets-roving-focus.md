---
title: "Build accessible tabs and a menu: roving tabindex and keyboard patterns"
level: hard
type: implement
tags: [tabs, menu, roving-tabindex, aria-pattern, keyboard, composite-widgets]
related: [react/compound-components, html-css/aria-roles-states, html-css/keyboard-focus-basics]
---

## Question
Implement an accessible tablist following the ARIA Authoring Practices: Left/Right arrows move between tabs, Home/End jump to first/last, only the active tab is in the Tab sequence, panels are labelled by their tabs, and activation can be automatic or manual. Explain roving `tabindex` versus `aria-activedescendant`.

## Clues
- Composite widgets are a single Tab stop; arrow keys move inside.
- Only one tab has `tabindex="0"`; the others have `-1`.
- `aria-selected` and `aria-controls` link tabs to panels.

## Interview Answer
A tablist is a composite widget: users press Tab to enter it once, then use arrow keys to move among tabs. I implement a roving tabindex: the selected tab has `tabindex="0"` and the others `-1`, and on Arrow Left/Right (wrapping), Home and End I move focus to the next tab by calling `.focus()` and update which tab holds `tabindex="0"`. Each tab has `role="tab"`, `aria-selected`, and `aria-controls` pointing to its `role="tabpanel"`, which uses `aria-labelledby` back to the tab. With automatic activation, focusing a tab selects it; with manual activation, Enter or Space selects it, which is better when panels are expensive to render. Tab from the tablist moves focus into the active panel, so panels get `tabindex="0"` if they contain no focusable content. `aria-activedescendant` is the alternative where DOM focus stays on a container (used in comboboxes and listboxes).

## Explanation
### Markup

```html
<div role="tablist" aria-label="Question sections">
  <button role="tab" id="tab-a" aria-selected="true"  aria-controls="panel-a" tabindex="0">Answer</button>
  <button role="tab" id="tab-b" aria-selected="false" aria-controls="panel-b" tabindex="-1">Explanation</button>
  <button role="tab" id="tab-c" aria-selected="false" aria-controls="panel-c" tabindex="-1">Follow-ups</button>
</div>
<div role="tabpanel" id="panel-a" aria-labelledby="tab-a" tabindex="0">…</div>
<div role="tabpanel" id="panel-b" aria-labelledby="tab-b" tabindex="0" hidden>…</div>
<div role="tabpanel" id="panel-c" aria-labelledby="tab-c" tabindex="0" hidden>…</div>
```

### React implementation

```tsx
import { useRef, useState, useId } from "react";

type Tab = { id: string; label: string; content: React.ReactNode };

export function Tabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  function focusTab(i: number) {
    const n = tabs.length;
    const next = (i + n) % n;                       // wrap-around
    refs.current[next]?.focus();
    setActive(next);                                // automatic activation
  }

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    switch (e.key) {
      case "ArrowRight": e.preventDefault(); focusTab(i + 1); break;
      case "ArrowLeft":  e.preventDefault(); focusTab(i - 1); break;
      case "Home":       e.preventDefault(); focusTab(0); break;
      case "End":        e.preventDefault(); focusTab(tabs.length - 1); break;
    }
  }

  return (
    <div>
      <div role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={i === active}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          tabIndex={0}
          hidden={i !== active}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
```

For vertical tabs use Up/Down and `aria-orientation="vertical"`. For manual activation, arrow keys move focus only, and Enter/Space call `setActive`.

### Roving tabindex vs `aria-activedescendant`

| | Roving tabindex | `aria-activedescendant` |
|---|---|---|
| DOM focus | moves to each item | stays on the container/input |
| Items need focusability | yes (`tabindex`) | no |
| Scrolling into view | automatic with focus | you scroll manually |
| Best for | tabs, toolbars, radio groups, menus, trees | combobox listboxes where typing must continue, grids |
| Screen reader support | very good | good, varies by combination |

### Menu button pattern (summary)
- Button: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`.
- Enter/Space/ArrowDown opens and focuses the first item; ArrowUp opens and focuses the last.
- Menu: `role="menu"`, items `role="menuitem"` with roving tabindex; Up/Down/Home/End navigate; type-ahead moves by letter; Escape closes and returns focus to the button; Tab closes the menu.
- Use menus for application-style action menus, not site navigation (use a disclosure with a list of links instead).

### Use libraries for production
Radix UI, React Aria, Headless UI and Ariakit implement these patterns with the many edge cases (RTL, focus restore, type-ahead, virtual lists, mobile screen readers). Write your own to understand them, ship the tested primitives.

### Testing
Keyboard-only walkthrough, screen reader announcement ("Answer, tab, selected, 1 of 3"), Testing Library `getByRole("tab", { selected: true })`, `userEvent.keyboard("{ArrowRight}")`.

## Follow-ups
- **Why single tab stop?** — A long tab list would otherwise require many Tab presses; arrow keys are faster and expected.
- **Should panels be unmounted when hidden?** — Either; `hidden` keeps state, unmounting saves cost.

## Common Mistakes
- Making every tab tabbable.
- Forgetting `preventDefault` on arrow keys (page scrolls).
- No `aria-controls`/`aria-labelledby` wiring.

## Tips
- Say "composite widget = one tab stop + arrow keys", then show the roving tabindex.

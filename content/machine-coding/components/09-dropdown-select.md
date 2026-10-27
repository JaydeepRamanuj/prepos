---
title: "Build a custom Select dropdown with full keyboard navigation"
level: hard
type: implement
tags: [select, listbox, aria-activedescendant, keyboard, click-outside]
related: [machine-coding/autocomplete-typeahead, machine-coding/tabs-component, machine-coding/tooltip-popover]
---

## Question
Build a custom `Select` (the native `<select>` cannot be styled the way design wants).

**Must-haves**
- Props: `options: { value, label, disabled? }[]`, `value`, `onChange`, `placeholder`.
- Click the trigger to open a list below it; click an option to select it and close.
- Closes on Esc and on clicking outside.
- Keyboard: Up/Down move the highlighted option (skipping disabled), Enter/Space selects, Home/End jump; opening with ArrowDown highlights the selected option.
- Type-ahead: typing "in" jumps to "India".

**Stretch goals**
- Multi-select with checkboxes.
- Flip above the trigger when there is no room below.
- Virtualise for 5,000 options.

## Clues
- Separate *selected* (`value`, owned by the parent) from *highlighted* (`activeIndex`, local UI state). Arrow keys change only the highlight; Enter commits it.
- Keep DOM focus on the trigger button and point at the highlighted option with `aria-activedescendant` — you never need to move focus into the list.
- Type-ahead is a buffer string that you append to on each printable key and clear with a timeout ~500ms after the last key — basically a debounce.

## Interview Answer
I would implement the ARIA "select-only combobox" pattern. The trigger is a button with `role="combobox"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`; the popup is a `role="listbox"` of `role="option"` items with `aria-selected`. Local state is just `isOpen` and `activeIndex`; the selected value is controlled by the parent. Focus never leaves the trigger — arrow keys update `activeIndex`, which `aria-activedescendant` exposes to screen readers, and I scroll the active option into view. Enter or Space commits, Esc closes without changing the value, and a `pointerdown` listener on the document closes it when the target is outside the root. Type-ahead keeps a short-lived search string, cleared by a timeout like a debounce, and highlights the first enabled option whose label starts with it.

## Explanation
### State design
```txt
parent:   value                       (what is chosen)
Select:   isOpen: boolean             (UI)
          activeIndex: number         (what keyboard is pointing at)
          typeahead: ref<string>      (not rendered → ref, not state)
```

Selected vs highlighted is the core insight. Mixing them means arrowing through a list fires `onChange` on every keypress — which, for a country select that triggers a fetch, is a real bug.

### Complete code

```tsx
// Select.tsx
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

type Option = { value: string; label: string; disabled?: boolean };
type Props = {
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
};

export function Select({ options, value, onChange, placeholder = "Select…", label }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", timer: undefined as ReturnType<typeof setTimeout> | undefined });
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  // Find the next enabled option from `start` in direction `dir`
  function nextEnabled(start: number, dir: 1 | -1) {
    for (let i = start, steps = 0; steps < options.length; i += dir, steps++) {
      const idx = (i + options.length) % options.length;
      if (!options[idx].disabled) return idx;
    }
    return -1;
  }

  function open() {
    setIsOpen(true);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : nextEnabled(0, 1));
  }
  function close() {
    setIsOpen(false);
  }
  function commit(i: number) {
    if (i < 0 || options[i].disabled) return;
    onChange(options[i].value);
    close();
  }

  // Click outside → close
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  // Keep the highlighted option visible while arrowing through a long list
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the type-ahead timer on unmount
  useEffect(() => () => clearTimeout(typeahead.current.timer), []);

  function handleTypeahead(char: string) {
    const t = typeahead.current;
    clearTimeout(t.timer);
    t.text += char.toLowerCase();
    t.timer = setTimeout(() => (t.text = ""), 500); // reset after a pause (debounce)
    const match = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(t.text));
    if (match >= 0) {
      if (!isOpen) setIsOpen(true);
      setActiveIndex(match);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!isOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        open();
        return;
      }
    } else {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => nextEnabled(i + 1, 1));
          return;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => nextEnabled(i - 1, -1));
          return;
        case "Home":
          e.preventDefault();
          setActiveIndex(nextEnabled(0, 1));
          return;
        case "End":
          e.preventDefault();
          setActiveIndex(nextEnabled(options.length - 1, -1));
          return;
        case "Enter":
        case " ":
          // Space while typing ahead ("United States") is part of the search
          if (e.key === " " && typeahead.current.text) break;
          e.preventDefault();
          commit(activeIndex);
          return;
        case "Escape":
          e.preventDefault();
          close();
          return;
        case "Tab":
          close(); // let focus move on naturally
          return;
      }
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) handleTypeahead(e.key);
  }

  return (
    <div ref={rootRef} style={{ position: "relative", width: 240 }}>
      <span id={`${id}-label`}>{label}</span>
      <button
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={onKeyDown}
        style={{ width: "100%", textAlign: "left", padding: 8 }}
      >
        {selected ? selected.label : <span style={{ color: "#888" }}>{placeholder}</span>}
        <span aria-hidden="true" style={{ float: "right" }}>▾</span>
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={`${id}-label`}
          tabIndex={-1}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: 200,
            overflowY: "auto",
            margin: 0,
            padding: 0,
            listStyle: "none",
            background: "white",
            border: "1px solid #ccc",
            zIndex: 10,
          }}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={optionId(i)}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              // mousedown + preventDefault keeps focus on the trigger
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(i)}
              onMouseMove={() => !o.disabled && setActiveIndex(i)}
              style={{
                padding: 8,
                cursor: o.disabled ? "not-allowed" : "pointer",
                opacity: o.disabled ? 0.5 : 1,
                background: i === activeIndex ? "#e0e7ff" : undefined,
                fontWeight: o.value === value ? 700 : 400,
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

```tsx
// App.tsx
import { useState } from "react";
import { Select } from "./Select";

const countries = [
  { value: "in", label: "India" },
  { value: "id", label: "Indonesia" },
  { value: "jp", label: "Japan" },
  { value: "np", label: "Nepal", disabled: true },
  { value: "sg", label: "Singapore" },
  { value: "us", label: "United States" },
];

export default function App() {
  const [country, setCountry] = useState<string | null>(null);
  return (
    <div style={{ padding: 24 }}>
      <Select label="Country" options={countries} value={country} onChange={setCountry} />
      <p>Selected: {country ?? "none"}</p>
    </div>
  );
}
```

### `aria-activedescendant` vs moving focus
| Approach | How | Pros / cons |
|---|---|---|
| `aria-activedescendant` (used here) | Focus stays on the trigger; attribute points at the active option's id | No focus juggling, typing keeps working, Esc is simple. Needs stable ids and manual `scrollIntoView` |
| Roving tabindex | Move real focus to each `<li>` | Native scroll-into-view, but focus must return to the trigger on close and type-ahead handling moves too |

### Edge cases
- All options disabled → `nextEnabled` returns `-1`; `commit(-1)` is a no-op.
- `value` not in options → `selectedIndex` is `-1`; show the placeholder.
- Clicking an option: without `onMouseDown` + `preventDefault`, the button would blur first. It is harmless here, but in a combobox with a text input it causes the list to close before the click lands — know why.
- Inside a modal or `overflow: hidden` container the list can be clipped → render it in a portal and position it (see the tooltip/popover question), or use the native popover/top layer.

### Stretch: multi-select
`value: string[]`, `aria-multiselectable="true"` on the listbox, `commit` toggles membership and keeps the list open, and the trigger shows "3 selected" or chips.

### Stretch: virtualisation
For 5,000 options, render only the ~10 visible rows (TanStack Virtual or a manual `scrollTop / rowHeight` window). With virtualisation the active option may not be in the DOM, so scroll the virtualiser to `activeIndex` before relying on its id.

## Follow-ups
- **When would you NOT build a custom select?** — Mobile-heavy forms: native `<select>` gets the OS picker, perfect accessibility and zero JS. Custom only when you need rich option content, search or multi-select. Customisable native select (`appearance: base-select`) is arriving in Chromium but is not cross-browser yet.
- **How is this different from an autocomplete?** — An autocomplete has a text input that filters options (often from a server); focus is in the input and you need `aria-autocomplete="list"`. Same listbox and activedescendant mechanics.
- **Why `pointerdown` on the document instead of `click`?** — It fires before focus changes and before `click`, so you close reliably even if something stops click propagation, and it covers touch and pen.

## Common Mistakes
- Firing `onChange` on every arrow key by conflating highlight and selection.
- Forgetting to skip disabled options in keyboard navigation.
- Using `onBlur` of the trigger to close — clicking an option blurs the trigger first and closes the list before the click registers.
- No `preventDefault` on ArrowDown/Space, so the page scrolls while navigating.

## Tips
- Draw the two-state split on the whiteboard first: **selected (parent) vs active (local)**.
- Mention the WAI-ARIA APG "Select-Only Combobox" by name — it shows you know where the rules come from.

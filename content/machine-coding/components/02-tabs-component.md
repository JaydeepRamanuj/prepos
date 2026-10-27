---
title: "Build an accessible Tabs component with arrow-key navigation"
level: medium
type: implement
tags: [tabs, aria, roving-tabindex, keyboard, compound-components]
related: [machine-coding/accordion, machine-coding/dropdown-select]
---

## Question
Build a `Tabs` component in React + TypeScript.

**Must-haves**
- Takes `tabs: { id, label, content }[]` and an optional `defaultTabId`.
- Clicking a tab shows its panel; only one panel is visible at a time.
- Correct ARIA roles: `tablist`, `tab`, `tabpanel`.
- Keyboard: Left/Right arrows move between tabs (wrapping), Home/End jump to first/last. Only the active tab is in the Tab order.

**Stretch goals**
- Disabled tabs that are skipped by keyboard navigation.
- Keep inactive panels mounted (so form state is preserved) vs unmount them — make it a prop.
- Sync the active tab to the URL (`?tab=billing`).

```tsx
<Tabs
  defaultTabId="profile"
  tabs={[
    { id: "profile", label: "Profile", content: <ProfileForm /> },
    { id: "billing", label: "Billing", content: <Billing /> },
  ]}
/>
```

## Interview Answer
I would first ask whether arrow keys should activate a tab immediately (automatic activation) or only move focus until Enter is pressed (manual activation); automatic is the common default when panels are cheap to render. State is just `activeId: string` — the selected tab's id, not its index, so reordering tabs is safe. Each tab is a `<button role="tab">` with `aria-selected` and `aria-controls`; each panel is `role="tabpanel"` labelled by its tab. I use the roving tabindex pattern: the active tab gets `tabIndex={0}` and every other tab gets `-1`, so pressing Tab moves from the tab list straight into the panel, and arrow keys move within the list. I keep refs to the tab buttons so the key handler can move focus.

## Explanation
### Component tree and state
```txt
Tabs (activeId)
 ├─ div role="tablist"   (onKeyDown handles arrows/Home/End)
 │    └─ button role="tab" aria-selected tabIndex=0|-1   × n
 └─ div role="tabpanel" aria-labelledby  × n (only active is visible)
```

One piece of state, `activeId`. Everything else (which panel is hidden, which tab is focusable) is **derived** during render — never store derived values in state.

### Roving tabindex — the key idea
A tab list is one "composite widget". Keyboard users press Tab to enter it, arrows to move within it, Tab again to leave. That only works if exactly one tab has `tabIndex=0` at a time.

```txt
Tab key:    [page] → [active tab] → [panel] → ...
Arrow keys:          ◀ tab1 tab2 tab3 ▶  (wraps)
```

### Complete code

```tsx
// Tabs.tsx
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Tab = { id: string; label: string; content: ReactNode; disabled?: boolean };

type Props = { tabs: Tab[]; defaultTabId?: string; keepMounted?: boolean };

export function Tabs({ tabs, defaultTabId, keepMounted = true }: Props) {
  const firstEnabled = tabs.find((t) => !t.disabled)?.id ?? "";
  const [activeId, setActiveId] = useState(defaultTabId ?? firstEnabled);
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const enabled = tabs.filter((t) => !t.disabled);

  function select(id: string) {
    setActiveId(id);
    tabRefs.current.get(id)?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = enabled.findIndex((t) => t.id === activeId);
    const last = enabled.length - 1;
    let next: number;
    switch (e.key) {
      case "ArrowRight": next = i === last ? 0 : i + 1; break;
      case "ArrowLeft":  next = i === 0 ? last : i - 1; break;
      case "Home":       next = 0; break;
      case "End":        next = last; break;
      default: return; // let other keys (Tab!) behave normally
    }
    e.preventDefault();
    select(enabled[next].id); // automatic activation
  }

  const tabDomId = (id: string) => `${baseId}-tab-${id}`;
  const panelDomId = (id: string) => `${baseId}-panel-${id}`;

  return (
    <div>
      <div role="tablist" aria-label="Account settings" onKeyDown={onKeyDown} style={{ display: "flex", gap: 4 }}>
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              id={tabDomId(tab.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelDomId(tab.id)}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => setActiveId(tab.id)}
              style={{ fontWeight: selected ? 700 : 400, borderBottom: selected ? "2px solid" : "2px solid transparent" }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        if (!keepMounted && !selected) return null;
        return (
          <div
            key={tab.id}
            id={panelDomId(tab.id)}
            role="tabpanel"
            aria-labelledby={tabDomId(tab.id)}
            hidden={!selected}
            tabIndex={0} // lets keyboard users reach panels with no focusable content
            style={{ padding: 16 }}
          >
            {tab.content}
          </div>
        );
      })}
    </div>
  );
}
```

```tsx
// App.tsx
import { Tabs } from "./Tabs";

export default function App() {
  return (
    <Tabs
      defaultTabId="profile"
      tabs={[
        { id: "profile", label: "Profile", content: <input placeholder="Name" /> },
        { id: "billing", label: "Billing", content: <p>Plan: Pro</p> },
        { id: "team", label: "Team", content: <p>Coming soon</p>, disabled: true },
        { id: "security", label: "Security", content: <p>2FA enabled</p> },
      ]}
    />
  );
}
```

### Design decisions worth saying out loud
- **id, not index** for `activeId` — survives reordering and inserting tabs.
- **Disabled tabs are filtered out of `enabled`** so arrows skip them. (The APG also allows focusable-but-disabled tabs using `aria-disabled`; either is acceptable if you can justify it.)
- **`keepMounted`** — `hidden` keeps the panel in the DOM so typed input survives switching tabs; unmounting saves memory for heavy panels but resets their state. This is a real product trade-off worth mentioning.
- **Ref map keyed by id** with a callback ref — no index bookkeeping, and the `null` call on unmount cleans up.

### Accessibility checklist
| Element | Attributes |
|---|---|
| Container | `role="tablist"`, `aria-label` (or `aria-labelledby` a heading) |
| Tab | `role="tab"`, `aria-selected`, `aria-controls`, roving `tabIndex` |
| Panel | `role="tabpanel"`, `aria-labelledby`, `hidden` when inactive |

Use `aria-orientation="vertical"` and Up/Down keys if the tabs are stacked vertically.

### Edge cases
- `defaultTabId` that does not exist or is disabled → validate it and fall back to `firstEnabled`.
- All tabs disabled → `enabled` is empty; guard the key handler (`if (!enabled.length) return`).
- Tabs prop changes and the active tab disappears → derive a safe value: `const current = tabs.some(t => t.id === activeId) ? activeId : firstEnabled`.

### Stretch: URL sync
In a Next.js app, read `useSearchParams().get("tab")` as the source of truth and call `router.replace(\`?tab=${id}\`)` instead of `setActiveId`. Now the tab is shareable and survives refresh — and the component becomes controlled by the URL.

## Follow-ups
- **Automatic vs manual activation — when do you choose manual?** — When showing a panel is expensive (network fetch, heavy chart). Arrows only move focus; Enter/Space selects. You then need separate `focusedId` and `activeId`.
- **How would you make it a compound component (`<Tabs><Tabs.List><Tabs.Trigger/>…`)?** — Store `activeId`, `setActiveId` and `baseId` in a context; triggers and panels read it and compute their own ARIA ids from their `value` prop.
- **Why does the panel have `tabIndex={0}`?** — If the panel has no focusable children, keyboard users could not reach and scroll it; the APG recommends making the panel focusable in that case.

## Common Mistakes
- Every tab with `tabIndex=0`, so keyboard users must Tab through all tabs before reaching content.
- Forgetting `e.preventDefault()` on Home/End, which also scrolls the page.
- Swallowing every key in `onKeyDown`, which breaks Tab-out of the tab list.
- Using `aria-pressed` or `aria-expanded` on tabs — tabs use `aria-selected`.

## Tips
- Name the pattern: "roving tabindex". It signals you know the WAI-ARIA Authoring Practices.
- Write the state as one line (`const [activeId, setActiveId] = useState(...)`) and emphasise that everything else is derived.

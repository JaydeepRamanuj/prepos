---
title: "Why do index keys break lists? Predict the bug"
level: hard
type: output
tags: [keys, lists, reconciliation, state]
related: [react/reconciliation-diffing, react/jsx-compiles-to]
---

## Question
Each row has an uncontrolled input. The user types "milk" in the first row's input, then clicks **Add to top**. What does the UI show, and why? How do you fix it?

```tsx
function Row({ label }: { label: string }) {
  return (
    <li>
      {label}: <input placeholder="note" />
    </li>
  );
}

export default function List() {
  const [items, setItems] = useState(["Apples", "Bread"]);
  return (
    <>
      <button onClick={() => setItems(["Eggs", ...items])}>Add to top</button>
      <ul>
        {items.map((item, index) => (
          <Row key={index} label={item} />
        ))}
      </ul>
    </>
  );
}
```

## Clues
- React matches old and new children by key. Write down which key each label had before and after the click.
- The input's typed text lives in the DOM node (and any component state lives in the fiber) that belongs to a key, not to a label.

## Interview Answer
After the click, the list shows Eggs, Apples, Bread — but "milk" is in the input next to **Eggs**, not Apples. With index keys, key `0` was Apples before and is Eggs after. React matches children by key, so it thinks the row with key 0 still exists and just got a new `label` prop; it keeps that row's DOM node and state, including the typed text, and patches the label. The real new row is created at key 2 at the end. The fix is a stable, unique key that comes from the data — an id — so each row's identity follows the item. Index keys are only safe when the list is static and never reordered, filtered or inserted into.

## Explanation
### Walking through it
```txt
Before                       After click (keys by index)
key 0 → Row "Apples" [milk]  key 0 → Row "Eggs"    ← reuses Apples' row: [milk] stays
key 1 → Row "Bread"  []      key 1 → Row "Apples"  ← reuses Bread's row
                             key 2 → Row "Bread"   ← new row, mounted
```

React's reasoning: "keys 0 and 1 exist in both renders, so update their props; key 2 is new, so mount it." Each existing row receives a different label, and their uncontrolled inputs (and any `useState` inside `Row`) stay where they were. Visually, the note slides to the wrong item.

### The fix
```tsx
type Item = { id: string; label: string };

export default function List() {
  const [items, setItems] = useState<Item[]>([
    { id: crypto.randomUUID(), label: "Apples" },
    { id: crypto.randomUUID(), label: "Bread" },
  ]);
  const addEggs = () =>
    setItems([{ id: crypto.randomUUID(), label: "Eggs" }, ...items]);

  return (
    <>
      <button onClick={addEggs}>Add to top</button>
      <ul>
        {items.map((item) => (
          <Row key={item.id} label={item.label} />
        ))}
      </ul>
    </>
  );
}
```
Now React sees a new key at the top, mounts one row there, and simply moves the others. "milk" stays with Apples.

### Rules for keys
- **Stable** — the same item gets the same key on every render. Generate ids when data is *created*, not during render.
- **Unique among siblings** — only needs to be unique within that list, not globally.
- **Never `Math.random()` or `crypto.randomUUID()` inside `map`** — a new key every render means every row remounts: lost state, lost focus, slow.
- **Index is acceptable** when the list is never reordered, filtered or prepended and items have no state.

### Performance angle
Wrong keys also cost performance: with index keys, prepending one item makes React update *every* row's props instead of inserting one node.

## Follow-ups
- **Does the key need to be passed as a prop to read it?** — `key` isn't forwarded to the component; pass `id` separately if the child needs it.
- **What about keys on Fragments in a map?** — Use `<Fragment key={id}>`; the shorthand `<>` can't take a key.
- **Why does React warn when keys are missing?** — Without keys it falls back to index matching, which has exactly this bug.

## Common Mistakes
- Believing index keys are only a performance issue — they cause real state bugs.
- Generating random keys during render.
- Using a non-unique field (like `name`) that can collide.

## Tips
- Draw the before/after key table. Saying "key 0 used to be Apples, now it's Eggs, so React reuses Apples' row" is the whole answer in one sentence.

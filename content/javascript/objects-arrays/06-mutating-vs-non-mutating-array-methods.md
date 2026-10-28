---
title: "Which array methods mutate, and what are the non-mutating alternatives?"
level: medium
type: concept
tags: [arrays, mutation, sort, toSorted, immutability]
related: [javascript/object-immutability-freeze, javascript/map-filter-reduce, react/props-vs-state]
---

## Question
Which common array methods mutate the original array? What are the immutable alternatives, and what surprises does `sort` have?

## Interview Answer
The mutating methods are `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill` and `copyWithin`. Non-mutating ones include `map`, `filter`, `slice`, `concat`, `flat` and spread. Since ES2023 there are non-mutating counterparts for the awkward ones: `toSorted`, `toReversed`, `toSpliced` and `with`. This matters in React because state must be replaced, not mutated. `sort` has two surprises: it sorts in place and returns the same array, and without a comparator it converts to strings, so `[10, 9, 1].sort()` gives `[1, 10, 9]`. The comparator should return a negative, zero or positive number, not a boolean.

## Explanation
### Mutating vs not

| Mutates | Non-mutating alternative |
|---|---|
| `push(x)` | `[...arr, x]` |
| `unshift(x)` | `[x, ...arr]` |
| `pop()` / `shift()` | `arr.slice(0, -1)` / `arr.slice(1)` |
| `splice(i, n)` | `arr.toSpliced(i, n)` or `filter` |
| `sort(fn)` | `arr.toSorted(fn)` or `[...arr].sort(fn)` |
| `reverse()` | `arr.toReversed()` |
| `arr[i] = v` | `arr.with(i, v)` or `map` |

### Immutable updates in state

```js
const add = (list, item) => [...list, item];
const remove = (list, id) => list.filter((x) => x.id !== id);
const update = (list, id, patch) =>
  list.map((x) => (x.id === id ? { ...x, ...patch } : x));
```

### Sorting pitfalls

```js
[10, 9, 1].sort();                 // [1, 10, 9] (string order)
[10, 9, 1].sort((a, b) => a - b);  // [1, 9, 10]
[3, 1, 2].sort((a, b) => a > b);   // wrong: boolean, inconsistent
```

- Sorting strings with accents or locales: `a.localeCompare(b)`.
- `sort` is stable in modern engines (ES2019), so sorting by one key then another works.
- `undefined` goes last; holes are removed.
- `const sorted = arr.sort()` is just another reference to the same mutated array.

```js
const a = [3, 1, 2];
const b = a.sort();
a === b;   // true
```

### Mutation in React

```js
const [items, setItems] = useState([3, 1, 2]);
items.sort();            // mutates state
setItems(items);         // same reference, no re-render
setItems(items.toSorted()); // correct
```

### Compatibility
`toSorted` and friends need modern runtimes (Node 20+, current browsers); otherwise copy first with spread.

## Follow-ups
- **Does `slice` or `splice` mutate?** — `slice` doesn't; `splice` does.
- **Is `[...arr].sort()` O(n) extra memory?** — Yes, one shallow copy.

## Common Mistakes
- Sorting state in place.
- Using a boolean comparator.

## Tips
- Quote the `[10, 9, 1].sort()` example; it proves you know the default.

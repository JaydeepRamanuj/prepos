---
title: "Build a Kanban board with drag and drop between columns"
level: advanced
type: implement
tags: [kanban, drag-and-drop, html5-dnd, dnd-kit, reordering, a11y, state-design]
related: [machine-coding/todo-app, machine-coding/file-explorer-tree, react/immutable-state-updates]
---

## Question
Build a Kanban board with three columns (Todo, Doing, Done) where cards can be dragged between and within columns.

**Must-haves**
- Drag a card to another column; it appends or inserts at the drop position.
- Reorder cards within a column.
- A visual cue shows the target column while dragging.
- State updates are immutable and survive re-renders.

**Stretch goals**
- Keyboard-accessible moves.
- Persist to `localStorage`.
- Touch support.

## Clues
- Choose a state shape that makes moving cheap: columns hold ordered arrays of card ids, and cards live in a `byId` map.
- With the native HTML5 API you need `draggable`, `onDragStart` (put the id in `dataTransfer`), and `onDragOver` with `preventDefault()` on the drop target, otherwise `onDrop` never fires.
- A move is "remove id from source list, insert id into target list at index".

## Interview Answer
I normalise the board into `columns: Record<ColumnId, string[]>` (ordered card ids) and `cards: Record<string, Card>`. A single pure function `moveCard(state, cardId, toColumn, toIndex)` removes the id from whichever column holds it and inserts it at the target index in a new array, adjusting the index when moving down within the same list. With native drag and drop, each card is `draggable` and stores its id in `dataTransfer` on `dragstart`; each column calls `preventDefault()` in `dragover` (required to allow dropping), tracks the hovered column for highlighting, and handles `drop` by dispatching the move. To compute the index I compare the pointer's Y with each card's midpoint. This works on desktop mouse input, but native DnD does not support touch or keyboard, so in production I use dnd-kit, which provides pointer/touch/keyboard sensors, collision detection, a drag overlay, and announcements for screen readers, with the same `moveCard` logic underneath.

## Explanation
### State shape and move

```ts
type Card = { id: string; title: string };
type ColumnId = "todo" | "doing" | "done";
type Board = { cards: Record<string, Card>; columns: Record<ColumnId, string[]> };

function moveCard(board: Board, cardId: string, to: ColumnId, toIndex: number): Board {
  const from = (Object.keys(board.columns) as ColumnId[]).find((c) => board.columns[c].includes(cardId));
  if (!from) return board;

  const fromIndex = board.columns[from].indexOf(cardId);
  const source = board.columns[from].filter((id) => id !== cardId);

  // Same column: the list shrank by one before the insertion point, so adjust
  const target = from === to ? source : [...board.columns[to]];
  const index = from === to && fromIndex < toIndex ? toIndex - 1 : toIndex;
  target.splice(Math.max(0, Math.min(index, target.length)), 0, cardId);

  return {
    ...board,
    columns: { ...board.columns, [from]: from === to ? target : source, [to]: target },
  };
}
```

(When `from === to`, `source` and `target` are the same array, so assigning it once is correct.)

### Native HTML5 version

```tsx
function Column({ id, title, board, onMove }: { id: ColumnId; title: string; board: Board; onMove: (cardId: string, to: ColumnId, index: number) => void }) {
  const [over, setOver] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  function indexFromPointer(clientY: number) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-card]") ?? []);
    const i = items.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return clientY < r.top + r.height / 2;
    });
    return i === -1 ? items.length : i;
  }

  return (
    <section
      aria-label={title}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}       // preventDefault enables dropping
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const cardId = e.dataTransfer.getData("text/plain");
        if (cardId) onMove(cardId, id, indexFromPointer(e.clientY));
      }}
      className={over ? "bg-hl-soft" : "bg-sunken"}
    >
      <h3>{title}</h3>
      <ul ref={listRef}>
        {board.columns[id].map((cardId) => (
          <li
            key={cardId}
            data-card
            draggable
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", cardId); e.dataTransfer.effectAllowed = "move"; }}
          >
            {board.cards[cardId].title}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`dragleave` also fires when moving over child elements, hence the `contains(relatedTarget)` check.

### Native vs dnd-kit

| Concern | Native HTML5 DnD | dnd-kit |
|---|---|---|
| Touch | Poor/unsupported | Pointer + touch sensors |
| Keyboard | None | Keyboard sensor with announcements |
| Drag preview | Browser ghost image | Custom `DragOverlay` |
| Sortable lists | Manual index maths | `@dnd-kit/sortable` |
| Collision detection | Manual | Strategies (closest corners, etc.) |
| Bundle | 0 KB | ~10–15 KB |

### Interview details
- **Optimistic persistence:** apply the move locally, then send `{ cardId, to, index }` (or a fractional rank) to the API; roll back on failure. Fractional indexing (LexoRank) avoids renumbering every card on the server.
- **Accessibility:** provide a "Move to…" menu on each card as a non-drag alternative and announce moves with an `aria-live` region.
- **Performance:** memoise cards; keep the dragging position out of React state (let the browser handle it) except for the hovered column.
- **Edge cases:** dropping on the same spot is a no-op; dragging out of the window; cancelling with Escape.
- **Why ids not objects in columns:** moving only shuffles strings, and card edits update one entry in `cards` without touching the columns.

## Follow-ups
- **How would you support dragging columns too?** — Keep a `columnOrder` array and use two sortable contexts, or the same `move` logic with a different type.
- **How do you avoid layout jumps while dragging?** — Render a placeholder with the card's height at the target index and use an overlay for the dragged clone.

## Common Mistakes
- Forgetting `preventDefault()` in `dragover`, so `drop` never fires.
- Splicing into state arrays directly.
- Off-by-one when moving down within the same column.

## Tips
- Lead with the normalised state and `moveCard`; the drag layer is a thin adapter.

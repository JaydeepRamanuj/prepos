---
title: "Build a file explorer tree with recursion, expand/collapse and add/delete"
level: hard
type: implement
tags: [tree, recursion, immutable-updates, file-explorer, a11y, keyboard]
related: [machine-coding/accordion, machine-coding/nested-comments, javascript/object-immutability-freeze]
---

## Question
Given nested JSON describing folders and files, render an expandable file explorer.

**Must-haves**
- Folders expand and collapse on click; files do not.
- Indentation shows depth.
- Add a file or folder inside a folder; delete any node.
- Updates are immutable.

**Stretch goals**
- Rename inline.
- Keyboard navigation (Arrow keys, Enter) with proper tree ARIA roles.
- Collapse all / expand all.

```ts
const data = [
  { id: "1", name: "src", isFolder: true, children: [{ id: "2", name: "index.ts", isFolder: false }] },
];
```

## Clues
- A recursive `Node` component renders its own children; each folder owns its `open` state locally.
- Update the tree with a recursive pure function that returns new objects only along the changed path.
- Use stable ids, not array indexes, for keys and for finding nodes.

## Interview Answer
The data is a recursive structure, so the UI is a recursive `TreeNode` component: a file renders a row, a folder renders a row with a toggle and, when open, maps its children to more `TreeNode`s with increased depth. Expansion state is local to each folder, so toggling one never re-renders siblings. Mutations (add, delete, rename) are pure functions over the tree that walk by id and return a new tree, copying only the nodes on the path to the change and sharing everything else, which keeps React's referential checks cheap. The parent holds the tree in state and passes callbacks (`onAdd(parentId)`, `onDelete(id)`) down; a `useReducer` is a good fit once there are three or more operations. For accessibility, the container has `role="tree"`, nodes `role="treeitem"` with `aria-expanded` for folders, and children grouped in `role="group"`.

## Explanation
### Rendering

```tsx
type TreeNodeData = { id: string; name: string; isFolder: boolean; children?: TreeNodeData[] };

function Node({ node, depth, onAdd, onDelete }: {
  node: TreeNodeData; depth: number;
  onAdd: (parentId: string, isFolder: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li role="treeitem" aria-expanded={node.isFolder ? open : undefined}>
      <div style={{ paddingLeft: depth * 16 }} className="flex items-center gap-2">
        {node.isFolder ? (
          <button aria-label={open ? "Collapse" : "Expand"} onClick={() => setOpen((o) => !o)}>{open ? "▾" : "▸"}</button>
        ) : <span className="w-4" />}
        <span>{node.name}</span>
        {node.isFolder && (
          <>
            <button onClick={() => { setOpen(true); onAdd(node.id, false); }}>+ file</button>
            <button onClick={() => { setOpen(true); onAdd(node.id, true); }}>+ folder</button>
          </>
        )}
        <button aria-label={`Delete ${node.name}`} onClick={() => onDelete(node.id)}>✕</button>
      </div>
      {node.isFolder && open && (
        <ul role="group">
          {node.children?.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} onAdd={onAdd} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </li>
  );
}
```

### Immutable tree updates

```ts
function addChild(nodes: TreeNodeData[], parentId: string, child: TreeNodeData): TreeNodeData[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...(n.children ?? []), child] };
    if (n.children) return { ...n, children: addChild(n.children, parentId, child) };
    return n;                                    // untouched branches keep identity
  });
}

function removeNode(nodes: TreeNodeData[], id: string): TreeNodeData[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => (n.children ? { ...n, children: removeNode(n.children, id) } : n));
}

function renameNode(nodes: TreeNodeData[], id: string, name: string): TreeNodeData[] {
  return nodes.map((n) =>
    n.id === id ? { ...n, name } : n.children ? { ...n, children: renameNode(n.children, id, name) } : n,
  );
}
```

The `addChild` above rebuilds every sibling object on the way down. If you want strict structural sharing, return the original node when the recursive result is unchanged. For interviews, the simple version is accepted; mention the optimisation.

### Wiring

```tsx
export function FileExplorer({ initial }: { initial: TreeNodeData[] }) {
  const [tree, setTree] = useState(initial);

  const onAdd = (parentId: string, isFolder: boolean) => {
    const name = prompt(isFolder ? "Folder name" : "File name");   // replace with an inline input in real UI
    if (!name) return;
    setTree((t) => addChild(t, parentId, { id: crypto.randomUUID(), name, isFolder, children: isFolder ? [] : undefined }));
  };
  const onDelete = (id: string) => setTree((t) => removeNode(t, id));

  return <ul role="tree">{tree.map((n) => <Node key={n.id} node={n} depth={0} onAdd={onAdd} onDelete={onDelete} />)}</ul>;
}
```

### Alternatives and trade-offs
- **Open state in a `Set<string>` at the top:** enables expand-all/collapse-all, persistence and deep links, at the cost of passing it down (or using context).
- **Normalised store** (`byId` plus `childIds`): updates are O(1) instead of walking the tree, and moves/reorders are simpler. Worth it for large trees or drag and drop.
- **Large trees:** flatten visible nodes into a list and virtualise it.
- **Lazy loading:** fetch children when a folder first opens.
- **Keyboard:** Up/Down move between visible items, Right expands or enters, Left collapses or goes to parent (WAI-ARIA tree pattern); use roving `tabIndex`.

## Follow-ups
- **How would you implement search that auto-expands matches?** — Compute the set of ancestor ids of every match and force those folders open.
- **How would you add drag-and-drop move?** — Remove the node (keeping it), then insert under the target; reject dropping a folder into its own descendant.

## Common Mistakes
- Mutating `children` arrays directly.
- Using array index as key, which breaks after deletions.
- Allowing deletion of the root without handling empty state.

## Tips
- Say "recursive component for rendering, recursive pure function for updates".

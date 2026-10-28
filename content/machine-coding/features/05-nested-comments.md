---
title: "Build nested comments with replies, edit, delete and collapse"
level: hard
type: implement
tags: [comments, recursion, tree, immutable-updates, optimistic-ui, forms]
related: [machine-coding/file-explorer-tree, machine-coding/todo-app, react/controlled-vs-uncontrolled]
---

## Question
Build a Reddit-style comment thread.

**Must-haves**
- Add a top-level comment.
- Reply to any comment at any depth.
- Edit and delete your own comment.
- Collapse a thread to hide its replies.
- Show reply counts and relative time.

**Stretch goals**
- Upvote with sorting by votes.
- Limit visual indentation after depth N ("Continue thread").
- Persist to `localStorage`.

## Clues
- Each comment owns `replies: Comment[]`, so the renderer is recursive.
- Write one generic `updateTree(nodes, id, fn)` helper and build edit, delete and reply on top of it.
- Only one reply box should be open at a time; keep that id in the parent state.

## Interview Answer
I model a comment as `{ id, author, text, createdAt, replies }` and keep the root list in a reducer. All operations go through a recursive pure helper that finds the node by id and returns a new tree: reply appends to `replies`, edit replaces `text`, delete filters the node out (or replaces it with "[deleted]" if it has replies, so the thread structure survives). The `Comment` component renders its content, action buttons and, unless collapsed, maps `replies` to child `Comment`s. The parent keeps `replyingTo` and `editingId` so only one form is open at once, and it passes stable callbacks down. Collapse state is local to each comment. Because comments can be long and deep, I would cap indentation on mobile and consider flattening to a normalised `byId` plus `childIds` structure if updates or sorting became expensive.

## Explanation
### Data and the generic helper

```ts
type Comment = { id: string; author: string; text: string; createdAt: number; deleted?: boolean; replies: Comment[] };

function updateTree(nodes: Comment[], id: string, fn: (c: Comment) => Comment | null): Comment[] {
  return nodes.flatMap((n) => {
    if (n.id === id) {
      const next = fn(n);
      return next ? [next] : [];                    // null removes the node
    }
    return [{ ...n, replies: updateTree(n.replies, id, fn) }];
  });
}

type Action =
  | { type: "add"; parentId: string | null; comment: Comment }
  | { type: "edit"; id: string; text: string }
  | { type: "delete"; id: string };

function reducer(state: Comment[], a: Action): Comment[] {
  switch (a.type) {
    case "add":
      return a.parentId === null
        ? [...state, a.comment]
        : updateTree(state, a.parentId, (c) => ({ ...c, replies: [...c.replies, a.comment] }));
    case "edit":
      return updateTree(state, a.id, (c) => ({ ...c, text: a.text }));
    case "delete":
      // keep the node as a tombstone if it has replies, otherwise remove it
      return updateTree(state, a.id, (c) => (c.replies.length ? { ...c, deleted: true, text: "[deleted]" } : null));
  }
}
```

### Components

```tsx
function CommentItem({ c, depth, ui, dispatch }: { c: Comment; depth: number; ui: Ui; dispatch: Dispatch }) {
  const [collapsed, setCollapsed] = useState(false);
  const count = countReplies(c);

  return (
    <li style={{ marginLeft: Math.min(depth, 6) * 16 }}>
      <header>
        <button aria-expanded={!collapsed} onClick={() => setCollapsed((v) => !v)}>{collapsed ? `[+] ${count} replies` : "[–]"}</button>
        <strong>{c.author}</strong> <time dateTime={new Date(c.createdAt).toISOString()}>{timeAgo(c.createdAt)}</time>
      </header>

      {!collapsed && (
        <>
          {ui.editingId === c.id ? (
            <CommentForm initial={c.text} onSubmit={(text) => { dispatch({ type: "edit", id: c.id, text }); ui.setEditingId(null); }} />
          ) : (
            <p>{c.text}</p>
          )}
          {!c.deleted && (
            <div>
              <button onClick={() => ui.setReplyingTo(c.id)}>Reply</button>
              <button onClick={() => ui.setEditingId(c.id)}>Edit</button>
              <button onClick={() => dispatch({ type: "delete", id: c.id })}>Delete</button>
            </div>
          )}
          {ui.replyingTo === c.id && (
            <CommentForm
              onSubmit={(text) => {
                dispatch({ type: "add", parentId: c.id, comment: newComment(text) });
                ui.setReplyingTo(null);
              }}
            />
          )}
          <ul>
            {c.replies.map((r) => <CommentItem key={r.id} c={r} depth={depth + 1} ui={ui} dispatch={dispatch} />)}
          </ul>
        </>
      )}
    </li>
  );
}

const countReplies = (c: Comment): number => c.replies.reduce((n, r) => n + 1 + countReplies(r), 0);
```

`CommentForm` is a small controlled textarea that trims input, disables submit when empty and clears itself after submitting.

### Design notes
- **Tombstones:** deleting a parent with replies would orphan its children; showing "[deleted]" keeps the conversation readable.
- **Authorisation:** Edit/Delete show only when `c.author === currentUser`; the server must enforce it too.
- **IDs and time:** generate ids with `crypto.randomUUID()`; format times with `Intl.RelativeTimeFormat`.
- **Normalised alternative:** `{ byId: Record<id, Comment>, childIds: Record<id, id[]> }` makes edit and reply O(1) and sorting per level easy, with a `selectTree` for rendering.
- **Performance:** wrap `CommentItem` in `React.memo` and keep callbacks stable so editing one comment does not re-render the whole thread; structural sharing (returning the same object for untouched branches) makes that effective.
- **Security:** render text as text (React escapes it). Never use `dangerouslySetInnerHTML` for user comments.
- **Optimistic UI:** add the comment locally with a temporary id, send to the API, then replace the id or roll back on failure.

## Follow-ups
- **How would you sort replies by votes at each level?** — Sort `replies` when rendering (`useMemo`) or store sort order per parent; with the normalised shape, sort `childIds[parentId]`.
- **How do you load a huge thread?** — Load top-level comments first, fetch replies lazily on expand ("load 12 more replies"), and virtualise the flattened visible list.

## Common Mistakes
- Mutating `replies` in place.
- Storing the open reply form in every comment so many boxes stay open.
- Removing a parent and silently dropping its replies.

## Tips
- Start with the recursive `updateTree` helper; everything else becomes one-liners.

---
title: "Explain event propagation and implement event delegation"
level: hard
type: implement
tags: [events, bubbling, capturing, delegation, dom]
related: [browser-security/rendering-pipeline, javascript/debounce]
---

## Question
1. Explain the capture and bubble phases. What is the difference between `stopPropagation()`, `stopImmediatePropagation()` and `preventDefault()`?
2. Implement a `delegate` helper so one listener on a parent handles clicks on any matching child, including children added later:

```js
const off = delegate(document.querySelector("#todo-list"), "click", ".delete-btn", (event, btn) => {
  btn.closest("li").remove();
});
// later
off();
```

## Clues
- An event travels from `window` down to the target, then back up. Which phase does a normal `addEventListener` listen in?
- `event.target` might be an icon *inside* the button. Which DOM method walks up to the nearest matching ancestor?
- Make sure the match is still inside the container, and return a function that removes the listener.

## Interview Answer
A DOM event has three phases: capture, where it travels from `window` down through the ancestors to the target; the target phase; and bubble, where it travels back up. `addEventListener` listens in the bubble phase by default, and `{ capture: true }` makes it listen on the way down. `stopPropagation()` stops the event moving to further elements but lets other listeners on the current element run; `stopImmediatePropagation()` stops those too; `preventDefault()` is unrelated to propagation — it cancels the browser's default action like following a link or submitting a form. Delegation uses bubbling: I attach one listener to a parent, and in the handler I call `event.target.closest(selector)` to find the matching child, check that it is inside the container, and call the handler with it. That works for elements added later and uses one listener instead of hundreds.

## Explanation
### The three phases

```txt
            window
              │  ▲
           document
              │  │
   capture  <ul>  │  bubble
     ▼        │   │
            <li>  │
              │   │
          <button>  ← target phase
```

```js
ul.addEventListener("click", () => console.log("ul bubble"));
ul.addEventListener("click", () => console.log("ul capture"), { capture: true });
btn.addEventListener("click", () => console.log("button"));
// click the button → "ul capture", "button", "ul bubble"
```

### stop vs prevent

| Method | Effect |
|---|---|
| `stopPropagation()` | Event does not reach further elements; other listeners on the *current* element still run |
| `stopImmediatePropagation()` | Also skips remaining listeners on the current element |
| `preventDefault()` | Cancels the default action (link navigation, form submit, checkbox toggle); propagation continues |

`preventDefault()` does nothing inside a `{ passive: true }` listener — passive tells the browser it can scroll without waiting for your handler.

### The implementation

```js
function delegate(container, type, selector, handler, options) {
  function listener(event) {
    // target may be a Text node's parent, an <svg> icon inside the button, etc.
    const start = event.target instanceof Element ? event.target : event.target.parentElement;
    const match = start?.closest(selector);

    // closest() can walk past the container — ignore matches outside it
    if (!match || !container.contains(match)) return;

    handler.call(match, event, match);
  }

  container.addEventListener(type, listener, options);
  return () => container.removeEventListener(type, listener, options);
}
```

Why each piece matters:
- **`closest(selector)`** — the click often lands on a child (`<svg>`, `<span>`) of the button. `closest` walks up from the target, including the target itself.
- **`container.contains(match)`** — without it, `.delete-btn` matching an ancestor *outside* the list would trigger your handler.
- **Returning an unsubscribe function** — the same `listener` reference must be passed to `removeEventListener`, so keep it in the closure. This also fits neatly into a React `useEffect` cleanup.

### Why delegate
- **One listener** instead of one per row — less memory, faster setup for big lists.
- **Dynamic content** — rows added later are handled automatically.
- **Simpler cleanup** — remove one listener, not hundreds.

### Events that do not bubble
`focus`/`blur` do not bubble — delegate `focusin`/`focusout` instead. `mouseenter`/`mouseleave` do not bubble — use `mouseover`/`mouseout`. Alternatively listen in the capture phase, which still passes through ancestors.

### React and delegation
Since React 17, React attaches one listener per event type to the **root container** and dispatches to your `onClick` props itself — delegation is built in. Calling `e.stopPropagation()` in a React handler stops React's synthetic propagation; native listeners on `document` still see the event because it already bubbled to the root.

## Follow-ups
- **What is `event.target` vs `event.currentTarget`?** — `target` is where the event originated; `currentTarget` is the element whose listener is running now (the container in delegation).
- **When should you not delegate?** — For very high-frequency events like `mousemove` over a huge subtree, the per-event `closest` work adds up; and for non-bubbling events unless you use capture.
- **How do you stop a parent's click handler from closing a dropdown?** — Prefer checking `dropdown.contains(event.target)` in the parent over `stopPropagation`, which can break analytics and other listeners.

## Common Mistakes
- Using `event.target.matches(selector)` — fails when the click lands on a child element of the button.
- Confusing `stopPropagation` with `preventDefault`; a link still navigates after `stopPropagation`.
- Passing a new arrow function to `removeEventListener`, so nothing is removed.
- Forgetting the capture flag must match when removing: a listener added with `{ capture: true }` must be removed with it too.

## Tips
- Draw the down-then-up arrow on the whiteboard; it answers half the follow-ups.
- Mnemonic for the helper: **closest, contains, call**.

---
title: "Composition with children and slot props: avoiding prop drilling"
level: medium
type: concept
tags: [composition, children, slots, prop-drilling, patterns]
related: [react/one-way-data-flow, react/lifting-state-up, react/use-context-rerenders, react/compound-components]
---

## Question
What is composition in React? How do `children` and "slot" props (props that accept JSX) help avoid prop drilling and rigid components? Refactor a `Card` that takes `title`, `showFooter`, `footerText`, `icon` and `isCompact` props.

## Interview Answer
Composition means building UIs by combining components, passing content in rather than configuring it with many flags. `children` is the default slot, and extra named props such as `header` or `footer` can accept JSX, so the parent decides what is rendered while the component controls layout and behaviour. This avoids prop drilling because the intermediate component just renders `children` and doesn't need to know what data the deeper element needs; the element is created where the data lives. It also avoids "boolean prop explosion" like `showFooter` and `isCompact`. A bonus: passing elements as props keeps their identity stable when the wrapper re-renders, helping performance.

## Explanation
### Before: configuration props

```tsx
<Card title="Plan" showFooter footerText="Cancel anytime" icon="star" isCompact />
```

Every new variant adds another prop and another branch inside `Card`.

### After: composition

```tsx
function Card({ children }: { children: React.ReactNode }) {
  return <section className="card">{children}</section>;
}
Card.Header = ({ children }: { children: React.ReactNode }) => <header>{children}</header>;
Card.Footer = ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>;

<Card>
  <Card.Header><StarIcon /> Plan</Card.Header>
  <PlanDetails />
  <Card.Footer>Cancel anytime</Card.Footer>
</Card>
```

Or with named slots:

```tsx
function Layout({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="grid">
      <aside>{sidebar}</aside>
      <main>{children}</main>
    </div>
  );
}

<Layout sidebar={<UserMenu user={user} />}>
  <Feed />
</Layout>
```

### Preventing prop drilling

```tsx
// Drilling: Page -> Header -> Nav -> Avatar all carry `user`
// Composition: the page creates <Avatar user={user} /> and hands it down as a slot
function Page({ user }: { user: User }) {
  return <Header avatar={<Avatar user={user} />} />;
}
function Header({ avatar }: { avatar: ReactNode }) {
  return <nav>{avatar}</nav>;   // Header knows nothing about `user`
}
```

### Performance benefit
`children` elements are created by the parent; when `Layout` re-renders because of its own state, the `children` prop is the same element reference, so React skips re-rendering them.

```tsx
function Resizable({ children }: { children: ReactNode }) {
  const [w, setW] = useState(0);        // state changes often
  return <div onPointerMove={(e) => setW(e.clientX)}>{children}</div>;   // children don't re-render
}
```

### When to use what

| Need | Tool |
|---|---|
| Pass content into a component | `children` / slot props |
| Many levels, many consumers | Context |
| Parent renders per-item content | render props or a function child |
| Related parts share implicit state | compound components |

### Guidelines
- Prefer `children` and slots over booleans that toggle regions.
- Keep slot names descriptive (`header`, `actions`).
- Typing: `ReactNode` for anything renderable; `ReactElement` if it must be an element.
- Don't over-compose: two props are fine when a component is truly simple.

## Follow-ups
- **Why not just use context?** — Context couples consumers to a provider and re-renders them; composition has none of that for simple pass-through.
- **Can children be a function?** — Yes (render prop), when the parent needs to supply data.

## Common Mistakes
- Adding a prop for every variation.
- Drilling props through components that don't use them.

## Tips
- Say "inversion of control: the caller decides what renders".

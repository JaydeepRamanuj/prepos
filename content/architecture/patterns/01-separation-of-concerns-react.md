---
title: "How do you separate logic from UI in React today? Is container/presentational still relevant?"
level: easy
type: concept
tags: [separation-of-concerns, custom-hooks, container-presentational, server-components]
related: [architecture/feature-vs-layer-folders, architecture/api-client-layer, testing/testing-hooks-async-ui]
---

## Question
Explain the container/presentational pattern. Is it still how you separate concerns in modern React, or do hooks and Server Components change the answer?

## Interview Answer
Container/presentational splits a component in two. The container fetches data and holds state, and the presentational component only receives props and renders. The idea still holds, but hooks changed how it is implemented. I no longer write wrapper container components. I put the logic in a custom hook such as `useCart()` and keep the component focused on markup. In the App Router there is a third option: an async Server Component can play the container role by fetching data on the server and passing plain props to a presentational Client Component. The goal is unchanged. UI components should be easy to read, reuse and test, and the logic should live somewhere you can change without touching JSX.

## Explanation
### The classic pattern (pre-hooks)

```tsx
// Container: knows HOW to get data
class UserListContainer extends React.Component { /* fetch in componentDidMount, setState... */ }

// Presentational: knows HOW it looks
function UserList({ users }: { users: User[] }) {
  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

It was popular because class components made logic hard to reuse. Dan Abramov, who popularized the pattern, later said he no longer recommends splitting components this way dogmatically, because hooks solve the reuse problem.

### Today: hooks are the logic layer

```tsx
// use-users.ts — logic, no JSX
export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: fetchUsers });
}

// UserList.tsx — UI, uses the hook
export function UserList() {
  const { data: users = [], isPending, error } = useUsers();
  if (isPending) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <UserListView users={users} />;
}

// UserListView.tsx — pure, prop-driven (optional extra split)
export function UserListView({ users }: { users: User[] }) {
  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

Extract a pure "view" component only when it pays off: it is reused with different data, or you want to show its states in Storybook. Otherwise one component calling one hook is fine.

### With Server Components: the server is the container

```tsx
// app/users/page.tsx — Server Component fetches
export default async function UsersPage() {
  const users = await getUsers(); // data layer, runs on server
  return <UserListView users={users} />;
}
```

### The layers in a modern React app

| Concern | Where it lives |
|---|---|
| Rendering, markup, styling | Components |
| UI state and behavior (toggle, form state) | Component state or custom hooks |
| Server state (fetching, caching) | TanStack Query hooks, or Server Components |
| Data access, API shapes | API client / data layer modules |
| Pure business rules (price calculation) | Plain TS functions, easiest to unit test |

## Follow-ups
- **Why put business rules in plain functions rather than hooks?** — A function like `calculateTotal(items, coupon)` needs no React to test, can run on server and client, and stays portable. Hooks should orchestrate, not contain all the logic.
- **Does the React Compiler change this?** — No. It automates memoization, not separation of concerns.

## Common Mistakes
- Creating a container/view pair for every component, which doubles the file count for no benefit.
- Putting `fetch` calls with URLs and error parsing directly inside components instead of a hook or data layer.

## Tips
- One sentence to remember: "**The pattern survived; the implementation moved into hooks and Server Components.**"

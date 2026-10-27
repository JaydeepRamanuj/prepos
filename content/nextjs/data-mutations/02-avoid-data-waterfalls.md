---
title: "This page takes 1.5s to render. Find the waterfall and fix it"
level: medium
type: implement
tags: [data-fetching, waterfalls, promise-all, suspense, streaming, preload]
related: [nextjs/fetching-in-server-components, nextjs/slow-ttfb-dynamic-page, nextjs/dashboard-partial-personalization]
---

## Question
Each data function below takes about 500 ms. The page takes about 1.5 s before anything shows. Explain why, then rewrite it so it is as fast as possible. Assume `getAlbums` and `getTourDates` only need the `username`, not the artist object.

```tsx
// app/artist/[username]/page.tsx
export default async function ArtistPage({ params }: PageProps<"/artist/[username]">) {
  const { username } = await params;
  const artist = await getArtist(username);
  const albums = await getAlbums(username);
  const tours = await getTourDates(username);

  return (
    <>
      <h1>{artist.name}</h1>
      <Albums list={albums} />
      <Tours list={tours} />
    </>
  );
}
```

## Clues
- `await` pauses the function. What does that do to the next line's request?
- Which requests actually depend on each other's results?
- Even after you parallelise, the page waits for the slowest call. Can the slow parts arrive later?

## Interview Answer
Each `await` blocks the next line, so the three independent requests run one after another: 500 + 500 + 500 ms. That is a request waterfall. None of them depends on another's result, so I start all three before awaiting and combine them with `Promise.all`, which brings the total down to the slowest single call, about 500 ms. Then I go further and stream: the heading needs the artist, but albums and tours can each be their own async Server Component inside a `<Suspense>` boundary, so the shell and heading paint first and each section streams in when ready. When a request really does depend on another, I keep it sequential but push it into a child component behind Suspense so it doesn't block unrelated UI.

## Explanation
### Why it is slow

```txt
getArtist   |=====|
getAlbums         |=====|
getTourDates            |=====|
render                        |→ 1.5 s
```

`await` suspends the function until the promise settles, so the second request isn't even *started* until the first finishes.

### Fix 1: start everything, then await once

```tsx
export default async function ArtistPage({ params }: PageProps<"/artist/[username]">) {
  const { username } = await params;

  // Start all three requests immediately (no await yet)
  const artistP = getArtist(username);
  const albumsP = getAlbums(username);
  const toursP = getTourDates(username);

  const [artist, albums, tours] = await Promise.all([artistP, albumsP, toursP]);

  return (
    <>
      <h1>{artist.name}</h1>
      <Albums list={albums} />
      <Tours list={tours} />
    </>
  );
}
```

Now the page waits about 500 ms, the slowest call. Use `Promise.allSettled` if one failing section should not fail the whole page.

### Fix 2: stream each section with Suspense
With `Promise.all`, nothing shows until all three resolve. Moving each read into the component that renders it lets React send the shell first and fill in each region separately:

```tsx
import { Suspense } from "react";

export default async function ArtistPage({ params }: PageProps<"/artist/[username]">) {
  const { username } = await params;

  return (
    <>
      <Suspense fallback={<h1>Loading…</h1>}>
        <ArtistName username={username} />
      </Suspense>
      <Suspense fallback={<AlbumsSkeleton />}>
        <AlbumsSection username={username} />
      </Suspense>
      <Suspense fallback={<ToursSkeleton />}>
        <ToursSection username={username} />
      </Suspense>
    </>
  );
}

async function ArtistName({ username }: { username: string }) {
  const artist = await getArtist(username);
  return <h1>{artist.name}</h1>;
}

async function AlbumsSection({ username }: { username: string }) {
  return <Albums list={await getAlbums(username)} />;
}

async function ToursSection({ username }: { username: string }) {
  return <Tours list={await getTourDates(username)} />;
}
```

Sibling Server Components inside separate boundaries render concurrently, so these requests still run in parallel, and each region appears as soon as its own data is ready.

### When requests really are dependent
If `getPlaylists` needs `artist.id`, the dependency is real. You can't remove it, but you can contain it:

```tsx
const artist = await getArtist(username);         // must come first
return (
  <>
    <h1>{artist.name}</h1>
    <Suspense fallback={<p>Loading playlists…</p>}>
      <Playlists artistId={artist.id} />            {/* waits only inside this boundary */}
    </Suspense>
  </>
);
```

### The preload pattern
When a component renders after some unrelated blocking check, start its request early by calling the fetch function without `await`, and have the component call it again (deduped by `fetch` memoization or `React.cache`):

```tsx
// item.tsx
export const preload = (id: string) => {
  void getItem(id); // kick off, don't wait
};

// page.tsx
preload(id);
const isAvailable = await checkIsAvailable(id); // runs in parallel with getItem
return isAvailable ? <Item id={id} /> : null;    // reuses the in-flight request
```

### Waterfalls you don't see in one file
- A layout awaits `getUser()`, and then the page awaits `getOrders()`. Layouts and pages render in parallel, but a **parent component** awaiting before rendering its children delays the children's fetches.
- Client components fetching in `useEffect` after a server render form a server → client waterfall.

## Follow-ups
- **What is the trade-off between `Promise.all` and Suspense streaming?** — `Promise.all` gives one consistent paint but waits for the slowest call. Suspense gets content on screen sooner but needs good skeletons to avoid layout shift.
- **How do you spot waterfalls in production?** — Server timing or tracing (OpenTelemetry), or log timestamps per fetch. In dev, `logging.fetches` in `next.config` prints fetch timing.
- **Can you parallelise Server Actions the same way?** — No. The client dispatches Server Actions one at a time. Do parallel work inside a single action or in a Server Component.

## Common Mistakes
- Calling `Promise.all([await a(), await b()])`. The awaits inside the array still run sequentially.
- Wrapping the whole page in one `<Suspense>`, which streams but still shows one big spinner.
- Parallelising requests that really are dependent and then passing `undefined` IDs.

## Tips
- Draw the timeline (three bars in a row, then three stacked). Interviewers like seeing that you think in timelines.
- Mnemonic: **start early, await late, stream the slow parts.**

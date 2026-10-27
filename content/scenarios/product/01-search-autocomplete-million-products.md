---
title: "Design search autocomplete for a catalogue of a million products"
level: hard
type: scenario
tags: [search, autocomplete, debounce, caching, ranking, performance, accessibility]
related: [machine-coding/autocomplete-typeahead, browser-security/http-caching, backend/db-indexes]
---

## Question
Product asks for an instant search box on an e-commerce site with 1,000,000 products. Suggestions should appear as the user types, be relevant, and feel fast on mid-range phones. How do you design it end to end, and what do you decide on the frontend versus the backend?

## Clues
- The browser cannot download the whole catalogue; the index lives on a server.
- Latency has a budget: input → suggestions in roughly 100–200 ms feels instant.
- Most queries repeat, so caching and prefix reuse matter.

## Interview Answer
I'd split it into a fast suggestion service and a thin, careful UI. Backend: a dedicated search engine (Elasticsearch/OpenSearch, Typesense, Algolia or Meilisearch) with an edge n-gram or completion index on product names, categories and brands, ranked by text match plus popularity/availability, returning a small payload (top 8 with id, name, thumbnail URL, category) from an endpoint like `GET /suggest?q=nik&limit=8`, cached at the CDN by normalised query. Frontend: an accessible combobox that debounces input by roughly 150–250 ms, starts requests only after 2 characters, cancels stale ones with `AbortController`, keeps previous suggestions visible while loading, caches results per query in memory (and reuses a longer cached prefix to filter locally while the new request is in flight), supports keyboard navigation and ARIA combobox semantics, handles IME composition, and navigates to a full results page on Enter. I'd also add typo tolerance and "recent/popular searches" for empty input, measure p95 latency and zero-result rate, and degrade gracefully on errors by letting the user still submit the full search.

## Explanation
### Architecture
```txt
Input ─debounce─► GET /suggest?q=nik ──► CDN (cache by normalised q, short TTL)
                                         └─► search service (n-gram index) ─► top 8
UI: combobox + in-memory cache + AbortController
Enter ─► /search?q=nike+air  (full results: filters, facets, pagination, SSR)
```

### Backend choices
- **Don't use `LIKE '%q%'` on the primary database** at this scale: no index can serve a leading wildcard efficiently. Use a search engine with edge n-grams/completion suggesters, or a trigram index in Postgres (`pg_trgm`) for smaller catalogues.
- **Ranking**: text relevance, popularity (sales/clicks), availability, personalisation later. Boost exact prefix matches.
- **Typo tolerance** (fuzziness) and synonyms ("tee" ↔ "t-shirt"), normalisation (case, accents, Unicode).
- **Payload**: small and flat. Return only what the dropdown renders; fetch details on the results page.
- **Query log pipeline** for popular and trending suggestions and analytics.
- **Rate limiting** and abuse protection; the suggest endpoint is a cheap target.

### Frontend behaviour
- **Debounce** 150–250 ms, min length 2, trim and lowercase for the cache key.
- **Cancel** in-flight requests when the query changes; ignore out-of-order responses.
- **Prefix reuse**: if "nik" is cached, "nike" can be shown by filtering the cached list immediately, then replaced by the real response.
- **Prefetch/warm** with `<link rel="preconnect">` to the search host, and keep a persistent connection (HTTP/2 or 3).
- **Rendering**: limit to 8–10 items; no virtualisation required; avoid layout shift by reserving space.
- **Highlight** the matched part safely (split text, don't inject HTML).
- **Accessibility**: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, announcements for result counts via a live region; Escape closes; mouse down on option shouldn't blur the input.
- **Mobile**: large touch targets, `inputMode="search"`, `enterkeyhint="search"`, avoid covering the keyboard.
- **Resilience**: on error or timeout, hide the dropdown quietly and keep the form usable.

### Performance numbers to aim for
Server p95 under ~50 ms, network ~50 ms, render under 16 ms. CDN caching of popular prefixes drops load dramatically since a small set of queries dominates traffic (a Zipf-like distribution).

### Trade-offs
| Choice | Benefit | Cost |
|---|---|---|
| Hosted search (Algolia, Typesense Cloud) | fast to ship, great relevance tooling | cost per request, vendor lock-in |
| Self-hosted Elasticsearch/OpenSearch | control, scale | operational burden |
| Client-side index for small catalogues (MiniSearch, Fuse) | zero latency, offline | doesn't fit 1M items |
| Edge caching of suggestions | very fast, cheap | staleness, personalisation limits |

### Measuring success
Search-to-click rate, zero-result rate, time to first suggestion, conversion from suggestions, p95 latency, error rate. Run A/B tests on ranking changes.

## Follow-ups
- **How do you handle personalised suggestions with CDN caching?** — Cache the generic list at the edge and merge a small personalised list (recent searches) client-side or from a separate uncached call.
- **What about voice/typo queries like "nikee"?** — Fuzzy matching with edit distance limits on the search engine and a "did you mean" on the results page.

## Common Mistakes
- Querying the OLTP database with wildcard LIKE on every keystroke.
- No cancellation, leading to flicker from out-of-order responses.
- Returning huge payloads for a dropdown.

## Tips
- Lead with the split: suggestion service vs full search, then the UI details.

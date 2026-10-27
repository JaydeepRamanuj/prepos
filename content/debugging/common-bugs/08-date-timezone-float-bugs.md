---
title: "Find the date, time zone and floating point bugs in this checkout code"
level: advanced
type: debugging
tags: [dates, timezones, floating-point, intl, money, temporal]
related: [debugging/hydration-mismatch, debugging/works-locally-not-in-production]
---

## Question
A US customer reports that their delivery date is one day early and the order total shows `₹ 0.30000000000000004` discount. Find every bug.

```ts
// API returns: { deliveryDate: "2026-11-05", items: [{ price: 0.1 }, { price: 0.2 }], discountPct: 10 }

function formatDelivery(deliveryDate: string) {
  const d = new Date(deliveryDate);
  return `${d.getDate()}/${d.getMonth()}/${d.getFullYear()}`;
}

function discount(items: { price: number }[]) {
  const total = items.reduce((sum, i) => sum + i.price, 0);
  return total;
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt) < new Date(); // expiresAt: "2026-11-05 23:59:59"
}

const nextWeek = new Date();
nextWeek.setDate(nextWeek.getDate() + 7);
```

## Clues
- How does `new Date("2026-11-05")` parse a date-only string — local time or UTC? And `getDate()` reads which?
- What does `getMonth()` return for November?
- Can `0.1` be stored exactly in binary floating point? How do payment systems store money?

## Interview Answer
There are four separate bugs. `new Date("2026-11-05")` treats a date-only ISO string as midnight UTC, but `getDate()` reads local time, so in any time zone behind UTC — the US — it becomes November 4th; and `getMonth()` is zero-based, so it prints 10 instead of 11. For a calendar date with no time I'd keep it as a string or parse it into year, month and day explicitly, and format with `Intl.DateTimeFormat` using `timeZone: "UTC"`. The total is a floating point issue: `0.1 + 0.2` is `0.30000000000000004` because those decimals have no exact binary representation, so I'd store and compute money in integer paise and only format at the edge with `Intl.NumberFormat`. Finally `"2026-11-05 23:59:59"` isn't a standard ISO format and has no offset, so parsing is implementation-dependent and local — the API should send an ISO instant with `Z` or an offset, and I compare instants. For new code, Temporal makes these distinctions explicit with `PlainDate` vs `Instant`, but its browser support still needs checking or a polyfill.

## Explanation
### Bug 1: date-only strings parse as UTC

```ts
new Date("2026-11-05");          // 2026-11-05T00:00:00Z  (UTC midnight)
// In New York (UTC−5): local time is Nov 4, 19:00
new Date("2026-11-05").getDate(); // 4   ← off by one
new Date("2026-11-05T00:00");    // local midnight — date-time without offset is LOCAL
```

The spec treats date-only ISO forms as UTC but date-time forms without an offset as local time — an inconsistency that causes most "one day off" bugs. India is UTC+5:30, so developers in India often never see this bug: UTC midnight is 05:30 the same day.

**Fix:** a delivery date is a *calendar date*, not an instant. Don't convert it through a time zone.

```ts
function formatDelivery(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  // Build at UTC and format in UTC, so no time zone can shift the day
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
formatDelivery("2026-11-05"); // "5 Nov 2026" everywhere
```

### Bug 2: zero-based months
`getMonth()` returns 0–11. Manual string building invites this; `Intl.DateTimeFormat` avoids it and handles locale order (DD/MM vs MM/DD).

### Bug 3: floating point money

```ts
0.1 + 0.2;            // 0.30000000000000004
0.1 + 0.2 === 0.3;    // false
(1.005).toFixed(2);   // "1.00" — 1.005 is stored as 1.00499999...
```

Numbers are IEEE 754 doubles; most decimal fractions are approximations. Rules for money:
- Store and compute in **integer minor units** (paise/cents): `10 + 20 = 30` paise, exactly.
- Do percentage maths in integers and round once, deliberately: `Math.round(totalPaise * pct / 100)`.
- Format only for display:

```ts
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function discountPaise(items: { pricePaise: number }[], pct: number) {
  const total = items.reduce((sum, i) => sum + i.pricePaise, 0);
  return Math.round((total * pct) / 100);
}
inr.format(discountPaise([{ pricePaise: 10 }, { pricePaise: 20 }], 10) / 100); // "₹0.03"
```

Ideally the backend computes totals and the frontend displays them — never trust client-side price maths for payment.

### Bug 4: non-ISO timestamps and comparisons
`"2026-11-05 23:59:59"` (space, no offset) is not the ISO format; engines may parse it as local time or return `Invalid Date`. A user in India and one in California would see different expiry moments. Send **instants** as ISO 8601 with offset: `"2026-11-05T18:29:59Z"`, and compare with `getTime()`.

### Also watch
- `setDate(getDate() + 7)` adds 7 calendar days in local time — correct for "same time next week", but across a DST change it is not exactly `7 * 24h`. Decide which you mean.
- Server rendering formats dates in the server's time zone → hydration mismatch.

### Mental model: three different things

| Concept | Example | Store as |
|---|---|---|
| Instant | "payment captured" | ISO string with `Z` / epoch ms |
| Calendar date | birthday, delivery date | `"2026-11-05"` string |
| Wall-clock time in a place | "store opens 9:00 in Mumbai" | local time + IANA zone (`Asia/Kolkata`) |

Temporal (`Temporal.Instant`, `Temporal.PlainDate`, `Temporal.ZonedDateTime`) models exactly these. It has shipped in Firefox and Chrome, but check current support for your target browsers (Safari in particular) before using it without a polyfill.

## Follow-ups
- **Why not just use `toFixed(2)` everywhere?** — It rounds the already-imprecise binary value and returns a string; it hides errors in display but not in sums.
- **Would a date library fix bug 1?** — Only if you use it correctly; libraries still need you to choose between "date" and "instant". date-fns, Day.js or Temporal make it easier.
- **How would you test time zone bugs?** — Run tests with `TZ=America/New_York` (and a zone ahead of UTC), and use fake timers to pin "now".

## Common Mistakes
- Testing only in IST, where UTC-midnight dates happen to land on the same day.
- Storing money as floats in state, then summing.
- Sending timestamps without an offset and letting each client guess.

## Tips
- Separate the three concepts out loud — instant, calendar date, wall-clock-in-zone. It is the senior-sounding part.
- Remember: date-only → UTC, date-time without offset → local.

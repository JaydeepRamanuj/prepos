---
title: "Add internationalisation, including right-to-left languages, to an existing app"
level: hard
type: scenario
tags: [i18n, l10n, rtl, intl, next-intl, pluralization, locale-routing]
related: [html-css/responsive-design-user-preferences, nextjs/proxy-ts-replaces-middleware, performance/bundle-analysis]
---

## Question
The product is English-only and hard-codes strings, dates and currencies. Sales needs Hindi, German and Arabic within two quarters. How do you retrofit i18n, handle RTL, keep bundle size sane, and make it maintainable for translators?

## Clues
- Externalising strings is only part of it; formats, plurals, layout direction and fonts also change.
- Locale should be part of the URL and the rendering pipeline for SEO and caching.
- Translators and developers need a workflow, not a spreadsheet.

## Interview Answer
I'd tackle it in layers. Foundations: choose an i18n library that fits the App Router (e.g. `next-intl` or similar), add locale-prefixed routes (`/en`, `/de`, `/ar`) with detection in `proxy.ts` (cookie/`Accept-Language`, user-selectable), set `<html lang dir>` per locale, and load messages server-side so only the current locale's strings ship. Extract hard-coded strings into message catalogues using ICU MessageFormat for plurals, gender and variables (never concatenate strings), and use the platform's `Intl` APIs for dates, numbers, currencies, relative time and list formatting. For RTL, convert CSS to logical properties (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align: start`), use Tailwind's logical utilities and `rtl:`/`ltr:` variants only where necessary, mirror directional icons, and test bidirectional text. Add pseudo-localisation and lint rules to catch hard-coded strings, connect to a translation management system, and add visual tests per locale to catch overflow in longer languages. Roll out incrementally by feature area with fallback to English for missing keys.

## Explanation
### Routing and rendering
- Locale in the URL segment (`/[locale]/…`) gives crawlable, cacheable pages and `hreflang` alternates for SEO.
- Detect on first visit (cookie → `Accept-Language` → default), then persist the choice.
- `generateStaticParams` for locales; `setRequestLocale`-style helpers if the library requires them for static rendering.
- Server Components fetch messages on the server; Client Components get only the namespaces they need to keep bundles small.
- Set `lang` and `dir` on `<html>` (`dir="rtl"` for Arabic, Hebrew, Persian, Urdu).

### Messages
```json
{
  "cart": {
    "items": "{count, plural, =0 {Your cart is empty} one {# item} other {# items}}",
    "greeting": "Hello, {name}!"
  }
}
```
```tsx
const t = useTranslations("cart");
<p>{t("items", { count })}</p>
```
- Use ICU for plurals (Arabic has six plural categories; Hindi differs from English), select/gender, and rich text via placeholders instead of concatenation.
- Stable, descriptive keys; add context notes for translators.
- Don't build sentences from fragments (`t("you_have") + n + t("items")`), because word order differs by language.

### `Intl` formatting
```ts
new Intl.NumberFormat(locale, { style: "currency", currency: "INR" }).format(1234567.5);   // ₹12,34,567.50 for en-IN
new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: user.timeZone }).format(date);
new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day");
new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(["A", "B", "C"]);
```
Remember that locale (language/format) and currency/time zone are separate settings. Sorting uses `Intl.Collator`. Avoid server/client time zone mismatches that cause hydration errors by specifying `timeZone` explicitly.

### RTL layout
- Replace physical properties with logical ones: `margin-left` → `margin-inline-start`, `left` → `inset-inline-start`, `border-right` → `border-inline-end`, `float: left` → `float: inline-start`.
- Flexbox and grid flip automatically with `dir`; avoid hard-coded `row-reverse` hacks.
- Mirror directional icons (arrows, chevrons, progress), but not logos, media controls with conventional orientation, or numerals clocks.
- Bidirectional text: wrap user-generated strings with `<bdi>` or `dir="auto"`; phone numbers and code stay LTR.
- Fonts: ensure coverage for Devanagari and Arabic scripts (Noto families), adjust line-height and size, subset via `unicode-range`.
- Test components: carousels, sliders, tooltips, dropdown placement, scroll direction, animations that slide in.

### Content and layout resilience
German strings are often 30–40% longer; some scripts need more height. Avoid fixed widths, allow wrapping, test truncation, and use pseudo-locales (`[!!! Ĥéļļö ŵöŕļď !!!]` expanded text) in dev to expose layout and untranslated strings. Images containing text need localised variants.

### Workflow and tooling
- Source locale = English; others in a TMS (Crowdin, Lokalise, Phrase) with PR automation.
- CI checks for missing/unused keys, ICU syntax validity, and placeholder consistency across locales.
- Lint rule (`eslint-plugin-i18next` no-literal-string or similar) to catch new hard-coded strings; in repos without ESLint, a CI script can do the check.
- Fallback chain (ar → en) and logging of missing keys in production.
- Legal/regional differences (date formats, address forms, phone validation, tax display, right-to-left PDF/email templates) are product requirements, not only translation.

### Rollout plan
1. Infrastructure: routing, provider, `Intl` helpers, logical-CSS migration, CI checks.
2. Pilot one feature in two locales (one RTL) to validate the pipeline.
3. Migrate remaining areas gradually; freeze new hard-coded strings.
4. Visual regression in each locale; native-speaker review.
5. Launch with analytics on locale usage and missing-key rates.

## Follow-ups
- **Why not machine-translate everything at runtime?** — Quality, cost, latency and legal/brand risk; machine translation can seed drafts but should be reviewed and stored as catalogue entries.
- **How do you keep bundle size in check?** — Load messages per locale and namespace on the server, avoid shipping all locales to the client, and lazy-load rarely used namespaces.

## Common Mistakes
- Concatenating translated fragments.
- Using physical CSS properties and "fixing" RTL with overrides.
- Treating locale, currency and time zone as one setting.

## Tips
- Mention ICU plurals, logical properties and pseudo-localisation; they signal real experience.

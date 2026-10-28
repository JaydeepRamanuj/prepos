# shadcn-first migration list

Audit of `src/` (Oct 2026). The app already uses Button, Badge, Checkbox, Command, Dropdown, Label, Progress, Select, Separator, Tabs, Textarea, Toggle and ToggleGroup. The gaps below are hand-rolled equivalents and missing primitives. Rules: use semantic tokens (`bg-card`, `border-border`, `text-muted-foreground`), no new colors, no behavior changes. Run `npm run build` at the end.

## 0. Add primitives first (shadcn CLI, `new-york` style)

`npx shadcn@latest add card item empty kbd breadcrumb skeleton tooltip switch`

Then check each generated file for hardcoded neutral colors and map them to the notebook tokens. Wrap the app in `TooltipProvider` in `src/components/providers.tsx`.

## 1. Cards: `Card` / `CardContent`

Hand-written `rounded-xl border border-line bg-surface` boxes:

| File:line | What | Replace with |
|---|---|---|
| `src/components/question/answer-gate.tsx:33` | "Answer it out loud first" panel | `Card` + `CardContent` (`text-center`) |
| `src/app/tracks/[track]/[slug]/page.tsx:97` | Answer section wrapper | `Card` |
| `src/components/question/actions.tsx:65` | Solved/Revise/Bookmark bar | `Card` + `CardContent` (`flex-row`) |
| `src/components/question/mock-bar.tsx:18` | Sticky mock-round bar | `Card` with `border-primary bg-accent` override |
| `src/components/question/clues.tsx:13` | Dashed clue box | `Card` with `border-dashed shadow-none` |
| `src/components/revise-list-link.tsx:11` | Highlight link to /saved | `Card` inside the `Link` (`border-hl bg-hl-soft`) |

## 2. List containers + rows: `Item` (`ItemGroup`, `Item`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`)

The same `<ul divide-y … rounded-xl border bg-surface>` with `<Link … hover:bg-sunken/50>` rows is copy-pasted 7 times. Make one shared list component (or use `ItemGroup` + `Item asChild variant="outline"`), then replace:

| File:line (container) | File:line (row link) |
|---|---|
| `src/components/saved-lists.tsx:55` | `:61` |
| `src/app/revise/page.tsx:21` | `:24` |
| `src/app/tracks/[track]/[slug]/page.tsx:122` | `:125` (related questions) |
| `src/components/track-list.tsx:33` | `:36` |
| `src/components/track-browser.tsx:155` | `:175` (also has the solve toggle, see §3) |
| `src/components/mock-setup.tsx:71` | `:76` |

Row hover is inconsistent today (`hover:bg-sunken/50` vs `/60`); `Item` fixes that.

## 3. Raw HTML → shadcn

| File:line | Now | Use |
|---|---|---|
| `src/components/track-browser.tsx:161` | raw `<button aria-pressed>` solve circle | `Toggle` (or `Button variant="ghost" size="icon-sm"`) keeping the `aria-label` |
| `src/components/app-shell.tsx:54` | raw `<kbd>` ⌘K | `Kbd` |
| `src/app/tracks/[track]/[slug]/page.tsx:61` | hand-built `<nav>` breadcrumb | `Breadcrumb`, `BreadcrumbList`, `BreadcrumbLink asChild`, `BreadcrumbSeparator` |
| `src/app/tracks/[track]/[slug]/page.tsx:138` | prev/next `<nav>` of styled links | two `Button asChild variant="outline"` (keep the `<nav>` landmark) |
| `src/components/track-browser.tsx:192` | dashed empty-state div | `Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription` |
| `src/components/question/clues.tsx:29` | numbered circle span | `Badge variant="secondary"` with `rounded-full` |
| `src/components/app-shell.tsx:122` | `<span className="size-9" />` loading placeholder | `Skeleton className="size-9 rounded-full"` |
| `src/components/app-shell.tsx:113` | empty span while theme mounts | `Skeleton className="size-[18px]"` |
| `src/components/app-shell.tsx:159` | sync-error dot span | `Badge` (dot) wrapped in `Tooltip` showing `syncError` |

## 4. Tooltips on icon-only buttons: `Tooltip`

Add `Tooltip` around: theme toggle (`app-shell.tsx:107`), account button (`:136`), end-mock X (`question/mock-bar.tsx:35`), back chevron (`revise-feed.tsx:50`), and the bookmark/revise icon buttons in `question/actions.tsx` and `revise-feed.tsx` if they are icon-only. Keep the existing `aria-label`s.

## 5. Button variants instead of repeated overrides

Add to `src/components/ui/button.tsx` and `badge.tsx`, then delete the one-off class strings:

- `size="xl"` = `h-auto rounded-xl px-4 py-3 text-[15px]`. Used 4 times in `home-hero.tsx:39,49,55,61`.
- A pill shape (`shape="pill"` or `size="pill"`, `rounded-full`). Currently repeated in `question/actions.tsx:26,35,46`, `revise-feed.tsx:57,105,113`, `track-browser.tsx:26`, `question/clues.tsx:20`, `home-hero.tsx:58` (Badge).
- `home-hero.tsx:71`: `Button variant="link"` re-adds `underline underline-offset-2 text-primary`; the `link` variant should already do this. Fix the variant and drop the overrides.
- `note-box.tsx:35`: `variant="ghost"` with `h-auto px-0 hover:bg-transparent`. Use `variant="link"`.

## 6. Fix the primitives themselves (token drift)

`CLAUDE.md` says to use shadcn semantic tokens, but the primitives use notebook names: `border-line`, `bg-surface`, `text-ink-2`, `bg-sunken`, `border-line-strong` (see `ui/button.tsx:14-16`, `ui/badge.tsx:9-12`, `ui/select.tsx:18`, `ui/dropdown-menu.tsx:19`, `ui/textarea.tsx:10`, `ui/checkbox.tsx:14`). Replace with `border-border`, `bg-card`/`bg-popover`, `text-muted-foreground`, `bg-muted`, `border-input`. This is what lets the theme change in `globals.css` flow everywhere. Also remove the global `:focus-visible` override in `globals.css:138-147` in favor of `ring` utilities on the primitives (shadcn pattern: `focus-visible:ring-[3px] ring-ring/50`).

## 7. Optional, lower priority

- "Always show answers" checkbox (`answer-gate.tsx:26,41`) → `Switch` + `Label`.
- Replace the ~73 arbitrary `text-[Npx]` sizes with the Tailwind scale (`text-xs/sm/base`) except where the pixel size is deliberate.
- Hand-rolled mobile bottom nav (`app-shell.tsx:65`) has no shadcn equivalent; keep it.
- Desktop nav (`app-shell.tsx:35`) is fine as `Button asChild`; `NavigationMenu` is overkill.

## Proposed theme: "Indigo Ink"

Previews: `docs/theme-preview/theme-light.svg`, `docs/theme-preview/theme-dark.svg`. Not applied yet. Keeps the highlighter-yellow signature and the Literata / Instrument Sans / JetBrains Mono pairing. The shift is from cool blue-grey to a cleaner near-neutral base with an indigo-violet primary, softer shadows, and rounder corners (radius 12–16px).

| Token | Light | Dark |
|---|---|---|
| paper | `#f7f7fb` | `#0b0b14` |
| surface | `#ffffff` | `#14141f` |
| sunken | `#efeff6` | `#10101a` |
| ink / ink-2 / ink-3 | `#14142b` / `#53536e` / `#8a8aa3` | `#ececf7` / `#a6a6c0` / `#6f6f8c` |
| line / line-strong | `#e4e4ef` / `#cdcde0` | `#23233a` / `#34344f` |
| blue (primary) | `#5b4de8` | `#8f86ff` |
| blue-soft (accent) | `#ecebff` | `#1d1b3d` |
| primary-foreground | `#ffffff` | `#0b0b14` |
| hl / hl-soft / hl-ink | `#ffe45c` / `#fff4bd` / `#2d2600` | `#f0d84a` / `#3a3418` / `#1a1600` |
| good / good-soft | `#14946a` / `#dcf5ea` | `#4fd1a0` / `#12302a` |
| lv easy / medium / hard / advanced | `#14946a` / `#3b82f6` / `#e0801f` / `#c2409a` | `#4fd1a0` / `#6aa6ff` / `#f2a65a` / `#e87fc6` |
| code-bg | `#f4f4fa` | `#0e0e19` |

Also update the two `themeColor` hexes in `src/app/layout.tsx:19-20` to match `paper`.

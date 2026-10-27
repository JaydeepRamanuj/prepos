---
title: "Support white-label branding for many customers on one codebase"
level: hard
type: scenario
tags: [multi-tenant, theming, white-label, css-variables, domains, caching, nextjs]
related: [architecture/design-tokens-theming, nextjs/proxy-ts-replaces-middleware, browser-security/http-caching]
---

## Question
Enterprise customers want the product under their own brand: logo, colours, fonts, domain (`app.customer.com`) and sometimes copy. You have one Next.js codebase. How do you design tenant-aware theming and routing without forking the app or hurting performance and security?

## Clues
- Tenant identity usually comes from the hostname.
- Tokens as CSS variables make theming a data problem, not a code problem.
- Caching keyed incorrectly can leak one tenant's branding or data to another.

## Interview Answer
I'd treat a tenant as configuration resolved from the request hostname. `proxy.ts` (or the server layout) maps the host to a tenant id and loads the tenant's config (brand tokens, logo URLs, feature entitlements, locale) from a fast store with caching. The root layout then injects that tenant's design tokens as CSS variables on `<html>` (colours, radius, font family), while components only use semantic tokens (`bg-primary`, `text-foreground`), so one codebase renders any brand with no per-tenant builds. Assets (logos, fonts) come from tenant-scoped, validated storage; colours are validated for contrast (generate accessible foreground colours automatically); and all data access is scoped by tenant id on the server. Pages remain cacheable by including the tenant in cache keys (or rendering the shared shell statically and applying the theme through CSS variables). Custom domains require DNS verification and automatic TLS (platform support such as Vercel domains API or Cloudflare for SaaS), and I test with at least two radically different tenants plus visual regression.

## Explanation
### Resolution
```ts
// proxy.ts (conceptual)
export function proxy(req: NextRequest) {
  const host = req.headers.get("host")!;                       // acme.app.com or app.customer.com
  const tenant = lookupTenantByHost(host);                     // edge-cached map; 404 for unknown hosts
  if (!tenant) return NextResponse.rewrite(new URL("/not-found", req.url));
  const headers = new Headers(req.headers);
  headers.set("x-tenant-id", tenant.id);
  return NextResponse.next({ request: { headers } });
}
```
Alternatively rewrite to a `/[tenant]/...` route segment so tenant becomes a param and `generateStaticParams` can prerender per tenant. Check the Next.js docs for the current proxy and multi-tenant guidance.

### Theming
```tsx
// app/layout.tsx
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenant();                            // from header, cached per request
  const css = `:root{--primary:${tenant.theme.primary};--primary-foreground:${tenant.theme.onPrimary};--radius:${tenant.theme.radius}}`;
  return (
    <html lang={tenant.locale}>
      <head><style dangerouslySetInnerHTML={{ __html: css }} /></head>
      <body style={{ fontFamily: tenant.theme.fontStack }}>{children}</body>
    </html>
  );
}
```
Sanitise tenant-provided values (allow only validated hex/oklch/number formats and font names from an allowlist) because they are injected into CSS; never interpolate arbitrary strings.

### Design details
- **Tokens**: tenant overrides a small set (primary, accent, surface, radius, font); derive the rest (hover, borders, dark mode) algorithmically.
- **Contrast**: compute foreground colours and warn admins when brand colours fail WCAG AA.
- **Dark mode**: support per-tenant light/dark palettes.
- **Logos/images**: upload through the file-upload flow, validate type/size, serve via optimised images with tenant-scoped paths; SVG logos must be sanitised.
- **Fonts**: allowlisted web fonts or self-hosted uploads; load with `font-display: swap`.
- **Copy and locale**: i18n namespaces with tenant overrides.
- **Feature entitlements**: tenant config includes plan and flags; enforce on the server.
- **Emails/PDFs**: reuse the same tokens in templates.

### Caching and isolation
- Include tenant id/host in every cache key (data cache tags, CDN `Vary`/key, Redis keys).
- Do not statically prerender one tenant's themed HTML under a shared URL.
- Data isolation: every query includes `tenant_id`; consider database row-level security; automated tests that attempt cross-tenant access.
- Cookies scoped to the tenant host; avoid shared parent-domain cookies that leak across tenants.
- Rate limits and quotas per tenant.

### Custom domains
1. Customer adds `app.customer.com` and a CNAME to your platform.
2. You verify ownership (DNS TXT or CNAME), then provision TLS automatically (ACME).
3. Store the host → tenant mapping; remove it on churn.
4. Handle apex domains, redirects between your subdomain and their domain, and CORS/CSRF origin allowlists per tenant.
5. Beware "subdomain takeover" when a customer deletes DNS but you still map the host.

### Operational concerns
Preview theming in an admin UI with live preview; version tenant configs and allow rollback; cache config with short TTL plus explicit invalidation on change; monitor errors by tenant; automated visual tests across a matrix of themes.

## Follow-ups
- **CSS variables vs generating CSS per tenant?** — Variables avoid builds and enable instant changes; per-tenant CSS files only if you need deep customisation, at the cost of build and cache complexity.
- **How do you handle a tenant requesting custom components?** — Offer slots/extension points or composition; avoid forking. Escalate to a dedicated deployment only for exceptional enterprise needs.

## Common Mistakes
- Branching on tenant name throughout components.
- Caching pages without tenant in the key.
- Injecting unvalidated tenant CSS.

## Tips
- Say "tenant is data, theme is tokens, isolation is enforced on the server".

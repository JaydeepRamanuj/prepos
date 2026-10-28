---
title: "Frontend supply chain security: npm dependencies, lockfiles, SRI and third-party scripts"
level: hard
type: concept
tags: [supply-chain, npm, lockfile, sri, third-party-scripts, provenance, dependabot, postinstall]
related: [browser-security/csp-xss-basics, performance/third-party-scripts, browser-security/cookie-flags-token-storage]
---

## Question
How would you protect a frontend project from supply chain attacks such as malicious npm packages, compromised maintainers, typosquatting and hijacked third-party scripts?

## Clues
- Risk enters at install time (scripts), build time (plugins) and runtime (CDN scripts, tags).
- Fewer and pinned dependencies are easier to trust.
- Detection and containment matter as much as prevention.

## Interview Answer
The threats are malicious or hijacked packages (compromised maintainer accounts, typosquats, dependency confusion, a "protestware" release), malicious install scripts that run on developer machines and CI, vulnerable transitive dependencies, and third-party scripts loaded at runtime from CDNs or tag managers that execute with full page privileges. My defences: commit the lockfile and install with `npm ci` so builds are reproducible; review and minimise dependencies; pin exact versions for critical packages; disable or restrict lifecycle scripts (`ignore-scripts`, allow-list those that need them); run `npm audit`, Dependabot/Renovate and a scanner such as Socket or Snyk in CI; add a release-age delay so brand-new versions are not auto-adopted; use provenance and signature verification where available; protect secrets by never exposing tokens to install steps and using least-privilege, short-lived CI credentials; and on the browser side, self-host third-party code when possible, use Subresource Integrity for CDN files, restrict what can load with CSP, and isolate untrusted widgets in sandboxed iframes. Finally, have an incident plan: how to identify affected builds, rotate secrets and roll back.

## Explanation
### Attack surface

| Stage | Threat | Example |
|---|---|---|
| Choose package | typosquatting, dependency confusion | `reeact` or an internal package name published publicly |
| Install | `preinstall`/`postinstall` scripts run arbitrary code | credential theft from env/`~/.npmrc` |
| Update | compromised maintainer pushes a malicious patch | account takeover, then publish |
| Build | malicious plugin/loader | bundler plugin reading env vars |
| Runtime | third-party `<script>`, tag manager, CDN compromise | Magecart-style skimmers |
| CI/CD | poisoned GitHub Action, leaked tokens | unpinned `uses: someone/action@main` |

### Package hygiene
- **Lockfile + `npm ci`**: deterministic installs; review lockfile diffs in PRs (new packages, changed `resolved` URLs/integrity).
- **Fewer dependencies**: avoid micro-packages for trivial functions; prefer platform APIs.
- **Evaluate before adding**: maintainers, download trends, recent commits, size, install scripts, bus factor, licence.
- **Pin and delay**: exact versions for risky packages; configure Renovate/Dependabot with a minimum release age (e.g. a few days) and grouped updates reviewed by humans.
- **Lifecycle scripts**: set `ignore-scripts=true` in `.npmrc` (or pnpm's `onlyBuiltDependencies` allowlist) and explicitly allow the few packages that need builds.
- **Scopes and registries**: claim your org scope, configure scoped registries so internal names never resolve publicly (dependency confusion).
- **Audit**: `npm audit` (triage, don't blindly `--force`), plus behavioural scanners; use `npm ls`/`why` to understand transitive risk.
- **Provenance**: prefer packages published with npm provenance; `npm audit signatures` verifies registry signatures and provenance attestations.
- **2FA and trusted publishing** for your own packages; minimal publish rights.

### CI/CD
- Pin GitHub Actions to a commit SHA, not a mutable tag.
- Least-privilege `GITHUB_TOKEN` permissions; separate install from jobs that hold deployment secrets.
- Short-lived OIDC credentials instead of long-lived cloud keys.
- No secrets in build logs or `NEXT_PUBLIC_` variables (they are bundled into client JS).
- Protect the default branch, require reviews for workflow changes.

### Runtime third-party code
Third-party scripts have the same privileges as your code: they can read the DOM, form fields (payment details), storage and make requests.

- **Minimise and audit** tags; keep a registry of what loads and who owns it.
- **Self-host** where licence allows so you control the content and avoid a CDN compromise.
- **Subresource Integrity**: `<script src="https://cdn.example/lib.js" integrity="sha384-…" crossorigin="anonymous">`; the browser refuses a modified file. Only works for files that never change under a URL (not for vendor-managed rolling scripts).
- **CSP**: restrict `script-src` (nonce + `strict-dynamic`), `connect-src` (limits exfiltration) and `frame-src`; use report-only first.
- **Sandboxed iframes** for ads/widgets: `sandbox="allow-scripts"` without `allow-same-origin`, plus `Permissions-Policy`.
- **Partytown/worker isolation** for analytics reduces main-thread impact but isn't a security boundary.
- **Next.js**: load tags with `next/script` and an appropriate strategy; remember nonce handling when using CSP.
- **Monitoring**: CSP reports and page-integrity monitoring detect unexpected script changes.

### Build output and secrets
- Never ship `.env` secrets into client bundles; only intentionally public values are exposed to the browser.
- Source maps: avoid exposing them publicly if they reveal sensitive logic; upload to your error tracker instead.

### Incident response
1. Identify affected versions and builds (lockfile history, SBOM via `npm sbom` or CycloneDX).
2. Pin or roll back, remove the package, redeploy.
3. Rotate every secret that was present in CI or developer environments during the exposure.
4. Notify stakeholders; add a post-incident control (e.g. script restrictions, release-age delay).

## Follow-ups
- **Is `npm audit` enough?** — No; it only reports known CVEs, not new malicious releases. Add behavioural/reputation scanning and install-script controls.
- **What is dependency confusion?** — A build resolving an internal package name from the public registry where an attacker published a higher version; fix with scopes and registry config.

## Common Mistakes
- Running `npm install` in CI instead of `npm ci`.
- Auto-merging dependency updates with no delay or review.
- Putting secrets in `NEXT_PUBLIC_*` variables.

## Tips
- Organise the answer by stage: choose, install, build, run.

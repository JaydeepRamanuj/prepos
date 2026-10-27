---
title: "When is a monorepo (Turborepo + pnpm workspaces) worth it?"
level: hard
type: design
tags: [monorepo, turborepo, pnpm, workspaces, build-caching, architecture]
related: [architecture/scaling-codebase-team, architecture/micro-frontends-when-not, architecture/version-design-system]
---

## Question
Your company has a Next.js customer app, an admin app, and a component library published to npm that both apps consume. Releasing a Button fix takes three PRs across three repos. Someone proposes a monorepo with Turborepo and pnpm workspaces. Explain how it would be structured, what it buys you, and when a monorepo is *not* worth it.

## Clues
- What does a workspace give you that an npm-published package does not?
- Turborepo's main job is not "running scripts". What does it skip?
- Think about the costs: tooling, CI, permissions, onboarding.

## Interview Answer
A monorepo puts several apps and packages in one repository. pnpm workspaces link local packages together, so `apps/web` depends on `packages/ui` through `workspace:*` instead of a published npm version. A Button fix becomes one atomic PR that updates the component and both apps, and CI tests them together. Turborepo sits on top as a task runner. It understands the dependency graph between packages, runs tasks in the right order and in parallel, and caches outputs, locally and remotely, so unchanged packages are not rebuilt or retested. It is worth it when you have several apps sharing real code, such as UI, config, types or API clients, and changes often cross those boundaries. It is not worth it for a single app, for unrelated projects, or when teams need strict repository-level access control. In those cases the tooling and CI complexity is pure overhead.

## Explanation
### Structure

```txt
acme/
├── apps/
│   ├── web/                 # Next.js customer app
│   │   └── package.json     # "dependencies": { "@acme/ui": "workspace:*" }
│   └── admin/               # Next.js admin app
├── packages/
│   ├── ui/                  # design system components
│   │   ├── src/button.tsx
│   │   └── package.json     # "name": "@acme/ui", "exports": { "./button": "./src/button.tsx" }
│   ├── api-client/          # typed fetch client, shared Zod schemas
│   ├── eslint-config/
│   └── tsconfig/
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
// turbo.json — Turborepo 2.x uses "tasks" (it was "pipeline" in 1.x)
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {},
    "test": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

`"^build"` means "build my dependencies first". `turbo run build --filter=web...` builds `web` and everything it depends on. If `packages/ui` has not changed, its build output is replayed from cache.

### What you gain
- **Atomic changes.** One PR changes the component and every consumer, so there is no version-bump dance.
- **Shared tooling.** One ESLint/TS config package, so every app follows the same rules.
- **Fast CI.** With caching plus "affected only" filtering, you test only what changed.
- **Natural boundaries.** A package can expose only its `exports`, which is a stronger boundary than folder conventions.

### What it costs

| Cost | Detail |
|---|---|
| Tooling knowledge | Workspaces, `exports`, TS project setup, transpiling internal packages (`transpilePackages` in Next.js if a package ships raw TS) |
| CI complexity | Caching, affected-package detection, larger checkouts |
| Coupling risk | Easy cross-imports can blur ownership. You still need boundaries and CODEOWNERS |
| Access control | Everyone can see everything; per-repo permissions are gone |

### Decision

| Monorepo: yes | Monorepo: no |
|---|---|
| 2+ apps sharing UI, types, configs | One app (use folders + boundaries instead) |
| Frequent cross-package changes | Unrelated products with separate teams and stacks |
| You want one place for tooling | Strict code-access requirements |

pnpm workspaces alone (no Turborepo) are fine for 2–3 packages. Turborepo, or Nx, starts paying off once builds and tests are slow enough that caching matters.

## Follow-ups
- **Monorepo vs micro-frontends?** — They are orthogonal. A monorepo is about *where code lives*, while micro-frontends are about *how apps are deployed and composed at runtime*. You can have one without the other.
- **How do internal packages get compiled?** — Either each package builds to `dist/` (slower, but clean), or apps compile the package's TS source directly (the "just-in-time" internal package). In Next.js, list such packages in `transpilePackages` if needed.

## Common Mistakes
- Thinking a monorepo means one big deployable. Each app still deploys independently.
- Adopting Turborepo for a single Next.js app, which adds config with nothing to cache across.

## Tips
- The killer example is the "three PRs for a Button fix" story. Say the problem first, then the tool.

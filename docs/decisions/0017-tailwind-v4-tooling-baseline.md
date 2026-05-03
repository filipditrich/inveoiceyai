# 0017: Tailwind CSS v4 as styling baseline (Plan 1)

## Status

Accepted (Plan 1, 2026-05-03)

## Context

ADR [0003](./0003-shadcn-plus-reui-registry.md) commits ReUI `base-nova`, which targets Tailwind v4. Next.js 15 and shadcn/ui increasingly assume Tailwind v4-first tooling (`@tailwindcss/postcss`, CSS-first config).

Remaining ambiguity from [`architecture.md`](../architecture.md): exact postcss/layout pairing for Next App Router.

## Decision

1. **Tailwind v4** is the only supported styling baseline for `apps/web` in MVP.
2. **Formatting:** Prettier runs with `prettier-plugin-tailwindcss` so class lists stay canonical (same ordering ecosystem-wide).
3. **Compatibility check:** During Plan 1 bootstrap, validate `base-nova` + shadcn init + Next dev build without console/CSS regressions; file follow-up ADR only if we must diverge (e.g. pin alternate ReUI style).

## Consequences

- Upgrades follow Tailwind + ReUI release notes together; breaking Tailwind majors are coordinated events.
- Contributors must not mix v3-era `tailwind.config.js`-only patterns unless shadcn/ReUI docs explicitly require them.

## Plans touched

- Plan 1 (bootstrap)

## References

- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [ReUI get started](https://reui.io/docs/get-started)

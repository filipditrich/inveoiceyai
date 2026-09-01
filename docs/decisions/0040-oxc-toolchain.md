# 0040: oxlint and oxfmt as the lint and format toolchain

## Status

Accepted (2026-09-01)

## Context

Invoicey linted with ESLint 9 (`eslint-config-next` in `apps/web`, `@invoicey/eslint-config` elsewhere) and formatted with Prettier plus `prettier-plugin-tailwindcss`. That worked, and it was slow: `typescript-eslint` is a second TypeScript program, and the inner loop paid for it on every save and every `turbo lint` fan-out.

The architectural and authoring invariants also lived mostly as prose. Agents copy what does not fail. Hub 2027 already runs oxlint + oxfmt with a vendored anti-slop plugin and a cyclomatic-complexity ceiling; Sonde and Caliper inherit that house style. Keeping Invoicey on ESLint/Prettier would fork the mental model for the same author.

ADR [0017](./0017-tailwind-v4-tooling-baseline.md) required Prettier for Tailwind class sorting. oxfmt's `sortTailwindcss` covers that job against `apps/web/app/globals.css`.

Alternatives considered:

1. **Keep ESLint + Prettier.** Largest rule ecosystem, slowest, and `typescript-eslint` drags in a TypeScript peer that has already caused version conflicts in the Hub migration.
2. **Biome.** Fast and combines both jobs. Rejected: smaller rule set for the authoring gates we need, and it is not what the other projects run.
3. **oxlint + oxfmt.** Chosen — fastest, native type-aware linting via `oxlint-tsgolint` without a `typescript-eslint` peer, Tailwind class sorting, and consistent with Hub 2027.

## Decision

1. **`oxlint` for linting, `oxfmt` for formatting.** ESLint, Prettier, and `packages/config-eslint` are removed. Config lives in `oxlint.config.ts` and `oxfmt.config.mts` at the repository root. `bun lint` is a single root oxlint pass, not a Turbo fan-out.
2. **Formatting** keeps Invoicey's existing 2-space / double-quote baseline (not Hub's tabs) so the toolchain switch is not a repo-wide reformat. oxfmt sorts imports and Tailwind classes against `apps/web/app/globals.css`. ADR [0017](./0017-tailwind-v4-tooling-baseline.md)'s Prettier clause is superseded.
3. **Anti-slop is vendored** from Hub (`tools/oxlint/anti-slop`). Assertion safety comments, unknown-type restrictions, widening checks, dictionary checks, no module mocking in app code. Hub product plugins (modals, palette, ad-hoc head) are not copied. The rule set matches Hub; severity is **warn** until a dedicated pass promotes it to error (the existing tree has ~900 violations). Treat warnings as errors when writing new code.
4. **Complexity is capped, not merely discouraged.** `complexity` is `max: 20` with the `modified` variant (each `switch` counts as +1, not +1 per case). Prefer extracting helpers. Raising the ceiling needs an ADR. Pre-oxc hotspots are listed in `oxlint.config.ts` overrides; that list may only shrink.
5. **Type-aware linting is on** (`options.typeAware`), as an addition to `tsc --noEmit` rather than a replacement for it.
6. **shadcn/ReUI output is ignored** (`apps/web/components/ui/**`, `apps/web/components/reui/**`) because registry commands overwrite those files.
7. **`bun format` / `bun format:check`** replace Prettier. CI runs format-check next to lint. lint-staged runs `oxlint --fix` on staged TS/JS and `oxfmt` on everything else.

## Consequences

- Full lint on the tree is milliseconds, so it can run on save and in pre-commit without friction.
- `oxlint.config.ts` is a TypeScript config, which oxlint treats as experimental and loads via Node. Worth it: the restricted-import list is typed and carries rationale inline.
- oxlint's rule catalogue is smaller than ESLint's. Custom JS plugins (anti-slop) are the fallback, not a return to ESLint.
- Restricted-import lists may only grow.
- Type assertions should carry a nearby `SAFETY:` comment; that rule is warn until the cleanup pass.
- Complexity hotspots listed in `oxlint.config.ts` may only shrink.

## Plans touched

- Tooling (cross-cutting)

## References

- [oxlint `complexity` rule](https://oxc.rs/docs/guide/usage/linter/rules/eslint/complexity)
- Hub 2027 `apps/hub/oxlint.config.ts` and `oxfmt.config.mts`
- [ADR 0017](./0017-tailwind-v4-tooling-baseline.md) — Tailwind baseline; formatting clause superseded here

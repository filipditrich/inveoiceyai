# 0003: shadcn/ui base + ReUI registry

## Status

Accepted (Phase 0, 2026-05-03)

## Context

We need a UI primitives library that ships:

- High-quality table / data grid component (the invoice list is the heart of the management UX)
- Polished form primitives (input, select, popover, dialog, …)
- Tailwind-first, copy-into-the-codebase ownership model
- React 19 + Tailwind v4 compatibility
- Design that looks like a 2026 finance/admin tool out of the box (Midday-grade polish)

Options:

1. **shadcn/ui base only** — gold standard for primitives, but its `<Table>` is a styled HTML table, not a feature-rich data grid. Building grid features (virtualization, filters, row pinning) on top is non-trivial.
2. **shadcn/ui + ReUI registry** — ReUI extends shadcn with higher-level components including a [Data Grid](https://reui.io/components/data-grid) backed by TanStack Table, plus composable patterns we'd otherwise build ourselves (autocomplete, file upload, kanban, timeline, …).
3. **MUI / Mantine / AntD** — mature but design-heavy; theming to look like our target aesthetic is fighting upstream.
4. **Build everything from Tailwind primitives** — too expensive; we'd reinvent variants the ecosystem already solved.

Forces:

- The user explicitly asked for ReUI Data Grid (via the [reui.io](https://reui.io/components/data-grid) link)
- ReUI is **registry-based** — it adds to the same `components.json` shadcn already uses, with a `@reui` namespace
- ReUI is built on the same Radix UI / Base UI primitives as shadcn; coexistence is by design
- We keep ownership of every component — the `add` command copies code into our repo, no runtime dependency on a UI lib

## Decision

We use **shadcn/ui** as the base (foundation primitives — Button, Input, Dialog, Popover, Tabs, …) and **ReUI** as the higher-level registry (Data Grid, Autocomplete, File Upload, Filters, …) layered on top.

Specifically:

- `components.json` declares the `@reui` registry per [reui.io/docs/get-started](https://reui.io/docs/get-started):

  ```json
  {
  	"style": "base-nova",
  	"registries": {
  		"@reui": "https://reui.io/r/{style}/{name}.json"
  	}
  }
  ```

- Style is `base-nova` (ReUI's default; matches well with the "Midday-like" aesthetic)
- Components are added via `bunx shadcn@latest add` (works for both shadcn and `@reui/<name>`) and live under `apps/web/components/ui/`
- We prefer **Radix UI** primitives over Base UI when ReUI offers both (broader ecosystem support, more familiar API)

## Consequences

### Positive

- Top-quality primitives for free, owned in-repo
- Data Grid is a solved problem from day 1 — virtualization, row pinning, filters all available
- Theming is Tailwind-native; one CSS-variables file controls the whole product look
- ReUI's "AI-friendly" llms.txt + Copy Markdown features help the agent navigate the lib

### Negative

- Two mental models for "where does this component come from?" — mitigate by always using the `add` CLI (component file headers note the origin)
- ReUI is a smaller ecosystem than shadcn alone; some components might lag updates
- Tailwind v4 + ReUI base-nova compatibility on Next.js 15 not yet validated end-to-end — see TODO in [`architecture.md`](../architecture.md)

### Neutral

- Adopting the `base-nova` style commits us to a specific aesthetic baseline; tweaks happen via theme variables, not by switching styles
- Some shadcn components have ReUI-flavored equivalents (e.g. `c-*` blocks); we pick consistently per area to avoid mixed feels

## Plans touched

- Plan 1 (bootstrap) — install shadcn + register `@reui`
- Plan 7 (invoice list) — primary consumer of the Data Grid
- Plan 5 (issuers), Plan 4 (clients), Plan 6 (builder) — heavy form usage

## References

- [reui.io/docs/get-started](https://reui.io/docs/get-started)
- [reui.io/components/data-grid](https://reui.io/components/data-grid)
- [shadcn/ui docs](https://ui.shadcn.com)

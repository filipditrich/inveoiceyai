# 0015: React Hook Form + zodResolver for the invoice builder

## Status

Accepted (Phase 0, 2026-05-03)

## Context

The invoice builder (Plan 6) is a complex form:

- Many fields, several nested objects (issuer / client / payment / vat / customization)
- A dynamic array of line items with per-row VAT and per-row totals
- Live preview that re-renders when the form state changes
- Cross-field validation (VAT mode and supplies-abroad consistency, credit-note's `correctedInvoiceNumber`, etc.)
- Eventual ARES-lookup-driven prefill

Form-runtime options:

1. **React Hook Form (RHF) + `zodResolver`** — uncontrolled by default, fast re-renders, mature ecosystem, plays well with shadcn/ReUI patterns
2. **TanStack Form** — newer, smaller bundle, fully type-driven; less ecosystem
3. **Conform (the Remix-flavored library)** — server-first; we'd lose RSC/Server-Action ergonomics
4. **Plain controlled state with `useState`/`useReducer` + manual Zod parse** — viable but tedious for arrays

Forces:

- We've already committed to Zod as the single source of truth ([ADR 0005](./0005-zod-as-source-of-truth.md))
- Live PDF preview means re-renders happen on every keystroke; uncontrolled forms minimize re-render cost
- shadcn/ui's `<Form>` primitive is RHF-flavored
- Field-level errors with TS-typed paths are critical for a form this dense
- The author has historical familiarity with RHF

## Decision

The invoice builder uses **React Hook Form** with **`@hookform/resolvers/zod`** wired to `InvoiceSchema`.

Specifically:

- The builder component composes the shadcn `<Form>` primitive
- `useFieldArray` drives the line-items table
- The Zod resolver runs on submit (default) plus on a debounced `onChange` for live-preview validity
- Field paths use Zod-derived types so renaming a schema field surfaces TS errors at every consumer site
- Cross-field rules in the schema (`refine`/`superRefine`) surface as form-level errors at the right path

## Consequences

### Positive

- Mature library, lots of docs/examples
- Performant for our form size; uncontrolled by default avoids over-rendering
- Zod resolver is the canonical glue — no parallel validation rules
- shadcn `<Form>` integration is one-import away
- `useFieldArray` covers the line-items table cleanly

### Negative

- RHF has a steep API surface — `register`, `Controller`, `useFormContext`, `useFieldArray` — easy to misuse for newcomers. Mitigated by snippet conventions and reviewing the first builder PR thoroughly.
- Some shadcn/ReUI components need `<Controller>` rather than `register` (Select, Combobox, Date Picker). Adds boilerplate; documented in the eventual `ui/invoice-builder-flow.md`.
- We accept the bundle size of RHF (~9 KB gz) for the user-facing forms.

### Neutral

- We use the schema's `refine` constraints rather than RHF's `validate` callbacks for cross-field rules — keeps validation in one place

## Plans touched

- Plan 6 (invoice builder) — primary implementation
- Plans 4, 5 (clients, issuers UI) — same pattern, smaller forms

## References

- [React Hook Form](https://react-hook-form.com)
- [`@hookform/resolvers/zod`](https://github.com/react-hook-form/resolvers#zod)
- [shadcn `<Form>`](https://ui.shadcn.com/docs/components/form)

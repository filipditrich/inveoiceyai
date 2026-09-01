import { defineConfig } from "oxlint";

/**
 * Invoicey lint gates (ADR 0040).
 *
 * Conventions are carried as *rules*, not prose. An agent obeys what fails and skims what
 * is documented. Restricted-import lists may only ever grow.
 *
 * Oxlint rather than ESLint: native type-aware linting via `oxlint-tsgolint`, native react-hooks,
 * and a place to vendor anti-slop. Plugins are listed explicitly so unicorn/oxc defaults stay off.
 * Hub-specific gates (legacy UI bans, modal/head plugins) are not copied.
 */

/** dependencies that contradict a decision, everywhere in the tree */
const RESTRICTED_PACKAGE_ENTRIES = [
  [
    "moment",
    "Use date-fns or Temporal. Moment is mutable and not in the stack.",
  ],
] as const satisfies ReadonlyArray<readonly [string, string]>;

const RESTRICTED_PACKAGES = RESTRICTED_PACKAGE_ENTRIES.map(
  ([name, reason]) => ({
    name,
    message: `${reason} See docs/decisions/0040-oxc-toolchain.md.`,
  }),
);

/**
 * Curated React Doctor rules — warn in the editor and `bun lint`, never CI errors.
 * Do not enable the full catalog (Next.js, RN, design nits) and do not promote to error.
 */
const REACT_DOCTOR_RULES = {
  "react-doctor/no-fetch-in-effect": "warn",
  "react-doctor/no-derived-state-effect": "warn",
  "react-doctor/no-mirror-prop-effect": "warn",
  "react-doctor/no-nested-component-definition": "warn",
  "react-doctor/no-set-state-in-render": "warn",
  "react-doctor/rerender-dependencies": "warn",
  "react-doctor/effect-needs-cleanup": "warn",
  "react-doctor/no-inline-prop-on-memo-component": "warn",
  "react-doctor/rerender-memo-with-default-value": "warn",
  "react-doctor/no-usememo-simple-expression": "warn",
  "react-doctor/rendering-hoist-jsx": "warn",
  "react-doctor/query-no-query-in-effect": "warn",
  "react-doctor/query-no-usequery-for-mutation": "warn",
  "react-doctor/query-mutation-missing-invalidation": "warn",
  "react-doctor/query-no-rest-destructuring": "warn",
  "react-doctor/query-stable-query-client": "warn",
  "react-doctor/query-no-void-query-fn": "warn",
} as const;

/**
 * Hub-identical anti-slop set. Warn until the existing tree is cleaned; treat as
 * errors when writing new code. Promotion to error is a dedicated pass — enabling
 * them as errors here would mix ~900 type-narrowing refactors into the toolchain switch.
 */
const ANTI_SLOP_RULES = {
  "anti-slop/no-chained-type-assertions": "warn",
  "anti-slop/no-conditional-empty-object-spread": "warn",
  "anti-slop/no-known-value-widening": "warn",
  "anti-slop/no-module-mocking": "warn",
  "anti-slop/no-object-parameters": "warn",
  "anti-slop/no-reflect-apply": "warn",
  "anti-slop/no-reflect-get": "warn",
  "anti-slop/no-runtime-typeof": "warn",
  "anti-slop/no-shape-in-symbol-names": "warn",
  "anti-slop/no-unknown-parameters": "warn",
  "anti-slop/no-unknown-returns": "warn",
  "anti-slop/no-unknown-type-aliases": "warn",
  "anti-slop/no-unsafe-dictionary-type": "warn",
  "anti-slop/no-widen-then-assert": "warn",
  "anti-slop/require-safety-comment-for-type-assertion": "warn",
} as const;

export default defineConfig({
  options: {
    /** extra lint on top of `tsc --noEmit` — do not set typeCheck */
    typeAware: true,
  },
  plugins: ["eslint", "typescript", "react", "jsdoc", "nextjs"],
  jsPlugins: [
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    { name: "react-doctor", specifier: "oxlint-plugin-react-doctor" },
  ],
  env: { browser: true, node: true },
  ignorePatterns: [
    /** next-intl generated catalogs — typecheck rewrites these */
    "**/*.d.json.ts",
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/.turbo/**",
    "**/coverage/**",
    ".eve/**",
    ".output/**",
    "apps/web/.eve/**",
    "apps/web/.output/**",
    /** shadcn/ReUI output — `reui:add` / shadcn overwrite these */
    "apps/web/components/ui/**",
    "apps/web/components/reui/**",
    /** vendored plugin — not app code */
    "tools/oxlint/**",
    /** agent tooling */
    ".agent/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".cursor/**",
    ".gemini/**",
    ".opencode/**",
    ".worktrees/**",
  ],
  rules: {
    "no-restricted-imports": ["error", { paths: RESTRICTED_PACKAGES }],

    /**
     * Cap cyclomatic complexity so branches stay readable (eslint/complexity).
     * `modified` counts each `switch` as +1 (not +1 per case). Prefer extracting
     * helpers over raising the ceiling — raising it needs an ADR.
     */
    complexity: ["error", { max: 20, variant: "modified" }],

    /** unused code is a gate, not a warning */
    "typescript/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    /** anti-slop wants `Domain | unknown` on catch boundaries; `unknown` is not redundant there */
    "typescript/no-redundant-type-constituents": "off",

    /**
     * Native JSDoc hygiene only — no eslint-plugin-jsdoc JS plugin.
     * Tag-heavy require-* (param/returns/throws/yields + types) stay off: prose-first + TypeScript.
     */
    "jsdoc/no-blank-blocks": "error",
    "jsdoc/check-tag-names": [
      "error",
      { typed: true, definedTags: ["jsxImportSource", "type"] },
    ],
    "jsdoc/empty-tags": "error",
    "jsdoc/check-access": "error",
    "jsdoc/implements-on-classes": "error",
    "jsdoc/check-property-names": "error",
    "jsdoc/no-defaults": "error",
    "jsdoc/require-property-name": "error",
    "jsdoc/require-property-description": "error",
    "jsdoc/require-param-name": "error",
    "jsdoc/require-property": "off",
    "jsdoc/require-property-type": "off",
    "jsdoc/require-yields": "off",

    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "error",
    /** automatic JSX runtime — short fragments are the existing form */
    "react/jsx-fragments": "off",
    /**
     * React Compiler checks in oxlint correctness. Invoicey is not on the compiler;
     * React Doctor stays the curated warn set. Keep these off until a dedicated pass.
     */
    "react/error-boundaries": "off",
    "react/globals": "off",
    "react/immutability": "off",
    "react/incompatible-library": "off",
    "react/preserve-manual-memoization": "off",
    "react/purity": "off",
    "react/refs": "off",
    "react/set-state-in-effect": "off",
    "react/set-state-in-render": "off",
    "react/static-components": "off",
    "react/use-memo": "off",
    "react/void-use-memo": "off",
    "react/unsupported-syntax": "off",

    ...REACT_DOCTOR_RULES,
    ...ANTI_SLOP_RULES,
  },
  overrides: [
    {
      /** tests exercise adversarial shapes; complexity caps get in the way there */
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
      rules: {
        complexity: "off",
        "anti-slop/no-module-mocking": "off",
      },
    },
    {
      /**
       * Pre-oxc hotspots over the complexity cap. The list may only shrink — extract
       * helpers in the owning file, then remove it. Do not add new paths.
       */
      files: [
        "apps/web/actions/clients.ts",
        "apps/web/actions/import-invoices.ts",
        "apps/web/actions/invoices.ts",
        "apps/web/agent/lib/invoice-card-model.ts",
        "apps/web/app/**/invoices/**/*.tsx",
        "apps/web/components/clients/client-editor-form.tsx",
        "apps/web/components/invoices/invoice-builder-form.tsx",
        "apps/web/components/invoices/invoice-list-table.tsx",
        "apps/web/components/issuers/issuer-welcome-wizard.tsx",
        "apps/web/components/toast-from-search-params.tsx",
        "apps/web/lib/admin/metrics.ts",
        "apps/web/lib/auth/on-session-created.ts",
        "apps/web/lib/dashboard-metrics.ts",
        "packages/ares/src/client.ts",
        "packages/ares/src/format-address.ts",
        "packages/db/src/clients-repo.ts",
        "packages/db/src/invoices-repo.ts",
        "packages/invoice-core/src/isdoc/parse-isdoc.ts",
        "packages/invoice-core/src/schema.ts",
        "packages/invoice-tools/src/email/send.ts",
        "packages/invoice-tools/src/handlers.ts",
        "packages/invoice-tools/src/invoice-artifacts.ts",
        "packages/invoice-tools/src/invoice-import.ts",
        "packages/invoice-tools/src/invoice-ops.ts",
        "packages/invoice-tools/src/normalize-draft-invoice.ts",
        "packages/invoice-tools/src/send-invoice-email.ts",
        "packages/payment-core/src/matcher.ts",
        "packages/payment-core/src/moneta.ts",
      ],
      rules: {
        complexity: "off",
      },
    },
  ],
});

import { defineConfig } from "oxfmt";

/**
 * Workspace formatting (ADR 0040). Import groups and Tailwind sorting match Hub.
 * Indent and quotes stay Invoicey's existing Prettier baseline (2-space, double
 * quotes) so the toolchain switch is not a repo-wide reformat.
 * `.mts` so the CommonJS workspace root does not emit a typeless-package warning.
 */
export default defineConfig({
  singleQuote: false,
  trailingComma: "all",
  arrowParens: "always",
  useTabs: false,
  bracketSpacing: true,
  semi: true,
  printWidth: 80,
  endOfLine: "lf",
  tabWidth: 2,
  sortPackageJson: false,
  sortImports: {
    newlinesBetween: false,
    internalPattern: ["@invoicey/"],
    customGroups: [
      {
        groupName: "react",
        elementNamePattern: ["react", "react-**"],
      },
    ],
    groups: [
      "react",
      ["value-builtin", "value-external"],
      { newlinesBetween: true },
      ["type-internal", "value-internal"],
      { newlinesBetween: true },
      [
        "type-parent",
        "type-sibling",
        "type-index",
        "value-parent",
        "value-sibling",
        "value-index",
      ],
      "unknown",
    ],
  },
  sortTailwindcss: {
    stylesheet: "apps/web/app/globals.css",
    functions: ["clsx", "cn"],
  },
  ignorePatterns: [
    "CHANGELOG.md",
    "bun.lock",
    "**/*.d.ts",
    "**/*.d.json.ts",
    /** shadcn/ReUI output — registry overwrite */
    "apps/web/components/ui/**",
    "apps/web/components/reui/**",
    ".next/**",
    ".turbo/**",
    ".eve/**",
    ".output/**",
    "coverage/**",
    "dist/**",
    ".worktrees/**",
    ".claude/**",
    ".agents/skills/**",
  ],
});

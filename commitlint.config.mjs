import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} relativeDir
 * @returns {string[]}
 */
function listDirs(relativeDir) {
  const abs = path.join(root, relativeDir);
  return readdirSync(abs).filter((name) =>
    statSync(path.join(abs, name)).isDirectory(),
  );
}

const appNames = listDirs("apps");
const packageNames = listDirs("packages");

/** path scopes: apps/web, packages/db, … */
const pathScopes = [
  ...appNames.map((name) => `apps/${name}`),
  ...packageNames.map((name) => `packages/${name}`),
];

/** short aliases from folder names: web, mcp, db, invoice-core, … */
const shortScopes = [...appNames, ...packageNames];

/** meta / non-workspace scopes */
const metaScopes = [
  "docs",
  "deps",
  "ci",
  "config",
  "release",
  "git",
  "security",
  "i18n",
];

const scopes = [...new Set([...pathScopes, ...shortScopes, ...metaScopes])];

/**
 * Commitlint configuration — scopes from apps/* and packages/* (+ meta).
 * Custom rule allows `/` in scopes (apps/web, packages/db).
 * @type {import('@commitlint/types').UserConfig}
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 256],
    "body-max-line-length": [2, "always", 512],
    "custom-scope-enum": [2, "always", scopes],
  },
  plugins: [
    {
      rules: {
        /**
         * Enum check that allows `/` in scopes (stock scope-enum does not).
         * @see https://stackoverflow.com/questions/67981028/commitlint-allow-in-scope-enum
         */
        "custom-scope-enum": (parsed, when = "always", value = []) => {
          if (!parsed.scope) {
            return [true, ""];
          }
          const scopeSegments = parsed.scope.split(",");
          const check = (candidate, enums) =>
            Array.isArray(enums) && enums.includes(candidate);
          const negated = when === "never";
          const result =
            value.length === 0 ||
            scopeSegments.every((scope) => check(scope, value));
          return [
            negated ? !result : result,
            `scope must ${negated ? "not " : ""}be one of [${value.join(", ")}]`,
          ];
        },
      },
    },
  ],
};

import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

const ENV_GLOBALS = new Set(["document", "window", "globalThis"]);

type RuntimeFunction = ESTree.ArrowFunctionExpression | ESTree.Function;

function isRuntimeFunction(node: ESTree.Node): node is RuntimeFunction {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression"
  );
}

function isInsideTypeGuard(node: ESTree.Node): boolean {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (isRuntimeFunction(current)) {
      return current.returnType?.typeAnnotation.type === "TSTypePredicate";
    }
    current = current.parent;
  }
  return false;
}

/**
 * Hub fork of anti-slop `no-runtime-typeof`.
 *
 * Upstream bans every runtime `typeof`. That also flags environment detection
 * (`typeof document === 'undefined'`), which is not value-narrowing. Allow those
 * checks; everything else still has to go through `isString` / `isDefined` /
 * `isObject` from `@nfctron/nexus-core`.
 */
function isEnvUndefinedCheck(node: ESTree.UnaryExpression): boolean {
  if (
    node.argument.type !== "Identifier" ||
    !ENV_GLOBALS.has(node.argument.name)
  )
    return false;

  const parent = node.parent;
  if (parent.type !== "BinaryExpression") return false;
  if (
    parent.operator !== "===" &&
    parent.operator !== "!==" &&
    parent.operator !== "==" &&
    parent.operator !== "!="
  ) {
    return false;
  }

  const other = parent.left === node ? parent.right : parent.left;
  return other.type === "Literal" && other.value === "undefined";
}

/** Disallow runtime typeof checks that narrow unparsed values instead of decoding them. */
export const noRuntimeTypeofRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow runtime typeof checks; external values must be decoded into meaningful types at their I/O boundary. Environment detection (`typeof document === "undefined"`) is allowed.',
    },
    messages: {
      runtimeTypeof:
        "A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowInTypeGuards: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowInTypeGuards: false }],
  },
  createOnce(context) {
    return {
      UnaryExpression(node) {
        if (node.operator !== "typeof") return;
        if (isEnvUndefinedCheck(node)) return;
        const option = context.options?.[0];
        const allowInTypeGuards =
          typeof option === "object" &&
          option !== null &&
          !Array.isArray(option) &&
          option.allowInTypeGuards === true;
        if (!allowInTypeGuards || !isInsideTypeGuard(node)) {
          context.report({ node, messageId: "runtimeTypeof" });
        }
      },
    };
  },
});

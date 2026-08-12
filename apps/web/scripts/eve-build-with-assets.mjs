#!/usr/bin/env node
/**
 * Eve nitro flattens tools into `__server.func/index.mjs` and does not honor
 * Next `outputFileTracingIncludes`. Copy invoice-core PDF/ISDOC assets into
 * the Eve function so `resolveInvoiceCoreAsset` / font registration work.
 */
import { cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(webRoot, "../..");
const assetsSrc = join(repoRoot, "packages/invoice-core/assets");

function findEveBinary() {
  try {
    const evePkg = require.resolve("eve/package.json", { paths: [webRoot] });
    return join(dirname(evePkg), "bin", "eve.js");
  } catch {
    return null;
  }
}

function collectServerFuncs(root, out = []) {
  if (!existsSync(root)) return out;
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    if (name === "__server.func" || name.endsWith(".func")) {
      out.push(full);
      continue;
    }
    if (name === "node_modules" || name === ".git") continue;
    collectServerFuncs(full, out);
  }
  return out;
}

function copyAssetsIntoFunc(funcDir) {
  const targets = [
    join(funcDir, "packages/invoice-core/assets"),
    join(funcDir, "assets"),
  ];
  for (const dest of targets) {
    cpSync(assetsSrc, dest, { recursive: true });
  }
}

const eveBin = findEveBinary();
if (!eveBin || !existsSync(eveBin)) {
  console.error("[eve-build-with-assets] eve binary not found");
  process.exit(1);
}
if (!existsSync(assetsSrc)) {
  console.error(`[eve-build-with-assets] missing assets at ${assetsSrc}`);
  process.exit(1);
}

const build = spawnSync(process.execPath, [eveBin, "build"], {
  cwd: webRoot,
  env: process.env,
  stdio: "inherit",
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const searchRoots = [
  process.env.EVE_INTERNAL_BUILD_OUTPUT_DIRECTORY,
  join(webRoot, ".eve"),
  join(webRoot, ".output"),
].filter(Boolean);

const funcs = new Set();
for (const root of searchRoots) {
  for (const func of collectServerFuncs(resolve(webRoot, root))) {
    funcs.add(func);
  }
}

if (funcs.size === 0) {
  console.warn(
    "[eve-build-with-assets] no Eve __server.func found — assets not copied",
  );
  process.exit(0);
}

for (const func of funcs) {
  copyAssetsIntoFunc(func);
  console.log(`[eve-build-with-assets] copied invoice-core assets → ${func}`);
}

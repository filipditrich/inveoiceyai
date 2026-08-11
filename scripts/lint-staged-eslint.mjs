#!/usr/bin/env bun
/**
 * Group lint-staged paths by apps/* or packages/* and run eslint in that cwd
 * so each workspace's flat config is found.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const files = process.argv.slice(2);
/** @type {Map<string, string[]>} */
const groups = new Map();

for (const file of files) {
  const normalized = file.replaceAll("\\", "/");
  const parts = normalized.split("/");
  if (parts.length < 3) {
    continue;
  }
  if (parts[0] !== "apps" && parts[0] !== "packages") {
    continue;
  }
  const root = `${parts[0]}/${parts[1]}`;
  const list = groups.get(root) ?? [];
  list.push(normalized);
  groups.set(root, list);
}

let failed = false;

for (const [root, groupFiles] of groups) {
  const relFiles = groupFiles.map((file) => path.relative(root, file));
  const result = spawnSync(
    "bun",
    ["x", "eslint", "--fix", "--quiet", ...relFiles],
    {
      cwd: root,
      stdio: "inherit",
    },
  );
  if (result.status !== 0) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);

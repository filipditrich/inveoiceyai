import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveDocIcon } from "./docs-icons";

const DOCS_ROOT = join(import.meta.dirname, "../content/docs");

function collectFrontmatterIcons(dir: string): string[] {
  const names = new Set<string>();
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".mdx") && entry.name !== "meta.json") {
        continue;
      }
      const match = readFileSync(path, "utf8").match(/^icon:\s*(\w+)/m);
      if (match?.[1]) {
        names.add(match[1]);
      }
    }
  };
  walk(dir);
  return [...names].sort();
}

describe("resolveDocIcon", () => {
  it("maps HardDrive for Invoicey Drive", () => {
    expect(resolveDocIcon("HardDrive")).toBeDefined();
  });

  it("returns undefined for an unknown name", () => {
    expect(resolveDocIcon("NotARealIcon")).toBeUndefined();
  });

  it("registers every icon referenced by docs frontmatter", () => {
    const icons = collectFrontmatterIcons(DOCS_ROOT);
    expect(icons).toContain("HardDrive");
    for (const icon of icons) {
      expect(resolveDocIcon(icon), icon).toBeDefined();
    }
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { getDemoIssuer } from "./demo-issuer";
import {
  deletePreset,
  getPreset,
  listPresets,
  savePreset,
} from "./presets";

describe("preset store", () => {
  let dir: string;
  let filePath: string;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  async function setup() {
    dir = await mkdtemp(path.join(tmpdir(), "invoicey-presets-"));
    filePath = path.join(dir, "presets.json");
  }

  it("saves, lists, gets, and deletes issuer presets", async () => {
    await setup();
    const issuer = getDemoIssuer();
    const saved = await savePreset({
      kind: "issuer",
      name: "demo",
      data: issuer,
      path: filePath,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    const listed = await listPresets({ path: filePath, kind: "issuer" });
    expect(listed.presets).toHaveLength(1);
    expect(listed.presets[0]?.name).toBe("demo");

    const got = await getPreset({ id: saved.preset.id, path: filePath });
    expect(got.ok).toBe(true);

    const deleted = await deletePreset({ id: saved.preset.id, path: filePath });
    expect(deleted.ok).toBe(true);
    const after = await listPresets({ path: filePath });
    expect(after.presets).toHaveLength(0);
  });

  it("rejects invalid issuer data", async () => {
    await setup();
    const bad = await savePreset({
      kind: "issuer",
      name: "bad",
      data: { name: "nope" },
      path: filePath,
    });
    expect(bad.ok).toBe(false);
  });
});

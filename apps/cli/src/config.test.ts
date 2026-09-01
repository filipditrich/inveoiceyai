import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { configPath, resolveSession, saveConfig } from "./config";

describe("cli config", () => {
  it("writes mode-safe json and resolves over env", async () => {
    const home = await mkdtemp(join(tmpdir(), "invoicey-cli-"));
    await saveConfig(
      { apiUrl: "https://invoicey.ditrich.me", token: "secret-pat" },
      home,
    );
    const raw = await readFile(configPath(home), "utf8");
    expect(JSON.parse(raw).token).toBe("secret-pat");
    const session = await resolveSession({
      flags: { api: "http://localhost:3000" },
      home,
    });
    expect(session.apiUrl).toBe("http://localhost:3000");
    expect(session.token).toBe("secret-pat");
  });
});

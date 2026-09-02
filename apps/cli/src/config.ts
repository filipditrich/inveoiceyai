import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type CliConfig = {
  apiUrl: string;
  token: string;
};

export const DEFAULT_API_URL = "https://invoicey.ditrich.me";

export function configDir(home = homedir()): string {
  return join(home, ".invoicey");
}

export function configPath(home = homedir()): string {
  return join(configDir(home), "cli.json");
}

export async function loadConfigFile(
  home = homedir(),
): Promise<Partial<CliConfig>> {
  try {
    const raw = await readFile(configPath(home), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const rec = parsed as Record<string, unknown>;
    return {
      apiUrl: typeof rec.apiUrl === "string" ? rec.apiUrl : undefined,
      token: typeof rec.token === "string" ? rec.token : undefined,
    };
  } catch {
    return {};
  }
}

export async function saveConfig(
  cfg: CliConfig,
  home = homedir(),
): Promise<string> {
  const dir = configDir(home);
  await mkdir(dir, { recursive: true });
  const path = configPath(home);
  await writeFile(path, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
  await chmod(path, 0o600);
  return path;
}

export async function clearConfig(home = homedir()): Promise<void> {
  try {
    await unlink(configPath(home));
  } catch {
    /** already gone */
  }
}

export async function resolveSession(input: {
  flags: Record<string, string | boolean>;
  home?: string;
}): Promise<CliConfig> {
  const file = await loadConfigFile(input.home);
  const apiUrl =
    (typeof input.flags.api === "string" ? input.flags.api : undefined) ??
    process.env.INVOICEY_API_URL?.trim() ??
    file.apiUrl ??
    DEFAULT_API_URL;
  const token =
    (typeof input.flags.token === "string" ? input.flags.token : undefined) ??
    process.env.INVOICEY_API_KEY?.trim() ??
    file.token ??
    "";
  return { apiUrl: apiUrl.replace(/\/$/, ""), token };
}

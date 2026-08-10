import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { IssuerSnapshotSchema } from "@invoicey/invoice-core/schema";

export const PresetKindSchema = z.enum(["issuer", "invoice_template"]);
export type PresetKind = z.infer<typeof PresetKindSchema>;

export const PresetRecordSchema = z.object({
  id: z.string().uuid(),
  kind: PresetKindSchema,
  name: z.string().trim().min(1).max(120),
  data: z.unknown(),
});
export type PresetRecord = z.infer<typeof PresetRecordSchema>;

const PresetFileSchema = z.object({
  version: z.literal(1),
  presets: z.array(PresetRecordSchema),
});

export type PresetFile = z.infer<typeof PresetFileSchema>;

function defaultPresetsPath(): string {
  if (process.env.INVOICEY_PRESETS_PATH?.trim()) {
    return process.env.INVOICEY_PRESETS_PATH.trim();
  }
  /** serverless home is often read-only */
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(tmpdir(), "invoicey-presets.json");
  }
  return path.join(homedir(), ".invoicey", "presets.json");
}

function emptyFile(): PresetFile {
  return { version: 1, presets: [] };
}

export function resolvePresetsPath(override?: string): string {
  if (override != null && override.trim() !== "") {
    return override.trim();
  }
  return defaultPresetsPath();
}

async function readStore(filePath: string): Promise<PresetFile> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const checked = PresetFileSchema.safeParse(parsed);
    if (!checked.success) {
      throw new Error(`invalid presets file at ${filePath}`);
    }
    return checked.data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyFile();
    }
    throw err;
  }
}

async function writeStore(filePath: string, data: PresetFile): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

function validatePresetData(
  kind: PresetKind,
  data: unknown,
): { ok: true; data: unknown } | { ok: false; message: string } {
  if (kind === "issuer") {
    const p = IssuerSnapshotSchema.safeParse(data);
    if (!p.success) {
      return {
        ok: false,
        message: p.error.issues.map((i) => i.message).join("; "),
      };
    }
    return { ok: true, data: p.data };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, message: "invoice_template data must be an object" };
  }
  return { ok: true, data };
}

export async function listPresets(options?: {
  path?: string;
  kind?: PresetKind;
}): Promise<{ ok: true; presets: PresetRecord[] }> {
  const filePath = resolvePresetsPath(options?.path);
  const store = await readStore(filePath);
  const presets =
    options?.kind == null
      ? store.presets
      : store.presets.filter((p) => p.kind === options.kind);
  return { ok: true, presets };
}

export async function getPreset(options: {
  id: string;
  path?: string;
}): Promise<
  { ok: true; preset: PresetRecord } | { ok: false; error: string }
> {
  const filePath = resolvePresetsPath(options.path);
  const store = await readStore(filePath);
  const preset = store.presets.find((p) => p.id === options.id);
  if (!preset) {
    return { ok: false, error: `preset not found: ${options.id}` };
  }
  return { ok: true, preset };
}

export async function savePreset(options: {
  id?: string;
  kind: PresetKind;
  name: string;
  data: unknown;
  path?: string;
}): Promise<
  { ok: true; preset: PresetRecord } | { ok: false; error: string }
> {
  const checked = validatePresetData(options.kind, options.data);
  if (!checked.ok) {
    return { ok: false, error: checked.message };
  }

  const filePath = resolvePresetsPath(options.path);
  const store = await readStore(filePath);
  const id = options.id ?? randomUUID();
  const record: PresetRecord = {
    id,
    kind: options.kind,
    name: options.name.trim(),
    data: checked.data,
  };
  const nameParsed = PresetRecordSchema.shape.name.safeParse(record.name);
  if (!nameParsed.success) {
    return { ok: false, error: "invalid preset name" };
  }

  const idx = store.presets.findIndex((p) => p.id === id);
  if (idx >= 0) {
    store.presets[idx] = record;
  } else {
    store.presets.push(record);
  }
  await writeStore(filePath, store);
  return { ok: true, preset: record };
}

export async function deletePreset(options: {
  id: string;
  path?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const filePath = resolvePresetsPath(options.path);
  const store = await readStore(filePath);
  const next = store.presets.filter((p) => p.id !== options.id);
  if (next.length === store.presets.length) {
    return { ok: false, error: `preset not found: ${options.id}` };
  }
  await writeStore(filePath, { version: 1, presets: next });
  return { ok: true };
}

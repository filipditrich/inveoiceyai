import { createHash } from "node:crypto";

/**
 * Inputs that change what `GET /api/drive/index` would return.
 * Stamps are hashes of ids and timestamps, not invoice payloads.
 */
export interface DriveIndexRevisionInput {
  pragueDate: string;
  layoutTemplate: string;
  includeIsdoc: boolean;
  hiddenWorkspaceIds: readonly string[];
  workspaces: readonly { id: string; name: string }[];
  invoiceCount: number;
  invoiceStamp: string;
  issuerStamp: string;
}

export function driveIndexRevisionKey(input: DriveIndexRevisionInput): string {
  const hidden = [...input.hiddenWorkspaceIds].sort().join(",");
  const spaces = [...input.workspaces]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((workspace) => `${workspace.id}=${workspace.name}`)
    .join(",");
  return [
    "v1",
    input.pragueDate,
    input.layoutTemplate,
    input.includeIsdoc ? "1" : "0",
    hidden,
    spaces,
    String(input.invoiceCount),
    input.invoiceStamp,
    input.issuerStamp,
  ].join("\n");
}

/** Quoted strong validator for `ETag` / `If-None-Match`. */
export function driveIndexEtag(input: DriveIndexRevisionInput): string {
  const digest = createHash("sha256")
    .update(driveIndexRevisionKey(input))
    .digest("hex");
  return `"drv1-${digest}"`;
}

/**
 * True when the request already has this representation.
 * Accepts `*`, a single tag, and a comma-separated list, including weak tags.
 */
export function ifNoneMatchHits(header: string | null, etag: string): boolean {
  if (!header) {
    return false;
  }
  const trimmed = header.trim();
  if (trimmed === "*") {
    return true;
  }
  return trimmed.split(",").some((part) => {
    const token = part.trim().replace(/^W\//, "");
    return token === etag;
  });
}

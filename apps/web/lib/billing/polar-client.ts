import "server-only";
import { Polar } from "@polar-sh/sdk";

import { getPolarCatalog, type PolarCatalog } from "./catalog";

export function getPolarClient(catalog: PolarCatalog): Polar {
  return new Polar({
    accessToken: catalog.accessToken,
    server: catalog.environment,
  });
}

export function requirePolarCatalog(): PolarCatalog {
  const catalog = getPolarCatalog();
  if (!catalog) {
    throw new Error("Polar billing is not configured");
  }
  return catalog;
}

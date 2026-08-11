import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/docs-source";

/**
 * Search index for `/docs`, consumed by Fumadocs' `RootProvider`.
 *
 * Named `docs-search` rather than `search` so it cannot collide with a future
 * app-wide search endpoint — the client is pointed at it explicitly in
 * `app/(docs)/docs/layout.tsx`.
 */
export const { GET } = createFromSource(source, {
  language: "english",
});

import { env } from "@/env.config.server";
import { source } from "@/lib/docs-source";

import type { MetadataRoute } from "next";

const PUBLIC_ROUTES = ["", "/privacy", "/terms", "/cookies"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((path) => ({
    url: new URL(path || "/", env.NEXT_PUBLIC_APP_URL).toString(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.3,
  }));

  /** Every `content/docs` page — the docs are public and worth indexing. */
  const docsEntries: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: new URL(page.url, env.NEXT_PUBLIC_APP_URL).toString(),
    changeFrequency: "monthly",
    priority: page.url === "/docs" ? 0.8 : 0.5,
  }));

  return [...staticEntries, ...docsEntries];
}

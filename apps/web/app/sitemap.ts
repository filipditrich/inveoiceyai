import type { MetadataRoute } from "next";

import { env } from "@/env.config.server";

const PUBLIC_ROUTES = ["", "/privacy", "/terms", "/cookies"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_ROUTES.map((path) => ({
    url: new URL(path || "/", env.NEXT_PUBLIC_APP_URL).toString(),
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.3,
  }));
}

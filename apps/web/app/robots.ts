import type { MetadataRoute } from "next";

import { env } from "@/env.config.server";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms", "/cookies"],
      disallow: [
        "/api/",
        "/dashboard",
        "/invoices",
        "/clients",
        "/issuers",
        "/settings/account",
        "/onboarding",
        "/sign-in",
        "/eve/",
      ],
    },
    sitemap: new URL("/sitemap.xml", env.NEXT_PUBLIC_APP_URL).toString(),
    host: env.NEXT_PUBLIC_APP_URL,
  };
}

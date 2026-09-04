import { env } from "@/env.config.server";

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/brand",
        "/privacy",
        "/terms",
        "/cookies",
        "/faktura-zdarma",
        "/free-invoice-generator",
      ],
      disallow: [
        "/api/",
        "/dashboard",
        "/invoices",
        "/clients",
        "/issuers",
        "/settings/account",
        "/onboarding",
        "/sign-in",
        "/claim",
        "/eve/",
      ],
    },
    sitemap: new URL("/sitemap.xml", env.NEXT_PUBLIC_APP_URL).toString(),
    host: env.NEXT_PUBLIC_APP_URL,
  };
}

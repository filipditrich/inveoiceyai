import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { BrandLogo } from "@/components/brand-logo";

/**
 * Chrome shared by every Fumadocs layout under `/docs`.
 *
 * The docs are public — the links here point at the app, not the other way
 * round, so a signed-out reader always has somewhere to go.
 */
export function docsBaseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <BrandLogo size={24} />
          <span className="font-semibold">Invoicey docs</span>
        </>
      ),
      url: "/docs",
    },
    githubUrl: "https://github.com/filipditrich/inveoiceyai",
    links: [
      {
        text: "Open app",
        url: "/dashboard",
        active: "none",
      },
    ],
  };
}

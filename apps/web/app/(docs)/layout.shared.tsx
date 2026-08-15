import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import { ArrowUpRightIcon } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";

const GITHUB_URL = "https://github.com/filipditrich/inveoiceyai";

/**
 * Chrome shared by every Fumadocs layout under `/docs`.
 *
 * The docs are public — the links here point at the app, not the other way
 * round, so a signed-out reader always has somewhere to go.
 *
 * `githubUrl` puts the GitHub icon in the sidebar footer pill next to the
 * theme switch. `GithubInfo` is too tall for that slot and leaves the pill
 * empty.
 */
export function docsBaseOptions(): Omit<DocsLayoutProps, "tree"> {
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
    githubUrl: GITHUB_URL,
    links: [
      {
        type: "button",
        text: "Open app",
        url: "/dashboard",
        icon: <ArrowUpRightIcon className="size-3.5" />,
        active: "none",
      },
    ],
  };
}

import { BrandLogo } from "@/components/brand-logo";
import { ArrowUpRightIcon } from "lucide-react";

import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";

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
          <BrandLogo size={22} variant="wordmark" />
          <span className="font-semibold text-muted-foreground">Docs</span>
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

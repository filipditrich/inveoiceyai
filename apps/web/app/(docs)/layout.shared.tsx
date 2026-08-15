import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import { GithubInfo } from "fumadocs-ui/components/github-info";
import { ArrowUpRightIcon } from "lucide-react";
import { Suspense } from "react";

import { BrandLogo } from "@/components/brand-logo";

const GITHUB_OWNER = "filipditrich";
const GITHUB_REPO = "inveoiceyai";
const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

/**
 * Chrome shared by every Fumadocs layout under `/docs`.
 *
 * The docs are public — the links here point at the app, not the other way
 * round, so a signed-out reader always has somewhere to go.
 *
 * Prefer `sidebar.footer` + `GithubInfo` over `githubUrl`: the latter only
 * renders an icon button (empty gap next to the theme switch).
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
    links: [
      {
        type: "button",
        text: "Open app",
        url: "/dashboard",
        icon: <ArrowUpRightIcon className="size-3.5" />,
        active: "none",
      },
    ],
    sidebar: {
      footer: (
        <Suspense
          fallback={
            <a
              className="text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground flex items-center gap-2 rounded-lg p-2 text-sm transition-colors"
              href={GITHUB_URL}
              rel="noreferrer noopener"
              target="_blank"
            >
              {GITHUB_OWNER}/{GITHUB_REPO}
            </a>
          }
        >
          <GithubInfo owner={GITHUB_OWNER} repo={GITHUB_REPO} />
        </Suspense>
      ),
    },
  };
}

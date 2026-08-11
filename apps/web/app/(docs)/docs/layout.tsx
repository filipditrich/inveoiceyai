import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

import { source } from "@/lib/docs-source";

import { docsBaseOptions } from "../layout.shared";

/**
 * `theme.enabled: false` — the root layout already mounts a `next-themes`
 * `ThemeProvider` (`storageKey: "invoicey-theme"`). A second one would fight it
 * over the `class` attribute and split light/dark preference across two keys.
 */
export default function DocsRootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <RootProvider
      search={{ options: { api: "/api/docs-search" } }}
      theme={{ enabled: false }}
    >
      <DocsLayout tree={source.getPageTree()} {...docsBaseOptions()}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}

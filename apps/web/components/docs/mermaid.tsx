"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";

let mermaidModule: Promise<typeof import("mermaid")> | undefined;

function loadMermaid() {
  mermaidModule ??= import("mermaid");
  return mermaidModule;
}

/**
 * Client-side Mermaid renderer for product docs. Theme follows next-themes.
 * Render runs in an effect (not `use()`) so a failed diagram cannot trip
 * React's retry path into a document reload loop.
 */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replaceAll(":", "");
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const theme = resolvedTheme === "light" ? "default" : "dark";

    void (async () => {
      const { default: mermaid } = await loadMermaid();
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        fontFamily: "inherit",
        themeCSS: "margin: 1.5rem auto 0;",
        theme,
      });
      try {
        const rendered = await mermaid.render(
          `mermaid-${id}`,
          chart.replaceAll("\\n", "\n"),
        );
        if (!cancelled) {
          setSvg(rendered.svg);
        }
      } catch {
        if (!cancelled) {
          setSvg(undefined);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  if (!svg) {
    return (
      <div
        aria-hidden
        className="my-4 h-32 animate-pulse rounded-lg bg-fd-muted"
      />
    );
  }

  return (
    <div
      className="my-4 overflow-x-auto [&_svg]:mx-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

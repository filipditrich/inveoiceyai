"use client";

import { Suspense, use, useId, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

/**
 * Client-side Mermaid renderer for product docs. Theme follows next-themes.
 */
export function Mermaid({ chart }: { chart: string }) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="my-4 h-32 animate-pulse rounded-lg bg-fd-muted"
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div
          aria-hidden
          className="my-4 h-32 animate-pulse rounded-lg bg-fd-muted"
        />
      }
    >
      <MermaidContent chart={chart} />
    </Suspense>
  );
}

const cache = new Map<string, Promise<unknown>>();

function cachePromise<T>(
  key: string,
  setPromise: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached as Promise<T>;

  const promise = setPromise();
  cache.set(key, promise);
  return promise;
}

function MermaidContent({ chart }: { chart: string }) {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const { default: mermaid } = use(
    cachePromise("mermaid", () => import("mermaid")),
  );

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    fontFamily: "inherit",
    themeCSS: "margin: 1.5rem auto 0;",
    theme: resolvedTheme === "dark" ? "dark" : "default",
  });

  const safeId = id.replaceAll(":", "");
  const { svg, bindFunctions } = use(
    cachePromise(`${chart}-${resolvedTheme}`, () => {
      return mermaid.render(safeId, chart.replaceAll("\\n", "\n"));
    }),
  );

  return (
    <div
      className="my-4 overflow-x-auto [&_svg]:mx-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
      ref={(container) => {
        if (container) bindFunctions?.(container);
      }}
    />
  );
}

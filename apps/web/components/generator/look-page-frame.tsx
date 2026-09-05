"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/** A4 at 96dpi. The DOM look interpreter fixes the page at `210mm`. */
const PAGE_WIDTH_PX = 793.7;
/** Below this the page is too small to read, so panning beats shrinking. */
const MIN_FIT_SCALE = 0.3;
/**
 * Above this the shrink is imperceptible, so it happens silently. Below it the
 * page is too small to type into and the reader needs a way back to 100%.
 */
const SILENT_FIT_SCALE = 0.9;

/**
 * Holds the fixed-width invoice page inside a phone viewport.
 *
 * At full size the page is ~794px wide, so on a phone the right-hand column —
 * totals, amount due, VAT — falls off screen and the document reads as broken.
 * Fitting it to the container shows the whole invoice; tapping it returns to
 * 100% for editing, where the horizontal scroll is expected rather than
 * surprising.
 */
export function LookPageFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("Generator");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [available, setAvailable] = React.useState<number | null>(null);
  const [fit, setFit] = React.useState(true);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAvailable(entry.contentRect.width);
    });
    observer.observe(node);
    setAvailable(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  const fitScale =
    available === null
      ? 1
      : Math.max(MIN_FIT_SCALE, Math.min(1, available / PAGE_WIDTH_PX));
  const scaled = fit && fitScale < 1;
  const cramped = fitScale < SILENT_FIT_SCALE;

  return (
    <div className={cn("space-y-2", className)}>
      {cramped ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {scaled ? t("zoomFitHint") : t("zoomActualHint")}
          </p>
          <button
            className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            onClick={() => setFit((current) => !current)}
            type="button"
          >
            {scaled ? t("zoomActual") : t("zoomFit")}
          </button>
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={cn(
          "relative rounded-2xl border bg-gradient-to-b from-muted/50 to-muted/20 p-3 shadow-inner sm:p-8",
          scaled ? "overflow-hidden" : "overflow-x-auto",
        )}
      >
        <div
          className="w-max max-w-full"
          // `zoom` keeps hit-testing and layout in document space, so the page
          // stays measurable and printable at any scale.
          style={scaled ? { zoom: fitScale } : undefined}
        >
          {children}
        </div>
        {cramped && scaled ? (
          // Fields are only a few pixels tall while scaled, so the whole page
          // is one target that returns to a size you can actually type into.
          <button
            aria-label={t("zoomTapToEdit")}
            className="absolute inset-0 z-10 cursor-zoom-in"
            onClick={() => setFit(false)}
            title={t("zoomTapToEdit")}
            type="button"
          />
        ) : null}
      </div>
    </div>
  );
}

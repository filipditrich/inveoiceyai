"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const PDF_VIEW_HASH = "#page=1&toolbar=0&navpanes=0&scrollbar=0&view=Fit";

export function InvoicePdfPreview({
  url,
  updating,
  error,
  errorDetail,
  lockedPreview = false,
  className,
  emptyLabel,
}: {
  url: string | null;
  updating?: boolean;
  error?: string | null;
  errorDetail?: string | null;
  lockedPreview?: boolean;
  className?: string;
  emptyLabel?: string;
}) {
  const t = useTranslations("PdfPreview");
  const src = url ? `${url}${PDF_VIEW_HASH}` : null;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md border bg-white",
        className,
      )}
      style={{ aspectRatio: "210 / 297" }}
    >
      {updating ? (
        <span className="absolute top-2 right-2 z-10 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
          {t("updating")}
        </span>
      ) : null}
      {error ? (
        <p className="absolute inset-x-2 top-2 z-10 rounded bg-background/90 px-2 py-1 text-xs text-destructive backdrop-blur">
          {error}
          {errorDetail ? (
            <span className="mt-1 block font-mono text-[0.65rem] leading-snug text-muted-foreground">
              {errorDetail}
            </span>
          ) : null}
        </p>
      ) : null}
      {src ? (
        <>
          <iframe
            className="absolute inset-0 h-full w-full border-0 bg-white"
            data-slot="pdf-frame"
            src={src}
            title={t("title")}
          />
          {lockedPreview ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center"
            >
              <span className="rotate-[-28deg] text-4xl font-semibold tracking-[0.35em] text-black/20 uppercase select-none">
                {t("lockedWatermark")}
              </span>
            </div>
          ) : null}
          <a
            className="absolute right-2 bottom-2 z-10 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground underline backdrop-blur"
            href={url ?? undefined}
            target="_blank"
            rel="noreferrer"
          >
            {t("open")}
          </a>
        </>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          data-slot="pdf-frame"
        >
          {emptyLabel ?? t("empty")}
        </div>
      )}
    </div>
  );
}

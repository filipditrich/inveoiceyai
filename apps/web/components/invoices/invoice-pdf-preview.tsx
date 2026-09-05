"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const PDF_VIEW_HASH = "#page=1&toolbar=0&navpanes=0&scrollbar=0&view=Fit";
const PDF_PAGE_FIT_HASH =
  "#page=1&toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit";

export function InvoicePdfPreview({
  url,
  updating,
  error,
  errorDetail,
  lockedPreview = false,
  className,
  emptyLabel,
  zoom = "fit",
}: {
  url: string | null;
  updating?: boolean;
  error?: string | null;
  errorDetail?: string | null;
  lockedPreview?: boolean;
  className?: string;
  emptyLabel?: string;
  zoom?: "fit" | "page-fit";
}) {
  const t = useTranslations("PdfPreview");
  // Phones do not render an inline PDF: the frame paints a blank A4-tall slab.
  // A compact card that links out is the honest surface there.
  const isMobile = useIsMobile();
  const hash = zoom === "page-fit" ? PDF_PAGE_FIT_HASH : PDF_VIEW_HASH;
  const src = url ? `${url}${hash}` : null;

  if (isMobile) {
    return (
      <CompactPdfPreview
        className={className}
        emptyLabel={emptyLabel}
        error={error}
        errorDetail={errorDetail}
        hasFile={src !== null}
        updating={updating}
        url={url}
      />
    );
  }

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

/**
 * A phone renders nothing for an inline PDF, so the A4-ratio frame would paint
 * a blank slab the height of a page. Name the file and link out instead.
 */
function CompactPdfPreview({
  url,
  hasFile,
  updating,
  error,
  errorDetail,
  className,
  emptyLabel,
}: {
  url: string | null;
  hasFile: boolean;
  updating?: boolean;
  error?: string | null;
  errorDetail?: string | null;
  className?: string;
  emptyLabel?: string;
}) {
  const t = useTranslations("PdfPreview");

  function statusLine(): string {
    if (error) return error;
    if (updating) return t("updating");
    if (hasFile) return t("mobileHint");
    return emptyLabel ?? t("empty");
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-md border bg-card p-4",
        className,
      )}
      data-slot="pdf-preview-compact"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileTextIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{t("title")}</p>
          <p className="truncate text-xs text-muted-foreground">
            {statusLine()}
          </p>
        </div>
      </div>
      {error && errorDetail ? (
        <p className="font-mono text-[0.65rem] leading-snug break-words text-muted-foreground">
          {errorDetail}
        </p>
      ) : null}
      {hasFile ? (
        <a
          className="inline-flex h-10 items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
          href={url ?? undefined}
          rel="noreferrer"
          target="_blank"
        >
          {t("open")}
        </a>
      ) : null}
    </div>
  );
}

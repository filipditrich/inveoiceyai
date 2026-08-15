"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const PDF_VIEW_HASH = "#page=1&toolbar=0&navpanes=0&scrollbar=0&view=Fit";

export function InvoicePdfPreview({
  url,
  updating,
  error,
  className,
  emptyLabel,
}: {
  url: string | null;
  updating?: boolean;
  error?: string | null;
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
        <span className="bg-background/80 text-muted-foreground absolute right-2 top-2 z-10 rounded px-2 py-1 text-xs backdrop-blur">
          {t("updating")}
        </span>
      ) : null}
      {error ? (
        <p className="bg-background/90 text-destructive absolute inset-x-2 top-2 z-10 rounded px-2 py-1 text-xs backdrop-blur">
          {error}
        </p>
      ) : null}
      {src ? (
        <iframe
          className="absolute inset-0 h-full w-full border-0 bg-white"
          data-slot="pdf-frame"
          src={src}
          title={t("title")}
        />
      ) : (
        <div
          className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm"
          data-slot="pdf-frame"
        >
          {emptyLabel ?? t("empty")}
        </div>
      )}
    </div>
  );
}

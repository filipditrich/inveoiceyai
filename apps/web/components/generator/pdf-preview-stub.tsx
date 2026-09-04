"use client";

import { cn } from "@/lib/utils";
import { FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function PdfPreviewStub({
  busy,
  onOpen,
}: {
  busy: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("Generator");
  return (
    <button
      aria-busy={busy}
      aria-label={t("previewReal")}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border bg-muted/40 text-left transition-colors",
        "hover:border-primary/40 hover:bg-muted/60",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
      onClick={onOpen}
      type="button"
    >
      <span
        aria-hidden
        className="pointer-events-none mx-auto my-3 block aspect-[210/297] w-[72%] origin-top rounded-sm bg-white shadow-sm"
        style={{ filter: "blur(1.4px)" }}
      >
        <span className="mt-3 ml-3 block h-2 w-1/3 rounded-sm bg-neutral-300" />
        <span className="mt-4 ml-3 flex gap-6">
          <span className="block h-8 w-2/5 rounded-sm bg-neutral-200" />
          <span className="block h-8 w-2/5 rounded-sm bg-neutral-200" />
        </span>
        <span className="mt-5 mr-3 ml-3 block h-10 rounded-sm bg-neutral-100" />
        <span className="mt-2 mr-3 ml-3 block h-10 rounded-sm bg-neutral-100" />
        <span className="mt-6 mr-3 ml-auto block h-8 w-2/5 rounded-sm bg-neutral-200" />
      </span>
      <span className="absolute inset-0 grid place-items-center bg-background/25">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
          <FileTextIcon className="size-3.5" />
          {busy ? t("previewLoading") : t("previewReal")}
        </span>
      </span>
    </button>
  );
}

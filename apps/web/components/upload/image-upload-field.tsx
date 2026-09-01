"use client";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/components/upload/upload-helpers";
import { UploadProgress } from "@/components/upload/upload-progress";
import { useFileDrop } from "@/components/upload/use-file-drop";
import { useTypedUploader } from "@/components/upload/use-typed-uploader";
import { cn } from "@/lib/utils";
import { CloudUploadIcon, ImageIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const IMAGE_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg";
const IMAGE_MAX_SIZE = 1024 * 1024;

type ImageEndpoint =
  | "issuerLogo"
  | "issuerStamp"
  | "issuerSignature"
  | "workspaceLogo";

export function ImageUploadField({
  endpoint,
  url,
  alt,
  disabled,
  onUrl,
}: {
  endpoint: ImageEndpoint;
  url: string;
  alt: string;
  disabled?: boolean;
  onUrl: (url: string | null) => void;
}) {
  const t = useTranslations("Upload");
  const hasUrl = url.trim().length > 0;
  const { startUpload, isUploading, progress } = useTypedUploader(
    endpoint,
    (files) => {
      const next = files[0]?.url;
      if (next) {
        onUrl(next);
      }
    },
  );
  const busy = Boolean(disabled || isUploading);
  const drop = useFileDrop({
    accept: IMAGE_ACCEPT,
    disabled: busy,
    multiple: false,
    onFiles: (files) => {
      void startUpload(files);
    },
  });

  if (hasUrl) {
    return (
      <div
        className={cn(
          "group/preview relative overflow-hidden rounded-xl border bg-muted/30 transition-colors",
          drop.isDragging && "border-primary bg-primary/5",
          busy && "pointer-events-none",
        )}
        {...drop.surfaceProps}
      >
        <input {...drop.inputProps} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={alt}
          className="mx-auto h-40 w-full object-contain p-4"
          src={url}
        />
        <Button
          aria-label={t("remove")}
          className="absolute end-2 top-2 z-10 size-6 rounded-full shadow-sm"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onUrl(null);
          }}
          size="icon-xs"
          type="button"
          variant="outline"
        >
          <XIcon />
        </Button>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-linear-to-t from-black/50 to-transparent p-3 opacity-0 transition-opacity group-focus-within/preview:opacity-100 group-hover/preview:opacity-100">
          <Button
            onClick={drop.open}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t("change")}
          </Button>
          <p className="text-xs text-white/80">{t("replaceHint")}</p>
        </div>
        {isUploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 px-8">
            <p className="text-sm font-medium">{t("uploading")}</p>
            <UploadProgress value={progress} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
        drop.isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        busy ? "pointer-events-none opacity-60" : "cursor-pointer",
      )}
      onClick={drop.open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          drop.open();
        }
      }}
      role="button"
      tabIndex={busy ? -1 : 0}
      {...drop.surfaceProps}
    >
      <input {...drop.inputProps} />
      <div
        className={cn(
          "mx-auto mb-3 flex size-8 items-center justify-center rounded-full border border-border",
          drop.isDragging && "border-primary/40 bg-primary/10",
        )}
      >
        {drop.isDragging ? (
          <ImageIcon className="size-4 text-primary" />
        ) : (
          <CloudUploadIcon className="size-4" />
        )}
      </div>
      <p className="mb-0.5 text-sm font-semibold text-foreground">
        {t("dropTitle")}
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        {t("hintImage", { maxSize: formatBytes(IMAGE_MAX_SIZE) })}
      </p>
      {isUploading ? (
        <div className="mx-auto max-w-xs space-y-2">
          <p className="text-xs text-muted-foreground">{t("uploading")}</p>
          <UploadProgress value={progress} />
        </div>
      ) : (
        <Button
          className="pointer-events-none"
          size="sm"
          tabIndex={-1}
          type="button"
        >
          {t("browse")}
        </Button>
      )}
    </div>
  );
}

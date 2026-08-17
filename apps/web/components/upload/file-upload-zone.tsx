"use client";

import { Button } from "@/components/ui/button";
import { useFileDrop } from "@/components/upload/use-file-drop";
import { useTypedUploader } from "@/components/upload/use-typed-uploader";
import {
  formatBytes,
  type UploadedFile,
} from "@/components/upload/upload-helpers";
import { UploadProgress } from "@/components/upload/upload-progress";
import { cn } from "@/lib/utils";
import {
  CloudUploadIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

type FileEndpoint =
  "incomingInvoiceDocument" | "importedInvoicePdf" | "importedInvoiceIsdoc";

function FileKindIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) {
    return <ImageIcon className="text-muted-foreground size-4" />;
  }
  if (type === "application/pdf") {
    return <FileTextIcon className="text-muted-foreground size-4" />;
  }
  return <FileIcon className="text-muted-foreground size-4" />;
}

export function FileUploadZone({
  endpoint,
  accept,
  hint,
  maxSize,
  multiple = true,
  disabled,
  files,
  onUploaded,
  onRemove,
}: {
  endpoint: FileEndpoint;
  accept: string;
  hint: string;
  maxSize: number;
  multiple?: boolean;
  disabled?: boolean;
  files?: UploadedFile[];
  onUploaded: (files: UploadedFile[]) => void;
  onRemove?: (url: string) => void;
}) {
  const t = useTranslations("Upload");
  const { startUpload, isUploading, progress } = useTypedUploader(
    endpoint,
    onUploaded,
  );
  const busy = Boolean(disabled || isUploading);
  const drop = useFileDrop({
    accept,
    disabled: busy,
    multiple,
    onFiles: (next) => {
      void startUpload(next);
    },
  });

  return (
    <div className="space-y-3">
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
            "border-border mx-auto mb-3 flex size-8 items-center justify-center rounded-full border",
            drop.isDragging && "border-primary/40 bg-primary/10",
          )}
        >
          <CloudUploadIcon
            className={cn("size-4", drop.isDragging && "text-primary")}
          />
        </div>
        <p className="text-foreground mb-0.5 text-sm font-semibold">
          {t("dropTitle")}
        </p>
        <p className="text-muted-foreground mb-4 text-xs">
          {hint} · {t("hintMax", { maxSize: formatBytes(maxSize) })}
        </p>
        {isUploading ? (
          <div className="mx-auto max-w-xs space-y-2">
            <p className="text-muted-foreground text-xs">{t("uploading")}</p>
            <UploadProgress value={progress} />
          </div>
        ) : (
          <Button
            className="pointer-events-none"
            size="sm"
            tabIndex={-1}
            type="button"
          >
            {multiple ? t("browseFiles") : t("browse")}
          </Button>
        )}
      </div>
      {files && files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.url}
              className="flex items-center gap-3 rounded-lg border px-3 py-2"
            >
              <div className="border-border flex size-8 shrink-0 items-center justify-center rounded-md border">
                <FileKindIcon type={file.type} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
              </div>
              {onRemove ? (
                <Button
                  aria-label={t("remove")}
                  onClick={() => {
                    onRemove(file.url);
                  }}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <XIcon />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

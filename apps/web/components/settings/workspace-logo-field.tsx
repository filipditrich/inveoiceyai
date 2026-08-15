"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UploadDropzone } from "@/lib/uploadthing";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function WorkspaceLogoField({
  url,
  canEdit,
  uploadConfigured,
  pending,
  onUrl,
}: {
  url: string;
  canEdit: boolean;
  uploadConfigured: boolean;
  pending: boolean;
  onUrl: (url: string | null) => void;
}) {
  const t = useTranslations("App.settings.workspace");
  const hasUrl = url.trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>{t("logoLabel")}</Label>
        <p className="text-muted-foreground text-xs">{t("logoHint")}</p>
      </div>
      {hasUrl ? (
        <div className="bg-muted/40 flex items-center gap-3 rounded-lg border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={t("logoLabel")}
            className="bg-background size-16 rounded-md object-cover"
            src={url}
          />
          {canEdit ? (
            <Button
              disabled={pending}
              onClick={() => {
                onUrl(null);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {pending ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : null}
              {t("removeLogo")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {canEdit && uploadConfigured ? (
        <UploadDropzone
          endpoint="workspaceLogo"
          onClientUploadComplete={(res) => {
            const first = res[0];
            const nextUrl =
              (first?.serverData as { url?: string } | undefined)?.url ??
              first?.ufsUrl ??
              first?.url;
            if (typeof nextUrl === "string" && nextUrl.length > 0) {
              onUrl(nextUrl);
            }
          }}
          onUploadError={(err) => {
            console.error(err);
          }}
        />
      ) : null}
      {canEdit && !uploadConfigured ? (
        <p className="text-muted-foreground text-xs">
          {t("uploadUnavailable")}
        </p>
      ) : null}
    </div>
  );
}

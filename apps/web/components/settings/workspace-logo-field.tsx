"use client";

import { ImageUploadField } from "@/components/upload/image-upload-field";
import { Label } from "@/components/ui/label";
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
      {canEdit && uploadConfigured ? (
        <ImageUploadField
          alt={t("logoLabel")}
          disabled={pending}
          endpoint="workspaceLogo"
          onUrl={onUrl}
          url={url}
        />
      ) : null}
      {canEdit && !uploadConfigured ? (
        <p className="text-muted-foreground text-xs">
          {t("uploadUnavailable")}
        </p>
      ) : null}
      {!canEdit && hasUrl ? (
        <div className="bg-muted/40 overflow-hidden rounded-xl border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={t("logoLabel")}
            className="mx-auto h-40 w-full object-contain p-4"
            src={url}
          />
        </div>
      ) : null}
    </div>
  );
}

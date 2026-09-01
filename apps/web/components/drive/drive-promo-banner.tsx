"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { HardDriveIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

const STORAGE_KEY = "invoicey-drive-banner-dismissed";

export function DrivePromoBanner() {
  const t = useTranslations("Invoices.detail");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== "1");
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5"
    >
      <HardDriveIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">{t("driveBannerTitle")}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("driveBannerBody")}
        </p>
        <Button
          className="h-auto px-0 text-sm"
          render={<Link href="/settings/account/drive" />}
          variant="link"
        >
          {t("driveBannerCta")}
        </Button>
      </div>
      <button
        type="button"
        className="rounded-md p-1 text-muted-foreground hover:text-foreground"
        aria-label={t("driveBannerDismiss")}
        onClick={() => {
          window.localStorage.setItem(STORAGE_KEY, "1");
          setVisible(false);
        }}
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}

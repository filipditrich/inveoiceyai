"use client";

import { canApplyLook, type LookRef } from "@invoicey/invoice-core/looks";
import { LockIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export type LookCatalogItem = {
  id: string;
  version: string;
  name: string;
};

export function LookPicker({
  looks,
  looksApply,
  value,
  onChange,
  allowLockedPreview = false,
  disabled = false,
}: {
  looks: readonly LookCatalogItem[];
  looksApply: "classic" | "catalog";
  value: LookRef;
  onChange: (look: LookRef) => void;
  allowLockedPreview?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("Looks");
  const lockedSelected =
    !canApplyLook(looksApply, value.id) && value.id !== "classic";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {looks.map((look) => {
          const entitled = canApplyLook(looksApply, look.id);
          const selected =
            value.id === look.id && value.version === look.version;
          return (
            <button
              key={`${look.id}@${look.version}`}
              aria-pressed={selected}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40",
                !entitled && "opacity-80",
              )}
              disabled={disabled || (!entitled && !allowLockedPreview)}
              onClick={() => onChange({ id: look.id, version: look.version })}
              type="button"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{look.name}</p>
                {!entitled ? (
                  <LockIcon className="text-muted-foreground size-3.5 shrink-0" />
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {t(
                  look.id === "minimal"
                    ? "catalog.minimal.description"
                    : "catalog.classic.description",
                )}
              </p>
              {!entitled ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  {t("upgradeHint")}
                </p>
              ) : (
                <p className="text-muted-foreground mt-2 text-xs tabular-nums">
                  {look.version}
                </p>
              )}
            </button>
          );
        })}
      </div>
      {lockedSelected ? (
        <p className="text-muted-foreground text-xs">
          {t.rich("lockedSelected", {
            upgrade: (chunks) => (
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href="/settings/workspace"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : null}
    </div>
  );
}

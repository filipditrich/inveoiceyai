"use client";

import {
  canApplyLook,
  type LookDocument,
  type LookRef,
} from "@invoicey/invoice-core/looks";
import { CheckIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { LookLayoutThumb } from "@/components/looks/look-layout-thumb";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type LookCatalogItem = {
  id: string;
  version: string;
  name: string;
  origin?: "first_party" | "workspace";
  layout?: LookDocument["layout"];
  accent?: string;
  paper?: string;
};

export function LookPicker({
  looks,
  looksApply,
  value,
  onChange,
  allowLockedPreview = false,
  disabled = false,
  manageHref,
}: {
  looks: readonly LookCatalogItem[];
  looksApply: "classic" | "catalog";
  value: LookRef;
  onChange: (look: LookRef) => void;
  allowLockedPreview?: boolean;
  disabled?: boolean;
  manageHref?: string;
}) {
  const t = useTranslations("Looks");
  const lockedSelected =
    !canApplyLook(looksApply, value.id) && value.id !== "classic";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
        {looks.map((look) => {
          const entitled = canApplyLook(looksApply, look.id);
          const selected =
            value.id === look.id && value.version === look.version;
          const descriptionKey =
            look.origin === "workspace"
              ? "catalog.workspace.description"
              : look.id === "minimal"
                ? "catalog.minimal.description"
                : "catalog.classic.description";
          return (
            <button
              key={`${look.id}@${look.version}`}
              aria-checked={selected}
              className={cn(
                "flex gap-3 rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5 ring-primary/20 ring-1"
                  : "border-border hover:bg-muted/40",
                !entitled && "opacity-80",
              )}
              disabled={disabled || (!entitled && !allowLockedPreview)}
              onClick={() => onChange({ id: look.id, version: look.version })}
              role="radio"
              type="button"
            >
              {look.layout ? (
                <LookLayoutThumb
                  accent={look.accent}
                  layout={look.layout}
                  paper={look.paper}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{look.name}</p>
                  <span className="flex shrink-0 items-center gap-1">
                    {selected ? (
                      <CheckIcon className="text-primary size-3.5" />
                    ) : null}
                    {!entitled ? (
                      <LockIcon className="text-muted-foreground size-3.5" />
                    ) : null}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">
                    {t(
                      look.origin === "workspace"
                        ? "origin.workspace"
                        : "origin.firstParty",
                    )}
                  </Badge>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {look.version}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                  {t(descriptionKey)}
                </p>
                {!entitled ? (
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    {t("upgradeHint")}
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      {manageHref && looksApply === "catalog" ? (
        <p className="text-muted-foreground text-xs">
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href={manageHref}
          >
            {t("manageLooks")}
          </Link>
        </p>
      ) : null}
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

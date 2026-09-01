"use client";

import { LookLayoutThumb } from "@/components/looks/look-layout-thumb";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckIcon, LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import {
  canApplyLook,
  type LookDocument,
  type LookRef,
} from "@invoicey/invoice-core/looks";

export type LookCatalogItem = {
  id: string;
  version: string;
  name: string;
  origin?: "first_party" | "workspace" | "community";
  layout?: LookDocument["layout"];
  accent?: string;
  paper?: string;
};

function lookPickerCopy(look: LookCatalogItem): {
  originKey: "origin.community" | "origin.workspace" | "origin.firstParty";
  descriptionKey:
    | "catalog.community.description"
    | "catalog.workspace.description"
    | "catalog.minimal.description"
    | "catalog.classic.description";
} {
  if (look.origin === "community") {
    return {
      originKey: "origin.community",
      descriptionKey: "catalog.community.description",
    };
  }
  if (look.origin === "workspace") {
    return {
      originKey: "origin.workspace",
      descriptionKey: "catalog.workspace.description",
    };
  }
  return {
    originKey: "origin.firstParty",
    descriptionKey:
      look.id === "minimal"
        ? "catalog.minimal.description"
        : "catalog.classic.description",
  };
}

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
          const { originKey, descriptionKey } = lookPickerCopy(look);
          return (
            <button
              key={`${look.id}@${look.version}`}
              aria-checked={selected}
              className={cn(
                "flex gap-3 rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
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
                      <CheckIcon className="size-3.5 text-primary" />
                    ) : null}
                    {!entitled ? (
                      <LockIcon className="size-3.5 text-muted-foreground" />
                    ) : null}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{t(originKey)}</Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {look.version}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {t(descriptionKey)}
                </p>
                {!entitled ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("upgradeHint")}
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      {manageHref && looksApply === "catalog" ? (
        <p className="text-xs text-muted-foreground">
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href={manageHref}
          >
            {t("manageLooks")}
          </Link>
        </p>
      ) : null}
      {lockedSelected ? (
        <p className="text-xs text-muted-foreground">
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

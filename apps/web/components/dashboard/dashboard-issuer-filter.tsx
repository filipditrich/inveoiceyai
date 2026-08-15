"use client";

import { Building2Icon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import type { IssuerOption } from "@/lib/invoice-party-types";

export function DashboardIssuerFilter({
  issuers,
  selectedId,
}: {
  issuers: IssuerOption[];
  selectedId?: string;
}) {
  const t = useTranslations("Dashboard.issuerFilter");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function selectIssuer(issuerId: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (issuerId) next.set("issuerId", issuerId);
    else next.delete("issuerId");
    startTransition(() => {
      router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, {
        scroll: false,
      });
    });
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="bg-card/70 shadow-xs flex max-w-3xl flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center">
        <span className="bg-brand/10 text-brand flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Building2Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor="dashboard-issuer" className="text-sm font-medium">
            {t("label")}
          </label>
          <p className="text-muted-foreground text-xs">{t("description")}</p>
        </div>
        <div className="relative sm:min-w-64">
          <select
            id="dashboard-issuer"
            className="border-input bg-background shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 h-10 w-full rounded-xl border pl-3 pr-10 text-sm font-medium outline-none"
            defaultValue={selectedId ?? ""}
            disabled={pending}
            onChange={(event) => selectIssuer(event.target.value)}
          >
            <option value="">{t("all")}</option>
            {issuers.map((issuer) => (
              <option key={issuer.id} value={issuer.id}>
                {issuer.snapshot.name}
              </option>
            ))}
          </select>
          {pending ? (
            <Loader2Icon className="text-muted-foreground pointer-events-none absolute right-3 top-3 size-4 animate-spin" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { Building2Icon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

  if (issuers.length < 2) {
    return null;
  }

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
    <div className="relative">
      <Building2Icon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <select
        id="dashboard-issuer"
        aria-label={t("label")}
        title={t("description")}
        className="h-8 max-w-56 min-w-44 rounded-lg border border-input bg-background py-0 pr-8 pl-8 text-sm font-medium shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
        <Loader2Icon className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}

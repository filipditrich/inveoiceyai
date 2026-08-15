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
        className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
      />
      <select
        id="dashboard-issuer"
        aria-label={t("label")}
        title={t("description")}
        className="border-input bg-background shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 h-8 min-w-44 max-w-56 rounded-lg border py-0 pl-8 pr-8 text-sm font-medium outline-none"
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
        <Loader2Icon className="text-muted-foreground pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin" />
      ) : null}
    </div>
  );
}

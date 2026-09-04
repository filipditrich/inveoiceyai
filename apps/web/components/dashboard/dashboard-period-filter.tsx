"use client";

import { useTransition } from "react";
import { CalendarIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function DashboardPeriodFilter({
  values,
  selected,
}: {
  values: string[];
  selected: string;
}) {
  const t = useTranslations("Dashboard.periodFilter");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function selectPeriod(period: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("period", period);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  function labelFor(value: string): string {
    if (value === "12m") return t("rolling12");
    if (value === "all") return t("all");
    return value;
  }

  return (
    <div className="relative">
      <CalendarIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <select
        id="dashboard-period"
        aria-label={t("label")}
        className="h-8 max-w-56 min-w-40 rounded-lg border border-input bg-background py-0 pr-8 pl-8 text-sm font-medium shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        defaultValue={selected}
        disabled={pending}
        onChange={(event) => selectPeriod(event.target.value)}
      >
        {values.map((value) => (
          <option key={value} value={value}>
            {labelFor(value)}
          </option>
        ))}
      </select>
      {pending ? (
        <Loader2Icon className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}

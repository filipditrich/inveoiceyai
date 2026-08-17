"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { SidebarInput } from "@/components/ui/sidebar";
import { SearchIcon } from "lucide-react";

export function SearchForm({
  inputId = "search",
  ...props
}: React.ComponentProps<"form"> & { inputId?: string }) {
  const t = useTranslations("App.search");
  return (
    <form action="/invoices" method="get" role="search" {...props}>
      <div className="relative">
        <Label htmlFor={inputId} className="sr-only">
          {t("label")}
        </Label>
        <SidebarInput
          id={inputId}
          name="q"
          placeholder={t("placeholder")}
          className="h-10 pl-7 md:h-8"
        />
        <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50" />
      </div>
    </form>
  );
}

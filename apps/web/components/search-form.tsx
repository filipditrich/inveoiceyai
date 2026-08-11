"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { SidebarInput } from "@/components/ui/sidebar";
import { SearchIcon } from "lucide-react";

export function SearchForm({ ...props }: React.ComponentProps<"form">) {
  const t = useTranslations("App.search");
  return (
    <form {...props}>
      <div className="relative">
        <Label htmlFor="search" className="sr-only">
          {t("label")}
        </Label>
        <SidebarInput
          id="search"
          placeholder={t("placeholder")}
          className="h-8 pl-7"
        />
        <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50" />
      </div>
    </form>
  );
}

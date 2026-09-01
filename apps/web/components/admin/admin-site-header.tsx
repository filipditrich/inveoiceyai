"use client";

import { Fragment } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminSiteHeader() {
  const pathname = usePathname();
  const t = useTranslations("Admin");

  const segmentLabels: Record<string, string> = {
    admin: t("breadcrumb.root"),
    users: t("breadcrumb.users"),
    workspaces: t("breadcrumb.workspaces"),
    invoices: t("breadcrumb.invoices"),
    issuers: t("breadcrumb.issuers"),
    audit: t("breadcrumb.audit"),
  };

  /** Detail routes end in an id; a raw UUID is not a useful crumb label. */
  const looksLikeId = (segment: string) => segment.length >= 16;

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { readonly href: string; readonly label: string }[] = [];
  let acc = "";
  for (const segment of segments) {
    acc += `/${segment}`;
    crumbs.push({
      href: acc,
      label:
        segmentLabels[segment] ??
        (looksLikeId(segment) ? t("breadcrumb.detail") : segment),
    });
  }

  const lastIndex = crumbs.length - 1;

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator className="mr-2 h-4" orientation="vertical" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, i) => (
            <Fragment key={crumb.href}>
              {i > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem className="min-w-0">
                {i === lastIndex ? (
                  <BreadcrumbPage className="truncate">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link prefetch href={crumb.href} />}>
                    <span className="truncate">{crumb.label}</span>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <ThemeToggle />
    </header>
  );
}

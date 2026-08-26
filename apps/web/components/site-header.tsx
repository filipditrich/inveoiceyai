"use client";

import { SearchForm } from "@/components/search-form";
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
import { Fragment } from "react";
import { SearchIcon } from "lucide-react";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function SiteHeader() {
  const pathname = usePathname();
  const t = useTranslations("App");

  const segmentLabels: Record<string, string> = {
    dashboard: t("breadcrumb.dashboard"),
    invoices: t("breadcrumb.invoices"),
    payments: t("breadcrumb.payments"),
    welcome: t("breadcrumb.welcome"),
    inbox: t("breadcrumb.inbox"),
    runs: t("breadcrumb.runs"),
    upload: t("breadcrumb.upload"),
    clients: t("breadcrumb.clients"),
    issuers: t("breadcrumb.issuers"),
    settings: t("breadcrumb.settings"),
    ai: t("breadcrumb.ai"),
    security: t("breadcrumb.security"),
    workspace: t("breadcrumb.workspace"),
    members: t("breadcrumb.members"),
    referrals: t("breadcrumb.referrals"),
    "api-keys": t("breadcrumb.api-keys"),
    integrations: t("breadcrumb.integrations"),
    usage: t("breadcrumb.usage"),
    "bank-connections": t("breadcrumb.bank-connections"),
    "from-json": t("breadcrumb.fromJson"),
    import: t("breadcrumb.import"),
    recurring: t("breadcrumb.recurring"),
    new: t("breadcrumb.new"),
    edit: t("breadcrumb.edit"),
  };

  function labelForSegment(segment: string, parent?: string): string {
    if (segmentLabels[segment]) {
      return segmentLabels[segment];
    }
    if (UUID_RE.test(segment)) {
      if (parent === "invoices") {
        return t("breadcrumb.invoice");
      }
      if (parent === "issuers") {
        return t("breadcrumb.issuer");
      }
      if (parent === "clients") {
        return t("breadcrumb.client");
      }
      return t("breadcrumb.detail");
    }
    return segment;
  }

  const segments = pathname.split("/").filter(Boolean);

  const crumbs: { readonly href: string; readonly label: string }[] = [
    { href: "/dashboard", label: t("meta.title") },
  ];
  let acc = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    acc += `/${segment}`;
    crumbs.push({
      href: acc,
      label: labelForSegment(segment, segments[i - 1]),
    });
  }

  const lastIndex = crumbs.length - 1;

  return (
    <header className="bg-background/80 sticky top-0 z-50 flex w-full shrink-0 border-b backdrop-blur-md">
      <div className="h-(--header-height) group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex w-full items-center gap-2 px-4 transition-[height] duration-200 ease-linear">
        <SidebarTrigger
          aria-label={t("a11y.toggleSidebar")}
          className="-ml-1 size-10 sm:size-7"
          title="⌘ / Ctrl+B"
        />
        <Separator
          className="data-vertical:h-4 data-vertical:self-center mr-2"
          orientation="vertical"
        />
        {/* Breadcrumbs do not fit a phone; the current page label keeps the
            header from being an anonymous strip of icons. */}
        <span className="mr-auto min-w-0 flex-1 truncate text-sm font-medium sm:hidden">
          {crumbs[lastIndex]?.label}
        </span>
        <Breadcrumb className="mr-auto hidden min-w-0 flex-1 sm:flex">
          <BreadcrumbList className="min-w-0">
            {crumbs.map((crumb, index) => (
              <Fragment key={`${index}:${crumb.href}`}>
                <BreadcrumbItem className="min-w-0">
                  {index === lastIndex ? (
                    <BreadcrumbPage className="truncate font-normal">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      render={<Link prefetch href={crumb.href} />}
                    >
                      <span className="truncate">{crumb.label}</span>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < lastIndex ? <BreadcrumbSeparator /> : null}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-1.5">
          <SearchForm className="hidden w-full sm:block sm:max-w-xs" />
          <details className="group relative sm:hidden">
            <summary className="hover:bg-muted focus-visible:ring-ring flex size-10 cursor-pointer list-none items-center justify-center rounded-md outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
              <SearchIcon className="size-4" aria-hidden="true" />
              <span className="sr-only">{t("search.label")}</span>
            </summary>
            <div className="bg-popover absolute right-0 top-10 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-lg border p-3 shadow-xl">
              <SearchForm inputId="mobile-search" />
            </div>
          </details>
          <ThemeToggle className="size-10 sm:size-7" />
        </div>
      </div>
    </header>
  );
}

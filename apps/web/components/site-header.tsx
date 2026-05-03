"use client"

import { SearchForm } from "@/components/search-form"
import { ModalSmokeButton } from "@/features/modals-manager/modal-smoke-button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  invoices: "Invoices",
  clients: "Clients",
  issuers: "Issuers",
  settings: "Settings",
  "from-json": "From JSON",
}

function labelForSegment(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment
}

export function SiteHeader() {
  const pathname = usePathname()

  const segments = pathname.split("/").filter(Boolean)

  const crumbs: { readonly href: string; readonly label: string }[] = [
    { href: "/dashboard", label: "Invoicey" },
  ]
  let acc = ""
  for (const segment of segments) {
    acc += `/${segment}`
    crumbs.push({ href: acc, label: labelForSegment(segment) })
  }

  const lastIndex = crumbs.length - 1

  return (
    <header className="bg-background sticky top-0 z-50 flex w-full shrink-0 border-b">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4 transition-[height] duration-200 ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger
          className="-ml-1"
          aria-label="Přepnout postranní panel"
          title="⌘ / Ctrl+B"
        />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-center"
        />
        <Breadcrumb className="mr-auto hidden min-w-0 flex-1 sm:flex">
          <BreadcrumbList className="min-w-0">
            {crumbs.map((crumb, index) => (
              <span className="contents" key={crumb.href}>
                <BreadcrumbItem className="min-w-0">
                  {index === lastIndex ? (
                    <BreadcrumbPage className="truncate font-normal">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link prefetch href={crumb.href} />}>
                      <span className="truncate">{crumb.label}</span>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < lastIndex ? <BreadcrumbSeparator /> : null}
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <SearchForm className="w-full sm:max-w-xs" />
        <ModalSmokeButton />
      </div>
    </header>
  )
}

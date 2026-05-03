"use client"

import { SearchForm } from "@/components/search-form"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"
import { PanelLeftIcon } from "lucide-react"
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
  const { toggleSidebar } = useSidebar()

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
    <header className="sticky top-0 z-50 flex w-full shrink-0 items-center border-b bg-background">
      <div className="flex h-[var(--header-height)] w-full items-center gap-3 px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="-ml-1"
          aria-label="Přepnout postranní panel"
          title="⌘ / Ctrl+B"
          onClick={toggleSidebar}
        >
          <PanelLeftIcon />
        </Button>
        <Separator
          orientation="vertical"
          className="mr-1 data-vertical:h-4 data-vertical:self-center"
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
      </div>
    </header>
  )
}

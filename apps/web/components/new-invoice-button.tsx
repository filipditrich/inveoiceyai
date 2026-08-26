"use client";

import {
  ArchiveRestoreIcon,
  BracesIcon,
  ChevronDownIcon,
  FileTextIcon,
  PlusIcon,
  RepeatIcon,
  SparklesIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";

import { NavLinkPending } from "@/components/navigation/nav-link-pending";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface CreateEntry {
  href: string;
  labelKey:
    | "invoiceBlank"
    | "invoicesAi"
    | "invoicesRecurring"
    | "invoicesFromJson"
    | "invoicesImport";
  icon: ReactNode;
}

/**
 * Blank, AI, recurring, JSON, and import are all answers to "how do I get an
 * invoice in here", so they hang off the create button instead of taking five
 * permanent sidebar rows.
 */
const CREATE_ENTRIES: CreateEntry[] = [
  { href: "/invoices/new", labelKey: "invoiceBlank", icon: <FileTextIcon /> },
  { href: "/invoices/ai", labelKey: "invoicesAi", icon: <SparklesIcon /> },
  {
    href: "/invoices/recurring",
    labelKey: "invoicesRecurring",
    icon: <RepeatIcon />,
  },
];

const TOOL_ENTRIES: CreateEntry[] = [
  {
    href: "/invoices/import",
    labelKey: "invoicesImport",
    icon: <ArchiveRestoreIcon />,
  },
  {
    href: "/invoices/from-json",
    labelKey: "invoicesFromJson",
    icon: <BracesIcon />,
  },
];

export function NewInvoiceButton({ pathname }: { pathname: string }) {
  const t = useTranslations("App.nav");
  const { isMobile, state } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  const renderEntries = (entries: CreateEntry[]) =>
    entries.map((entry) => (
      <DropdownMenuItem
        key={entry.href}
        render={<Link href={entry.href} prefetch />}
      >
        <span className="text-muted-foreground [&_svg]:size-4">
          {entry.icon}
        </span>
        {t(entry.labelKey)}
      </DropdownMenuItem>
    ));

  const menu = (
    <DropdownMenuContent
      align="start"
      className="min-w-60 rounded-lg"
      side={isMobile ? "bottom" : "right"}
      sideOffset={6}
    >
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("createGroup")}</DropdownMenuLabel>
        {renderEntries(CREATE_ENTRIES)}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("toolsGroup")}</DropdownMenuLabel>
        {renderEntries(TOOL_ENTRIES)}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );

  // Collapsed to icons there is no room for a split; the whole button becomes
  // the menu so every create path stays reachable.
  if (collapsed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground shadow-xs"
                  tooltip={t("newInvoice")}
                />
              }
            >
              <PlusIcon className="size-4" />
              <span className="sr-only">{t("newInvoice")}</span>
            </DropdownMenuTrigger>
            {menu}
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-stretch gap-1">
        <SidebarMenuButton
          className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground shadow-xs flex-1"
          isActive={pathname === "/invoices/new"}
          render={<Link href="/invoices/new" prefetch />}
          tooltip={t("newInvoice")}
        >
          <PlusIcon className="size-4" />
          <span className="font-medium">{t("newInvoice")}</span>
          <NavLinkPending />
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("newInvoiceMore")}
            className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 focus-visible:ring-sidebar-ring data-[popup-open]:bg-sidebar-primary/90 shadow-xs flex w-8 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2"
          >
            <ChevronDownIcon className="size-4" />
          </DropdownMenuTrigger>
          {menu}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

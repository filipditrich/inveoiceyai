"use client";

import * as React from "react";
import { NavLinkPending } from "@/components/navigation/nav-link-pending";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

function renderNavAnchor(url: string) {
  const isAppPath = url.startsWith("/");
  if (isAppPath) {
    /** full prefetch 404-retries every shell link on Next 16.3 */
    return <Link href={url} prefetch={false} />;
  }
  return <a href={url} target="_blank" rel="noreferrer" />;
}

export function NavMain({
  items,
  groupLabel = "Platform",
  collapseLabel,
}: {
  items: {
    title: string;
    url: string;
    icon: React.ReactNode;
    isActive?: boolean;
    /** always expand invoices submenu */
    defaultOpen?: boolean;
    items?: {
      title: string;
      url: string;
      isActive?: boolean;
      icon?: React.ReactNode;
    }[];
  }[];
  groupLabel?: string;
  collapseLabel?: (title: string) => string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[0.65rem] tracking-[0.14em] uppercase">
        {groupLabel}
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {items.map((item) => (
          <Collapsible
            key={item.title}
            defaultOpen={item.defaultOpen ?? item.isActive}
            render={<SidebarMenuItem />}
          >
            <SidebarMenuButton
              tooltip={item.title}
              isActive={item.isActive}
              render={renderNavAnchor(item.url)}
              className="transition-colors"
            >
              <span className="text-muted-foreground group-data-active/menu-button:text-sidebar-primary [&_svg]:size-4">
                {item.icon}
              </span>
              <span>{item.title}</span>
              <NavLinkPending />
            </SidebarMenuButton>
            {item.items?.length ? (
              <>
                <SidebarMenuAction
                  render={<CollapsibleTrigger />}
                  className="aria-expanded:rotate-90"
                >
                  <ChevronRightIcon />
                  <span className="sr-only">
                    {collapseLabel
                      ? collapseLabel(item.title)
                      : `Toggle ${item.title}`}
                  </span>
                </SidebarMenuAction>
                <CollapsibleContent>
                  <SidebarMenuSub className="ml-3.5 border-l border-dashed border-sidebar-border/80">
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          isActive={subItem.isActive}
                          render={renderNavAnchor(subItem.url)}
                        >
                          {subItem.icon ? (
                            <span className="text-muted-foreground [&_svg]:size-3.5">
                              {subItem.icon}
                            </span>
                          ) : null}
                          <span>{subItem.title}</span>
                          <NavLinkPending className="size-3" />
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </>
            ) : null}
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

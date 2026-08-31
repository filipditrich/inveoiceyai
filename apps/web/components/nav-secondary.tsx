"use client";

import * as React from "react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";

import { NavLinkPending } from "@/components/navigation/nav-link-pending";

function renderSecondaryAnchor(url: string) {
  if (url.startsWith("/")) {
    /** full prefetch 404-retries every shell link on Next 16.3 */
    return <Link href={url} prefetch={false} />;
  }
  return <a href={url} target="_blank" rel="noreferrer" />;
}

export function NavSecondary({
  items,
  groupLabel = "Resources",
  ...props
}: {
  items: {
    title: string;
    url: string;
    icon: React.ReactNode;
    isActive?: boolean;
  }[];
  groupLabel?: string;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupLabel className="text-[0.65rem] uppercase tracking-[0.14em]">
        {groupLabel}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={item.isActive}
                render={renderSecondaryAnchor(item.url)}
                tooltip={item.title}
              >
                <span className="text-muted-foreground group-data-active/menu-button:text-sidebar-primary [&_svg]:size-4">
                  {item.icon}
                </span>
                <span>{item.title}</span>
                <NavLinkPending />
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

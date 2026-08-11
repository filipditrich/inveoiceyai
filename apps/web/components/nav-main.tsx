"use client";

import * as React from "react";

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
    return <Link prefetch href={url} />;
  }
  return <a href={url} target="_blank" rel="noreferrer" />;
}

export function NavMain({
  items,
  groupLabel = "Platform",
}: {
  items: {
    title: string;
    url: string;
    icon: React.ReactNode;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
      isActive?: boolean;
      icon?: React.ReactNode;
    }[];
  }[];
  groupLabel?: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[0.65rem] uppercase tracking-[0.14em]">
        {groupLabel}
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {items.map((item) => (
          <Collapsible
            key={item.title}
            defaultOpen={item.isActive}
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
            </SidebarMenuButton>
            {item.items?.length ? (
              <>
                <SidebarMenuAction
                  render={<CollapsibleTrigger />}
                  className="aria-expanded:rotate-90"
                >
                  <ChevronRightIcon />
                  <span className="sr-only">
                    Rozbalit nebo sbalit {item.title}
                  </span>
                </SidebarMenuAction>
                <CollapsibleContent>
                  <SidebarMenuSub className="border-sidebar-border/80 ml-3.5 border-l border-dashed">
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

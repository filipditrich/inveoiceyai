"use client"

import * as React from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link"

function renderSecondaryAnchor(url: string) {
  if (url.startsWith("/")) {
    return <Link prefetch href={url} />
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" />
  )
}

export function NavSecondary({
  items,
  groupLabel = "Resources",
  ...props
}: {
  items: {
    title: string
    url: string
    icon: React.ReactNode
  }[]
  groupLabel?: string
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupLabel className="px-4">{groupLabel}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                size="sm"
                render={renderSecondaryAnchor(item.url)}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

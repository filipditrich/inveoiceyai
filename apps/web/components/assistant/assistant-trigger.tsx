"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAssistant } from "./assistant-provider";

/** Sidebar entry for the assistant. Also on ⌘J / Ctrl+J. */
export function AssistantSidebarTrigger() {
  const t = useTranslations("Assistant");
  const { open, toggle } = useAssistant();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={open}
          onClick={toggle}
          tooltip={`${t("title")} (⌘J)`}
        >
          <SparklesIcon />
          <span>{t("title")}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

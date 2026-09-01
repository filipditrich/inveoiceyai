"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";

import { useAssistant } from "./assistant-provider";

/**
 * Opens the assistant panel from anywhere in the app.
 *
 * The entry points that used to link to `/invoices/ai` use this instead: a
 * conversation about the invoice you are looking at should not begin by
 * navigating away from it.
 */
export function AssistantOpenButton({
  children,
  size,
  variant,
}: {
  children: ReactNode;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  const { setOpen } = useAssistant();
  return (
    <Button onClick={() => setOpen(true)} size={size} variant={variant}>
      {children}
    </Button>
  );
}

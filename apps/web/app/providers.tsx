"use client";

import type { PropsWithChildren } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  C15tBanner,
  C15tDevControls,
  C15tDialog,
  C15tProvider,
} from "@/features/c15t";
import { ModalsProvider } from "@/features/modals-manager/modals-provider";
import { registeredModals } from "@/features/modals-manager/registered-modals";
import { ThemeProvider } from "next-themes";

export default function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <TooltipProvider delay={0}>
        <ModalsProvider modals={registeredModals}>
          <C15tProvider>
            {children}
            <C15tBanner />
            <C15tDialog />
            <C15tDevControls />
          </C15tProvider>
        </ModalsProvider>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}

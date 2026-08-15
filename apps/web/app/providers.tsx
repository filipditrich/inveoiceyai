"use client";

import type { PropsWithChildren } from "react";

import { NavigationProgressProvider } from "@/components/navigation/navigation-progress";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  C15tBanner,
  C15tDialog,
  C15tProvider,
  ConsentAwareAnalytics,
} from "@/features/c15t";
import { ModalsProvider } from "@/features/modals-manager/modals-provider";
import { registeredModals } from "@/features/modals-manager/registered-modals";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function Providers({ children }: PropsWithChildren) {
  return (
    <NuqsAdapter>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
        storageKey="invoicey-theme"
      >
        <TooltipProvider delay={0}>
          <ModalsProvider modals={registeredModals}>
            <C15tProvider>
              <NavigationProgressProvider>
                {children}
              </NavigationProgressProvider>
              <ConsentAwareAnalytics />
              <C15tBanner />
              <C15tDialog />
            </C15tProvider>
          </ModalsProvider>
          <Toaster
            closeButton
            expand
            position="top-right"
            richColors
            visibleToasts={4}
          />
        </TooltipProvider>
      </ThemeProvider>
    </NuqsAdapter>
  );
}

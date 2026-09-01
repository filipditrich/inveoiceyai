"use client";

import type { PropsWithChildren } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type ModalMode = "dialog" | "drawer";

export interface ModalShellProps extends PropsWithChildren {
  mode: ModalMode;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  surfaceClassName?: string;
}

/** Vaul drawer or bottom sheet (`dialog`). */
export function ModalShell(props: ModalShellProps) {
  const { mode, open, onOpenChange, surfaceClassName, children } = props;

  if (mode === "drawer") {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn("max-h-[90vh]", surfaceClassName)}>
          {children}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "data-[side=bottom]:mx-auto data-[side=bottom]:max-h-[min(90vh,720px)] data-[side=bottom]:max-w-lg",
          surfaceClassName,
        )}
        showCloseButton
        side="bottom"
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}

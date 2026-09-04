"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MenuIcon } from "lucide-react";
import Link from "next/link";

type MobileNavLabels = Readonly<{
  description: string;
  openMenu: string;
  title: string;
}>;

type MobileNavProps = Readonly<{
  actions: ReactNode;
  items: readonly { href: string; label: string }[];
  labels: MobileNavLabels;
}>;

/**
 * The small-screen navigation. A sheet rather than an absolutely positioned
 * panel, so a long menu scrolls instead of running off the viewport.
 */
export function MarketingMobileNav({ actions, items, labels }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={labels.openMenu}
            className="xl:hidden"
          />
        }
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right" className="w-[19rem] gap-0 p-0">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>{labels.title}</SheetTitle>
          <SheetDescription>{labels.description}</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-2 border-t p-4">{actions}</div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useLinkStatus } from "next/link";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Must render as a descendant of `next/link` `Link`. */
export function NavLinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) {
    return null;
  }
  return (
    <Spinner
      className={cn("text-brand ml-auto size-3.5 shrink-0", className)}
    />
  );
}

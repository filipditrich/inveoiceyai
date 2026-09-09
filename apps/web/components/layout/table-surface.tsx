import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Solid card behind list tables so they do not sit transparent on the page. */
export function TableSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card text-card-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

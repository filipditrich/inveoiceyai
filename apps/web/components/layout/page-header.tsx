import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon, PanelsTopLeftIcon } from "lucide-react";
import Link from "next/link";

export function PageHeader({
  actions,
  back,
  className,
  description,
  eyebrow,
  filters,
  icon,
  title,
}: {
  actions?: ReactNode;
  back?: { href: string; label: ReactNode };
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  filters?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className={cn("border-b bg-transparent py-5 sm:py-6", className)}>
      {back ? (
        <Button
          className="mb-3 -ml-2 text-muted-foreground"
          render={<Link href={back.href} prefetch />}
          size="sm"
          variant="ghost"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {back.label}
        </Button>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border [&_svg]:size-4">
            {icon ?? <PanelsTopLeftIcon aria-hidden />}
          </div>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-1 text-xs font-medium tracking-[0.1em] text-primary uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-2xl font-medium tracking-[-0.03em] text-balance sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <div className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>
        </div>
        {filters || actions ? (
          /* Left-aligned and comfortably tapped on phones; the ragged
             right-aligned wrap only reads well once there is room for one row. */
          <div className="flex w-full max-w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            {filters}
            {actions ? (
              /** header actions share the default 32px control height */
              <div
                className="flex flex-wrap items-center gap-2 [&_[data-slot=button]]:h-8! max-md:[&_[data-slot=button]]:h-10!"
                data-slot="page-header-actions"
              >
                {actions}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

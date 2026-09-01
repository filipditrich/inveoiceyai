import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PanelsTopLeftIcon } from "lucide-react";

export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  filters,
  icon,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  filters?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-brand/[0.07] p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute -top-20 -right-12 size-44 rounded-full bg-brand/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/15 [&_svg]:size-5">
            {icon ?? <PanelsTopLeftIcon aria-hidden />}
          </div>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-1 text-xs font-medium tracking-[0.14em] text-brand uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-2xl font-semibold tracking-[-0.025em] text-balance sm:text-3xl">
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
          <div className="flex w-full max-w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end max-sm:[&_[data-slot=button]]:h-9">
            {filters}
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

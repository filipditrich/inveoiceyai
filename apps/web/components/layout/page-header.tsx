import { cn } from "@/lib/utils";
import { PanelsTopLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

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
        "from-card via-card to-brand/[0.07] relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      <div
        aria-hidden
        className="bg-brand/10 absolute -right-12 -top-20 size-44 rounded-full blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <div className="bg-brand/10 text-brand ring-brand/15 flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1 [&_svg]:size-5">
            {icon ?? <PanelsTopLeftIcon aria-hidden />}
          </div>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-brand mb-1 text-xs font-medium uppercase tracking-[0.14em]">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-balance text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <div className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
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

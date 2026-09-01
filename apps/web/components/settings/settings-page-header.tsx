import type { ReactNode } from "react";

export function SettingsPageHeader({
  description,
  icon,
  title,
}: {
  description: ReactNode;
  icon: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/15 [&_svg]:size-5">
        {icon}
      </div>
      <div className="min-w-0 space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

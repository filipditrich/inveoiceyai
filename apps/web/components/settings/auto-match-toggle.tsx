"use client";

import { useTransition } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type AutoMatchToggleProps = {
  connectionId: string;
  checked: boolean;
  disabled?: boolean;
  action: (formData: FormData) => Promise<void>;
};

/**
 * Server-action backed switch for exact auto-match. Submits through the
 * existing FormData contract (`connectionId`, `enabled`).
 */
export function AutoMatchToggle({
  connectionId,
  checked,
  disabled = false,
  action,
}: AutoMatchToggleProps) {
  const [pending, startTransition] = useTransition();

  return (
    <label
      className={cn(
        "flex shrink-0 items-center gap-2.5",
        (disabled || pending) && "cursor-not-allowed opacity-60",
      )}
    >
      <Switch
        checked={checked}
        disabled={disabled || pending}
        aria-label="Automatic exact matching"
        onCheckedChange={(next) => {
          const formData = new FormData();
          formData.set("connectionId", connectionId);
          formData.set("enabled", next ? "true" : "false");
          startTransition(() => {
            void action(formData);
          });
        }}
      />
      <span className="text-muted-foreground w-7 text-sm font-medium tabular-nums">
        {checked ? "On" : "Off"}
      </span>
    </label>
  );
}

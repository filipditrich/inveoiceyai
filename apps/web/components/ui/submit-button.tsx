"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export type SubmitButtonProps = ComponentProps<typeof Button> & {
  /** Label shown while the parent form action is pending */
  pendingLabel?: ReactNode;
};

/**
 * Submit control that mirrors the parent `<form action>` pending state via
 * `useFormStatus`. Must be rendered as a descendant of that form.
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  type = "submit",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled} loading={pending} type={type} {...props}>
      {pending && pendingLabel != null ? pendingLabel : children}
    </Button>
  );
}

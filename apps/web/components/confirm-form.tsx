"use client";

import type { ComponentProps } from "react";

export function ConfirmForm({
  message,
  onSubmit,
  children,
  ...props
}: ComponentProps<"form"> & { message: string }) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
          return;
        }
        onSubmit?.(event);
      }}
    >
      {children}
    </form>
  );
}

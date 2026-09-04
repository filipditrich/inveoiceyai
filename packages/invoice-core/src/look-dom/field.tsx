import React from "react";

import type { LookStyleBox } from "../looks/style-ir";
import { cssFromLookBox, cssFromLookText } from "./css";

const FIELD_RESET: React.CSSProperties = {
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 2,
  margin: 0,
  minWidth: 0,
  padding: 0,
  width: "100%",
  font: "inherit",
  color: "inherit",
  textAlign: "inherit",
  lineHeight: "inherit",
  letterSpacing: "inherit",
};

function fieldValue(target: EventTarget): string {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return target.value;
  }
  return "";
}

export function LookText({
  style,
  children,
  extra,
}: {
  style: LookStyleBox;
  children: React.ReactNode;
  extra?: React.CSSProperties;
}) {
  return <span style={cssFromLookText(style, extra)}>{children}</span>;
}

export function LookBox({
  style,
  children,
  extra,
  lookBlock,
  editable,
}: {
  style?: LookStyleBox;
  children?: React.ReactNode;
  extra?: React.CSSProperties;
  lookBlock?: string;
  editable?: boolean;
}) {
  return (
    <div
      data-look-block={lookBlock}
      data-look-editable={
        editable === undefined ? undefined : editable ? "true" : "false"
      }
      style={cssFromLookBox(style ?? { width: "100%" }, extra)}
    >
      {children}
    </div>
  );
}

export function LookField({
  value,
  onChange,
  style,
  extra,
  ariaLabel,
  type = "text",
  multiline = false,
  onEnter,
  placeholder,
}: {
  value: string;
  onChange?: (value: string) => void;
  style: LookStyleBox;
  extra?: React.CSSProperties;
  ariaLabel: string;
  type?: "text" | "date" | "number";
  multiline?: boolean;
  onEnter?: () => void;
  placeholder?: string;
}) {
  const empty = Boolean(onChange) && value.length === 0;
  const css: React.CSSProperties = {
    ...cssFromLookText(style, extra),
    ...FIELD_RESET,
    display: multiline ? "block" : "inline-block",
    minHeight: "1.15em",
    borderBottom: empty
      ? "1px dashed color-mix(in srgb, currentColor 45%, transparent)"
      : "1px solid transparent",
  };
  if (!onChange) {
    return <span style={cssFromLookText(style, extra)}>{value}</span>;
  }
  if (multiline) {
    return (
      <textarea
        aria-label={ariaLabel}
        onChange={(event) => onChange(fieldValue(event.currentTarget))}
        placeholder={placeholder}
        rows={3}
        style={css}
        value={value}
      />
    );
  }
  return (
    <input
      aria-label={ariaLabel}
      onChange={(event) => onChange(fieldValue(event.currentTarget))}
      onKeyDown={(event) => {
        if (event.key === "Enter") onEnter?.();
      }}
      placeholder={placeholder}
      style={css}
      type={type}
      value={value}
    />
  );
}

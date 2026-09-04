import React from "react";

import {
  formatInvoiceDateIsoLocal,
  parseInvoiceDateInput,
} from "../looks/format-invoice";
import type { LookStyleBox } from "../looks/style-ir";
import { cssFromLookBox, cssFromLookText } from "./css";

const FIELD_RESET: React.CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 2,
  boxSizing: "border-box",
  letterSpacing: "inherit",
  lineHeight: "inherit",
  margin: 0,
  minWidth: 0,
  MozAppearance: "textfield",
  overflow: "hidden",
  padding: 0,
  textAlign: "inherit",
  WebkitAppearance: "none",
  width: "100%",
};

const EDITABLE_TINT = "color-mix(in srgb, currentColor 7%, transparent)";

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
  multiline = false,
  onEnter,
  onBlur,
  onFocus,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange?: (value: string) => void;
  style: LookStyleBox;
  extra?: React.CSSProperties;
  ariaLabel: string;
  multiline?: boolean;
  onEnter?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const empty = Boolean(onChange) && value.length === 0;
  const css: React.CSSProperties = {
    ...cssFromLookText(style),
    ...FIELD_RESET,
    background: onChange ? EDITABLE_TINT : "transparent",
    display: multiline ? "block" : "inline-block",
    minHeight: "1.15em",
    paddingLeft: onChange ? 2 : 0,
    paddingRight: onChange ? 2 : 0,
    borderBottom: empty
      ? "1px dashed color-mix(in srgb, currentColor 45%, transparent)"
      : "1px solid transparent",
    ...extra,
  };
  if (!onChange) {
    return <span style={cssFromLookText(style, extra)}>{value}</span>;
  }
  if (multiline) {
    return (
      <textarea
        aria-label={ariaLabel}
        onBlur={onBlur}
        onChange={(event) => onChange(fieldValue(event.currentTarget))}
        onFocus={onFocus}
        placeholder={placeholder}
        rows={2}
        style={{ ...css, resize: "none" }}
        value={value}
      />
    );
  }
  return (
    <input
      aria-label={ariaLabel}
      inputMode={inputMode}
      onBlur={onBlur}
      onChange={(event) => onChange(fieldValue(event.currentTarget))}
      onFocus={onFocus}
      onKeyDown={(event) => {
        if (event.key === "Enter") onEnter?.();
      }}
      placeholder={placeholder}
      style={css}
      type="text"
      value={value}
    />
  );
}

/** Type a calendar day as on the PDF (04.09.2026). Commit ISO only when it parses. */
export function LookDateField({
  iso,
  locale,
  onChange,
  style,
  extra,
  ariaLabel,
  placeholder,
}: {
  iso: string;
  locale: string;
  onChange?: (iso: string) => void;
  style: LookStyleBox;
  extra?: React.CSSProperties;
  ariaLabel: string;
  placeholder?: string;
}) {
  const formatted = formatInvoiceDateIsoLocal(iso, locale);
  const [text, setText] = React.useState(formatted);
  const focused = React.useRef(false);

  React.useEffect(() => {
    if (!focused.current) setText(formatInvoiceDateIsoLocal(iso, locale));
  }, [iso, locale]);

  return (
    <LookField
      ariaLabel={ariaLabel}
      extra={extra}
      onBlur={() => {
        focused.current = false;
        setText(formatInvoiceDateIsoLocal(iso, locale));
      }}
      onChange={
        onChange
          ? (value) => {
              setText(value);
              const parsed = parseInvoiceDateInput(value);
              if (parsed) onChange(parsed);
            }
          : undefined
      }
      onFocus={() => {
        focused.current = true;
      }}
      placeholder={placeholder}
      style={style}
      value={onChange ? text : formatted}
    />
  );
}

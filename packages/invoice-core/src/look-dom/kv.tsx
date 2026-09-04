import React from "react";

import type { LookStyleIr } from "../looks/style-ir";
import { LookBox, LookField, LookText } from "./field";

export function DomKv({
  k,
  v,
  first,
  styles,
  onChange,
  ariaLabel,
  type = "text",
  placeholder,
}: {
  k: string;
  v: string;
  first?: boolean;
  styles: LookStyleIr;
  onChange?: (value: string) => void;
  ariaLabel?: string;
  type?: "text" | "date" | "number";
  placeholder?: string;
}) {
  const row =
    first === true ? { ...styles.kvRow, ...styles.kvRowFirst } : styles.kvRow;
  return (
    <LookBox style={row}>
      <LookBox style={styles.kvKeyCol}>
        <LookText style={styles.kvKey}>{k}</LookText>
      </LookBox>
      <LookBox style={styles.kvValCol}>
        <LookField
          ariaLabel={ariaLabel ?? k}
          extra={{ textAlign: "right", width: "100%" }}
          onChange={onChange}
          placeholder={placeholder}
          style={styles.kvVal}
          type={type}
          value={v}
        />
      </LookBox>
    </LookBox>
  );
}

export function DomPaymentKv({
  k,
  v,
  first,
  styles,
  onChange,
  ariaLabel,
  placeholder,
}: {
  k: string;
  v: string;
  first?: boolean;
  styles: LookStyleIr;
  onChange?: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const row =
    first === true ? { ...styles.kvRow, ...styles.kvRowFirst } : styles.kvRow;
  return (
    <LookBox style={row}>
      <LookBox style={styles.paymentKvKeyCol}>
        <LookText style={styles.kvKey}>{k}</LookText>
      </LookBox>
      <LookBox style={styles.paymentKvValCol}>
        <LookField
          ariaLabel={ariaLabel ?? k}
          extra={{ textAlign: "right", width: "100%" }}
          onChange={onChange}
          placeholder={placeholder}
          style={styles.kvVal}
          value={v}
        />
      </LookBox>
    </LookBox>
  );
}

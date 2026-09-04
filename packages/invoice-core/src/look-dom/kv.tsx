import React from "react";

import type { LookStyleIr } from "../looks/style-ir";
import { LookBox, LookDateField, LookField, LookText } from "./field";

export function DomKv({
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
          value={v}
        />
      </LookBox>
    </LookBox>
  );
}

export function DomDateKv({
  k,
  iso,
  locale,
  first,
  styles,
  onChange,
  ariaLabel,
}: {
  k: string;
  iso: string;
  locale: string;
  first?: boolean;
  styles: LookStyleIr;
  onChange?: (iso: string) => void;
  ariaLabel?: string;
}) {
  const row =
    first === true ? { ...styles.kvRow, ...styles.kvRowFirst } : styles.kvRow;
  return (
    <LookBox style={row}>
      <LookBox style={styles.kvKeyCol}>
        <LookText style={styles.kvKey}>{k}</LookText>
      </LookBox>
      <LookBox style={styles.kvValCol}>
        <LookDateField
          ariaLabel={ariaLabel ?? k}
          extra={{ textAlign: "right", width: "100%" }}
          iso={iso}
          locale={locale}
          onChange={onChange}
          style={styles.kvVal}
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

import { StyleSheet, type Styles } from "@react-pdf/renderer";

import type { LookTheme } from "../looks/schema";
import { createLookStyleIr } from "../looks/style-ir";

/**
 * PDF adapter over the shared look style IR (ADR 0049). Theme tokens are
 * computed once in `createLookStyleIr`; this only wraps them for react-pdf.
 */
export function createInvoicePdfStyles(theme: LookTheme) {
  /** SAFETY: IR is the previous StyleSheet.create argument; TS widens "column" to string. */
  return StyleSheet.create(createLookStyleIr(theme) as Styles);
}

export type InvoicePdfStyles = ReturnType<typeof createInvoicePdfStyles>;

export function rowColumnStyle(
  styles: InvoicePdfStyles,
  split: "1/1" | "1/2" | "2/1",
  side: "start" | "end",
) {
  if (split === "1/2") return side === "start" ? styles.col32 : styles.col64;
  if (split === "2/1") return side === "start" ? styles.col64 : styles.col32;
  return styles.col48;
}

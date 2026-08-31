import { StyleSheet } from "@react-pdf/renderer";

import type { LookTheme } from "../looks/schema";

const F_SANS = "Inter";

function scaleFactor(typeScale: LookTheme["typeScale"]): number {
  if (typeScale === "sm") return 0.88;
  if (typeScale === "lg") return 1.12;
  return 1;
}

function fs(n: number, factor: number): number {
  return Math.round(n * factor * 100) / 100;
}

export function createInvoicePdfStyles(theme: LookTheme) {
  const factor = scaleFactor(theme.typeScale);
  const compact = theme.density === "compact";
  const padY = compact ? 24 : 32;
  const padX = compact ? 32 : 42;
  const padBottom = compact ? 40 : 52;
  const ink = theme.ink;
  const muted = theme.muted;
  const line = theme.line;
  const accent = theme.accent;

  return StyleSheet.create({
    page: {
      flexDirection: "column",
      fontFamily: F_SANS,
      fontSize: fs(8.5, factor),
      paddingTop: padY,
      paddingHorizontal: padX,
      paddingBottom: padBottom,
      color: ink,
      backgroundColor: theme.paper,
    },
    mainColumn: {
      flexDirection: "column",
      flexGrow: 1,
      width: "100%",
    },
    bandStack: { width: "100%", marginTop: compact ? 6 : 10 },
    bandRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      marginTop: compact ? 6 : 10,
    },
    bandRowFirst: { marginTop: 0 },
    col48: { width: "48%" },
    col32: { width: "32%" },
    col64: { width: "64%" },
    colFull: { width: "100%" },
    logoImg: {
      maxHeight: theme.logoMaxHeightPt,
      width: 140,
      objectFit: "contain",
      objectPosition: "left top",
    },
    titleColRule: {
      width: "100%",
      borderBottomWidth: 1,
      borderBottomColor: accent,
      marginBottom: 8,
    },
    invoiceTitle: {
      fontFamily: F_SANS,
      fontSize: fs(15, factor),
      fontWeight: 700,
      color: ink,
      lineHeight: 1.08,
    },
    docKindMicro: {
      fontFamily: F_SANS,
      fontSize: fs(6.75, factor),
      fontWeight: 400,
      color: muted,
      marginTop: 4,
    },
    sectionHairShort: {
      width: 44,
      borderBottomWidth: 1,
      borderBottomColor: line,
      marginBottom: 6,
    },
    sectionCaps: {
      fontFamily: F_SANS,
      fontSize: fs(6.5, factor),
      fontWeight: 400,
      color: muted,
      marginBottom: 4,
    },
    partyName: {
      fontFamily: F_SANS,
      fontSize: fs(10, factor),
      fontWeight: 700,
      color: ink,
      marginBottom: 3,
    },
    partyAddr: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 400,
      color: muted,
      lineHeight: 1.3,
    },
    partyAddrTight: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 400,
      color: muted,
      lineHeight: 1.3,
      marginTop: 1,
    },
    kvRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: 3,
      width: "100%",
    },
    kvRowFirst: { marginTop: 0 },
    kvKeyCol: { width: "44%", paddingRight: 6 },
    kvKey: {
      fontFamily: F_SANS,
      fontSize: fs(7.5, factor),
      fontWeight: 400,
      color: muted,
    },
    kvValCol: { width: "56%" },
    paymentKvKeyCol: { width: "32%", paddingRight: 8 },
    paymentKvValCol: { width: "68%" },
    kvVal: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 400,
      color: ink,
      textAlign: "right",
    },
    kvBlock: { width: "100%", marginTop: 6 },
    kvBlockGap: { width: "100%", marginTop: 8 },
    partyMeta: { width: "100%" },
    registryNote: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 400,
      color: muted,
      lineHeight: 1.3,
      marginTop: 6,
    },
    paymentDetailKv: { marginTop: 0, width: "100%", alignSelf: "stretch" },
    tableWrap: { marginTop: 4 },
    tableHeadRow: {
      flexDirection: "row",
      borderBottomWidth: 0.5,
      borderBottomColor: line,
      paddingBottom: 4,
      paddingTop: 2,
    },
    th: {
      fontFamily: F_SANS,
      fontSize: fs(6.5, factor),
      fontWeight: 400,
      color: muted,
    },
    thDesc: { width: "46%" },
    thQty: { width: "8%", textAlign: "right", paddingRight: 4 },
    thUnit: { width: "7%" },
    thUnitPx: { width: "16%", textAlign: "right" },
    thVat: { width: "6%", textAlign: "right", paddingRight: 2 },
    thTot: { width: "17%", textAlign: "right" },
    lineRow: {
      flexDirection: "row",
      paddingVertical: compact ? 4 : 6,
      alignItems: "flex-start",
    },
    tableRowsRule: { borderBottomWidth: 0.5, borderBottomColor: line },
    descCol: { width: "46%", paddingRight: 8 },
    lineSub: {
      fontFamily: F_SANS,
      fontSize: fs(7.75, factor),
      fontWeight: 400,
      color: muted,
      marginTop: 1,
      lineHeight: 1.28,
    },
    cellFig: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 400,
      color: ink,
    },
    cellFigStrong: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 700,
      color: ink,
    },
    totalsBlock: { marginTop: 10, alignSelf: "flex-end", width: 260 },
    totalLine: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 3,
    },
    totalLbl: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 400,
      color: muted,
    },
    totalFig: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 400,
      color: ink,
      textAlign: "right",
    },
    totalGrand: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: 6,
      paddingTop: 5,
      borderTopWidth: 0.5,
      borderTopColor: line,
    },
    totalGrandNoVatIssuer: {
      borderTopWidth: 0,
      paddingTop: 0,
      marginTop: 8,
    },
    totalGrandLbl: {
      fontFamily: F_SANS,
      fontSize: fs(8.5, factor),
      fontWeight: 700,
      color: ink,
    },
    totalGrandFig: {
      fontFamily: F_SANS,
      fontSize: fs(15, factor),
      fontWeight: 700,
      color: ink,
      lineHeight: 1.05,
    },
    legalMini: {
      fontFamily: F_SANS,
      fontWeight: 400,
      marginTop: 6,
      fontSize: fs(7.75, factor),
      lineHeight: 1.33,
      color: muted,
    },
    asideTitle: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 700,
      color: ink,
    },
    paymentBlock: {
      width: "100%",
      marginTop: compact ? 8 : 14,
      paddingTop: 10,
      borderTopWidth: 0.5,
      borderTopColor: line,
    },
    paymentHint: {
      fontFamily: F_SANS,
      fontSize: fs(7.5, factor),
      fontWeight: 400,
      color: muted,
      marginTop: 8,
      lineHeight: 1.4,
    },
    paymentInstructions: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 400,
      color: ink,
      lineHeight: 1.4,
    },
    paymentInstructionsBefore: { marginTop: 14, marginBottom: 8 },
    paymentInstructionsAfter: { marginTop: 10 },
    paySectionHeading: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 700,
      color: ink,
      marginBottom: 6,
    },
    payMethodTxt: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 400,
      color: muted,
      marginTop: 2,
    },
    qr: { width: 96, height: 96, flexShrink: 0 },
    footerRow: {
      position: "absolute",
      bottom: 28,
      left: padX,
      right: padX,
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "flex-end",
      paddingTop: 7,
    },
    footerBrand: {
      fontFamily: F_SANS,
      fontSize: fs(7, factor),
      color: muted,
      textAlign: "right",
      textDecoration: "none",
    },
    footerBrandStrong: {
      fontWeight: 700,
      color: ink,
      textDecoration: "none",
    },
    stampWrapEnd: {
      width: "100%",
      alignItems: "flex-end",
    },
    stampSig: {
      width: theme.stampMaxHeightPt,
      height: theme.stampMaxHeightPt,
      objectFit: "contain",
      objectPosition: "bottom",
    },
    signatureImg: {
      width: 140,
      height: 52,
      objectFit: "contain",
      objectPosition: "bottom",
    },
    creditInline: {
      fontFamily: F_SANS,
      fontSize: fs(8, factor),
      fontWeight: 700,
      color: ink,
    },
  });
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

import {
  CLASSIC_LOOK_ID,
  CLASSIC_LOOK_VERSION,
  type LookDocument,
} from "./schema";

/** Today's invoice PDF encoded as a look document. */
export const CLASSIC_LOOK_1_0_0: LookDocument = {
  id: CLASSIC_LOOK_ID,
  version: CLASSIC_LOOK_VERSION,
  origin: "first_party",
  name: "Classic",
  layout: {
    bands: [
      {
        type: "row",
        split: "1/1",
        start: [{ block: "logo" }],
        end: [{ block: "title" }],
      },
      {
        type: "row",
        split: "1/1",
        start: [{ block: "issuer" }],
        end: [{ block: "client" }],
      },
      {
        type: "row",
        split: "1/1",
        start: [{ block: "payment", variant: "compact" }],
        end: [{ block: "dates" }],
      },
      {
        type: "stack",
        slots: [{ block: "lines" }, { block: "totals" }, { block: "tax" }],
      },
      {
        type: "row",
        split: "1/1",
        start: [{ block: "qr" }],
        end: [{ block: "payment", variant: "full" }],
      },
      { type: "stack", slots: [{ block: "notes" }] },
      {
        type: "row",
        split: "1/1",
        start: [{ block: "signature" }],
        end: [{ block: "stamp" }],
      },
      { type: "footer", slots: [{ block: "footer" }] },
    ],
  },
  theme: {
    paper: "#ffffff",
    ink: "#0a0a0a",
    muted: "#4b5563",
    line: "#e5e7eb",
    accent: "#0a0a0a",
    typeScale: "md",
    density: "comfortable",
    logoMaxHeightPt: 52,
    stampMaxHeightPt: 154,
    showStamp: true,
    showSignature: true,
    showQr: true,
    showNotes: true,
  },
};

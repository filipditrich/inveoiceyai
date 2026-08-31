import {
  MINIMAL_LOOK_ID,
  MINIMAL_LOOK_VERSION,
  type LookDocument,
} from "./schema";

/** Second first-party look — different bands, not a denser Classic. */
export const MINIMAL_LOOK_1_0_0: LookDocument = {
  id: MINIMAL_LOOK_ID,
  version: MINIMAL_LOOK_VERSION,
  origin: "first_party",
  name: "Minimal",
  layout: {
    bands: [
      { type: "stack", slots: [{ block: "title" }] },
      {
        type: "row",
        split: "1/1",
        start: [{ block: "logo" }, { block: "issuer" }],
        end: [{ block: "client" }],
      },
      {
        type: "stack",
        slots: [{ block: "lines" }, { block: "totals" }, { block: "tax" }],
      },
      {
        type: "row",
        split: "2/1",
        start: [{ block: "payment" }],
        end: [{ block: "qr" }],
      },
      { type: "stack", slots: [{ block: "notes" }] },
      {
        type: "row",
        split: "1/1",
        start: [{ block: "stamp" }],
        end: [{ block: "signature" }],
      },
      { type: "footer", slots: [{ block: "footer" }] },
    ],
  },
  theme: {
    paper: "#ffffff",
    ink: "#171717",
    muted: "#525252",
    line: "#e5e5e5",
    accent: "#2563eb",
    typeScale: "sm",
    density: "compact",
    logoMaxHeightPt: 40,
    showStamp: true,
    showSignature: true,
    showQr: true,
    showNotes: true,
  },
};

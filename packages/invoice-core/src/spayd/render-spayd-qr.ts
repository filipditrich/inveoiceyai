import QRCode from "qrcode";

import type { Invoice } from "../schema";
import { buildSpaydPayload } from "./build-spayd-payload";

const QR_PIXEL = 164;

/**
 * Shared across every SPAYD QR surface so a code scanned off a phone screen is
 * the same code that was printed on the PDF.
 *
 * The colours are fixed black-on-white even in dark mode: a payment QR has to
 * survive a camera pointed at a screen, and the light background is
 * load-bearing for that, not decoration.
 */
const SPAYD_QR_OPTIONS = {
  margin: 1,
  errorCorrectionLevel: "H",
  color: { dark: "#000000", light: "#ffffff" },
} as const satisfies Pick<
  QRCode.QRCodeToDataURLOptions,
  "margin" | "errorCorrectionLevel" | "color"
>;

/** PNG data URL for embedding in `@react-pdf/renderer` `<Image>` (or null when no QR). */
export async function renderSpaydQr(invoice: Invoice): Promise<string | null> {
  const payload = buildSpaydPayload(invoice);
  if (payload === null) {
    return null;
  }

  const buffer = await QRCode.toBuffer(payload, {
    type: "png",
    width: QR_PIXEL,
    ...SPAYD_QR_OPTIONS,
  });

  const base64 = Buffer.from(buffer).toString("base64");
  return `data:image/png;base64,${base64}`;
}

/**
 * Scalable SPAYD QR markup for a screen someone holds up to be scanned.
 *
 * Returns SVG rather than a sized raster because the waiting screen wants to be
 * as large as the viewport allows — a 164px PNG stretched to fill a phone is
 * exactly the blurry code a camera fails on. Intrinsic `width`/`height` are
 * stripped so CSS owns the size; the `viewBox` keeps it square.
 */
export async function renderSpaydQrSvg(payload: string): Promise<string> {
  const svg = await QRCode.toString(payload, {
    type: "svg",
    ...SPAYD_QR_OPTIONS,
  });
  return svg.replace(/\s(?:width|height)="[^"]*"/gu, "");
}

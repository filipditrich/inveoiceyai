import QRCode from "qrcode";

import type { Invoice } from "../schema";
import { buildSpaydPayload } from "../spayd/build-spayd-payload";

/** Browser-safe SPAYD QR data URL (PDF rendering still uses `toBuffer`). */
export async function renderSpaydQrDataUrl(
  invoice: Invoice,
): Promise<string | null> {
  const payload = buildSpaydPayload(invoice);
  if (payload === null) return null;
  return QRCode.toDataURL(payload, {
    width: 164,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
}

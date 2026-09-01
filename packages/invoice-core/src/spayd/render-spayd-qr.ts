import QRCode from "qrcode";

import type { Invoice } from "../schema";
import { buildSpaydPayload } from "./build-spayd-payload";

const QR_PIXEL = 164;
const QR_ECC_HIGH: QRCode.QRCodeErrorCorrectionLevel = "H";

/** PNG data URL for embedding in `@react-pdf/renderer` `<Image>` (or null when no QR). */
export async function renderSpaydQr(invoice: Invoice): Promise<string | null> {
  const payload = buildSpaydPayload(invoice);
  if (payload === null) {
    return null;
  }

  const buffer = await QRCode.toBuffer(payload, {
    type: "png",
    width: QR_PIXEL,
    margin: 1,
    errorCorrectionLevel: QR_ECC_HIGH,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  const base64 = Buffer.from(buffer).toString("base64");
  return `data:image/png;base64,${base64}`;
}

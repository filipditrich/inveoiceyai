import { Font } from "@react-pdf/renderer";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { resolveInvoiceCoreAsset } from "./resolve-invoice-core-asset";

/**
 * Vendored under `packages/invoice-core/assets/fonts/`:
 * Inter 4.x (SIL OFL) — all UI sans (body, labels, numbers, totals).
 * See LICENSE-inter.txt in that folder.
 *
 * Static `new URL(..., import.meta.url)` so Eve/nitro/rolldown can emit the
 * TTFs next to the bundle; falls back to path probing for Next NFT traces.
 */
const VENDORED_FONT_URLS = {
  "Inter-Regular.ttf": new URL(
    "../../assets/fonts/Inter-Regular.ttf",
    import.meta.url,
  ),
  "Inter-Bold.ttf": new URL(
    "../../assets/fonts/Inter-Bold.ttf",
    import.meta.url,
  ),
  "Inter-Italic.ttf": new URL(
    "../../assets/fonts/Inter-Italic.ttf",
    import.meta.url,
  ),
} as const;

function resolveVendoredFontFile(fontFileName: string): string {
  const url =
    VENDORED_FONT_URLS[fontFileName as keyof typeof VENDORED_FONT_URLS];
  if (url) {
    const fromUrl = fileURLToPath(url);
    if (existsSync(fromUrl)) {
      return fromUrl;
    }
  }
  return resolveInvoiceCoreAsset("fonts", fontFileName);
}

let registeredFonts = false;

/** Disable letter-splitting so `EUR` / `USD` / uppercase labels stay intact. */
export function keepPdfWord(word: string): string[] {
  return [word];
}

export function registerInvoiceFonts(): void {
  Font.registerHyphenationCallback(keepPdfWord);
  if (registeredFonts) {
    return;
  }
  const interR = resolveVendoredFontFile("Inter-Regular.ttf");
  const interB = resolveVendoredFontFile("Inter-Bold.ttf");
  const interI = resolveVendoredFontFile("Inter-Italic.ttf");

  Font.register({
    family: "Inter",
    fonts: [
      { src: interR, fontWeight: 400 },
      { src: interB, fontWeight: 700 },
      { src: interI, fontWeight: 400, fontStyle: "italic" },
    ],
  });
  registeredFonts = true;
}

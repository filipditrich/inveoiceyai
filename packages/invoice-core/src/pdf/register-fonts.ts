import { Font } from "@react-pdf/renderer";

import { resolveInvoiceCoreAsset } from "./resolve-invoice-core-asset";

/**
 * Vendored under `packages/invoice-core/assets/fonts/`:
 * Inter 4.x (SIL OFL) — all UI sans (body, labels, numbers, totals).
 * See LICENSE-inter.txt in that folder.
 */
function resolveVendoredFontFile(fontFileName: string): string {
	return resolveInvoiceCoreAsset("fonts", fontFileName);
}

let registeredFonts = false;

export function registerInvoiceFonts(): void {
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

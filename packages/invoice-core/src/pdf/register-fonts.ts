import { Font } from "@react-pdf/renderer";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

/** avoid `require.resolve('…/DejaVuSans.ttf')` — bundlers (e.g. Turbopack) trace `.ttf` as invalid JS */
function resolveDejaVuFontPaths(): { regular: string; bold: string } {
	const pkgDir = path.dirname(require.resolve("dejavu-fonts-ttf/package.json"));
	return {
		regular: path.join(pkgDir, "ttf/DejaVuSans.ttf"),
		bold: path.join(pkgDir, "ttf/DejaVuSans-Bold.ttf"),
	};
}

let registeredFonts = false;

/** Pin: `dejavu-fonts-ttf` npm version (TTF metrics for `@react-pdf/renderer` fontkit). */
export function registerInvoiceFonts(): void {
	if (registeredFonts) {
		return;
	}
	const { regular: DejaVuRegular, bold: DejaVuBold } = resolveDejaVuFontPaths();
	Font.register({
		family: "DejaVu Sans",
		fonts: [
			{ src: DejaVuRegular, fontWeight: 400 },
			{ src: DejaVuBold, fontWeight: 700 },
		],
	});
	registeredFonts = true;
}

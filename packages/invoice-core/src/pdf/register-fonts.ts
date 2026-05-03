import { Font } from "@react-pdf/renderer";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const DejaVuRegular = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const DejaVuBold = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");

let registeredFonts = false;

/** Pin: `dejavu-fonts-ttf` npm version (TTF metrics for `@react-pdf/renderer` fontkit). */
export function registerInvoiceFonts(): void {
	if (registeredFonts) {
		return;
	}
	Font.register({
		family: "DejaVu Sans",
		fonts: [
			{ src: DejaVuRegular, fontWeight: 400 },
			{ src: DejaVuBold, fontWeight: 700 },
		],
	});
	registeredFonts = true;
}

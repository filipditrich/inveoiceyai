import { Font } from "@react-pdf/renderer";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vendored under `packages/invoice-core/assets/fonts/`:
 * Inter 4.x (SIL OFL) — all UI sans (body, labels, numbers, totals).
 * See LICENSE-inter.txt in that folder.
 */
function resolveVendoredFontFile(fontFileName: string): string {
	const nextToModule = path.join(
		path.dirname(fileURLToPath(import.meta.url)),
		"../../assets/fonts",
		fontFileName,
	);
	if (existsSync(nextToModule)) {
		return nextToModule;
	}

	const repoPackageFonts = path.join(
		process.cwd(),
		"packages/invoice-core/assets/fonts",
		fontFileName,
	);
	if (existsSync(repoPackageFonts)) {
		return repoPackageFonts;
	}

	const fromAppsWebAncestor = path.join(
		process.cwd(),
		"../../packages/invoice-core/assets/fonts",
		fontFileName,
	);
	if (existsSync(fromAppsWebAncestor)) {
		return fromAppsWebAncestor;
	}

	throw new Error(
		`Missing vendored invoice font '${fontFileName}' — tried ${nextToModule}, ${repoPackageFonts}, ${fromAppsWebAncestor}`,
	);
}

let registeredFonts = false;

export function registerInvoiceFonts(): void {
	if (registeredFonts) {
		return;
	}
	const interR = resolveVendoredFontFile("Inter-Regular.ttf");
	const interB = resolveVendoredFontFile("Inter-Bold.ttf");

	Font.register({
		family: "Inter",
		fonts: [
			{ src: interR, fontWeight: 400 },
			{ src: interB, fontWeight: 700 },
		],
	});
	registeredFonts = true;
}

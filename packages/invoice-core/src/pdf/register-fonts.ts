import { Font } from "@react-pdf/renderer";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Fonts live under repo `packages/invoice-core/assets/fonts/` (vendored from
 * DejaVu Fonts 2.37, see LICENSE-dejavu). Do not use `require.resolve` into
 * `dejavu-fonts-ttf` — Bun `.bun` paths are not reliably openable from Next/pdfkit.
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

	/** cwd often `apps/web` when Next dev runs package script */
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
	const DejaVuRegular = resolveVendoredFontFile("DejaVuSans.ttf");
	const DejaVuBold = resolveVendoredFontFile("DejaVuSans-Bold.ttf");
	Font.register({
		family: "DejaVu Sans",
		fonts: [
			{ src: DejaVuRegular, fontWeight: 400 },
			{ src: DejaVuBold, fontWeight: 700 },
		],
	});
	registeredFonts = true;
}

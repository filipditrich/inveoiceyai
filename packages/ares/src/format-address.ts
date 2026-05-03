/** `sidlo.psc` is numeric; snapshot expects `981 06` style. */
export function formatCzPostcodeFromNumber(psc: number): string {
	const s = String(Math.max(0, Math.floor(psc))).padStart(5, "0");
	if (s.length > 5) {
		return `${s.slice(0, 3)} ${s.slice(-2)}`;
	}
	return `${s.slice(0, 3)} ${s.slice(3)}`;
}

export interface AresSidloLike {
	readonly kodStatu?: string;
	readonly nazevUlice?: string;
	readonly cisloDomovni?: number;
	readonly cisloOrientacni?: number | null;
	readonly cisloOrientacniPismeno?: string | null;
	readonly nazevObce?: string;
	readonly psc?: number;
	readonly textovaAdresa?: string;
}

function buildStreetLine(sidlo: AresSidloLike): string | undefined {
	const street = sidlo.nazevUlice?.trim();
	const no = sidlo.cisloDomovni;

	if (!street || no === undefined || Number.isNaN(no)) {
		return sidlo.textovaAdresa?.split(",")[0]?.trim();
	}

	const orient =
		sidlo.cisloOrientacni != null && sidlo.cisloOrientacni !== undefined
			? `/${sidlo.cisloOrientacni}${sidlo.cisloOrientacniPismeno ?? ""}`
			: "";
	return `${street} ${no}${orient}`.trim();
}
/** Map primary seat from ARES to `ClientAddressSchema`-compatible fields. */
export function mapSidloToClientAddressParts(
	sidlo: AresSidloLike,
): { street: string; city: string; zip: string; country: string } | null {
	const structuredStreet = buildStreetLine(sidlo);
	const postal =
		sidlo.psc !== undefined &&
		sidlo.psc !== null &&
		typeof sidlo.psc === "number" &&
		!Number.isNaN(sidlo.psc)
			? formatCzPostcodeFromNumber(sidlo.psc)
			: undefined;
	const obecTrim = sidlo.nazevObce?.trim();
	const structuredCityInitial =
		obecTrim !== undefined && obecTrim.length > 0 ? obecTrim : "";

	let street = structuredStreet ?? "";
	let city = structuredCityInitial;
	let zip = postal ?? "";

	if (!street || !city || !zip) {
		const tv = sidlo.textovaAdresa?.trim();
		if (tv) {
			const segments = tv.split(",").map((s) => s.trim()).filter(Boolean);
			street ||= segments[0] ?? "";
			/** Typical: "... , Michle , 14000 Praha 4" */
			const locality = segments.slice(1).join(", ");
			const zipGuess = locality.match(/\b(\d{3})\s?(\d{2})\b/);
			if (zipGuess) {
				zip ||= `${zipGuess[1]} ${zipGuess[2]}`;
			}
			if (structuredCityInitial === "") {
				const afterZip =
					locality.replace(/\s*\d{3}\s?\d{2}\s*/, "").trim() ||
					segments[segments.length - 1] ||
					"";
				city ||= afterZip;
			}
		}
	}

	const country =
		sidlo.kodStatu && /^[A-Z]{2}$/u.test(sidlo.kodStatu)
			? sidlo.kodStatu
			: "CZ";

	if (!street || !city || !zip || !country) {
		return null;
	}

	return { street, city, zip, country };
}

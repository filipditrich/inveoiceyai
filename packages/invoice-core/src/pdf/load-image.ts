/**
 * Loads image bytes suitable for `@react-pdf/renderer` `<Image>` from http(s)/file
 * URLs or base64-encoded PNG/JPEG `data:image/...`. Returns **`Buffer`** (not
 * `Uint8Array`): `@react-pdf/image` mishandles Uint8Arrays and treats them like URLs.
 */
export async function loadImageForPdf(
	source: string | undefined,
): Promise<Buffer | undefined> {
	if (!source) {
		return undefined;
	}

	if (
		source.startsWith("data:image/png;base64,")
		|| source.startsWith("data:image/jpeg;base64,")
		|| source.startsWith("data:image/jpg;base64,")
	) {
		const base64 = source.split(",", 2)[1] ?? "";
		return Buffer.from(base64, "base64");
	}

	if (!/^https?:\/\//iu.test(source) && !source.startsWith("file:")) {
		return undefined;
	}

	const res = await fetch(source);
	if (!res.ok) {
		throw new Error(`Failed to fetch image: ${source} (${res.status})`);
	}

	return Buffer.from(await res.arrayBuffer());
}

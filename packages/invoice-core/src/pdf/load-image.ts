const PNG_FILE_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function isPngBuffer(buf: Buffer): boolean {
	return buf.length >= 24 && buf.subarray(0, 8).equals(PNG_FILE_SIGNATURE);
}

/**
 * Few-pixel placeholders (fixture data URLs, tracking pixels) scale to the full
 * logo bounding box under react-pdf and read as useless dark slabs.
 */
function isDegenerateTinyPngForLogoSlot(buf: Buffer): boolean {
	if (!isPngBuffer(buf)) {
		return false;
	}
	if (buf.length < 29) {
		return true;
	}
	/** IHDR dimensions at offsets 16, 20 (PNG spec) */
	const width = buf.readUInt32BE(16);
	const height = buf.readUInt32BE(20);
	return width <= 4 && height <= 4;
}

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

	let buffer: Buffer;
	if (
		source.startsWith("data:image/png;base64,")
		|| source.startsWith("data:image/jpeg;base64,")
		|| source.startsWith("data:image/jpg;base64,")
	) {
		const base64 = source.split(",", 2)[1] ?? "";
		buffer = Buffer.from(base64, "base64");
	} else if (!/^https?:\/\//iu.test(source) && !source.startsWith("file:")) {
		return undefined;
	} else {
		const res = await fetch(source);
		if (!res.ok) {
			throw new Error(`Failed to fetch image: ${source} (${res.status})`);
		}
		buffer = Buffer.from(await res.arrayBuffer());
	}

	if (isDegenerateTinyPngForLogoSlot(buffer)) {
		return undefined;
	}
	return buffer;
}

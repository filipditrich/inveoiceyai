import { isInlineInvoiceImage, isTrustedInvoiceImageUrl } from "./asset-source";

const PNG_FILE_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 4_096;
const MAX_IMAGE_PIXELS = 16_000_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 5_000;

function isPngBuffer(buf: Buffer): boolean {
  return buf.length >= 24 && buf.subarray(0, 8).equals(PNG_FILE_SIGNATURE);
}

function isJpegBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  );
}

function isSupportedImageBuffer(buf: Buffer): boolean {
  return isPngBuffer(buf) || isJpegBuffer(buf);
}

function imageDimensions(
  buf: Buffer,
): { width: number; height: number } | null {
  if (isPngBuffer(buf)) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (!isJpegBuffer(buf)) return null;

  let offset = 2;
  while (offset + 8 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buf.length) break;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function assertSafeDimensions(buf: Buffer): void {
  const dimensions = imageDimensions(buf);
  if (
    dimensions &&
    (dimensions.width > MAX_IMAGE_DIMENSION ||
      dimensions.height > MAX_IMAGE_DIMENSION ||
      dimensions.width * dimensions.height > MAX_IMAGE_PIXELS)
  ) {
    throw new Error("Invoice image dimensions exceed the rendering limit");
  }
}

async function readBoundedBody(response: Response): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    throw new Error("Invoice image exceeds the 2 MB limit");
  }

  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      length += value.byteLength;
      if (length > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error("Invoice image exceeds the 2 MB limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, length);
}

async function fetchTrustedImage(source: string): Promise<Buffer> {
  let current = source;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    if (!isTrustedInvoiceImageUrl(current)) {
      throw new Error("Invoice image URL is not from a trusted asset host");
    }

    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) {
        throw new Error("Invoice image redirect could not be followed safely");
      }
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`Invoice image fetch failed (${response.status})`);
    }

    const contentType = response.headers.get("content-type")?.split(";", 1)[0];
    if (contentType !== "image/png" && contentType !== "image/jpeg") {
      throw new Error("Invoice image response has an unsupported content type");
    }
    return readBoundedBody(response);
  }

  throw new Error("Invoice image redirect limit exceeded");
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
 * Loads image bytes suitable for `@react-pdf/renderer` `<Image>` from trusted
 * UploadThing URLs or base64-encoded PNG/JPEG `data:image/...`. Returns **`Buffer`** (not
 * `Uint8Array`): `@react-pdf/image` mishandles Uint8Arrays and treats them like URLs.
 */
export async function loadImageForPdf(
  source: string | undefined,
): Promise<Buffer | undefined> {
  if (!source) {
    return undefined;
  }

  let buffer: Buffer;
  if (isInlineInvoiceImage(source)) {
    const base64 = source.split(",", 2)[1] ?? "";
    if (base64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4) {
      throw new Error("Invoice image exceeds the 2 MB limit");
    }
    buffer = Buffer.from(base64, "base64");
  } else {
    buffer = await fetchTrustedImage(source);
  }

  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Invoice image exceeds the 2 MB limit");
  }
  if (!isSupportedImageBuffer(buffer)) {
    throw new Error("Invoice image bytes are not a supported PNG or JPEG");
  }
  assertSafeDimensions(buffer);

  if (isDegenerateTinyPngForLogoSlot(buffer)) {
    return undefined;
  }
  return buffer;
}

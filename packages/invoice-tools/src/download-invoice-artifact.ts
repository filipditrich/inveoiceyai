import { createHash } from "node:crypto";

const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;
const ARTIFACT_FETCH_TIMEOUT_MS = 20_000;

export async function downloadInvoiceArtifact(
  url: string,
  expectedSha256?: string | null,
): Promise<Buffer<ArrayBuffer>> {
  const controller = new AbortController();
  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(ARTIFACT_FETCH_TIMEOUT_MS),
      ]),
    });
    if (!upstream.ok || !upstream.body) {
      throw new Error(`artifact fetch failed: ${upstream.status}`);
    }
    const declaredLength = Number(upstream.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_ARTIFACT_BYTES
    ) {
      throw new Error("artifact exceeds size limit");
    }

    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_ARTIFACT_BYTES) {
          throw new Error("artifact exceeds size limit");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks, length);
    if (expectedSha256) {
      const actualSha256 = createHash("sha256").update(bytes).digest("hex");
      if (actualSha256 !== expectedSha256) {
        throw new Error("artifact integrity check failed");
      }
    }
    return bytes;
  } finally {
    // Abort also disposes of unread bodies rejected by status or declared size.
    controller.abort();
  }
}

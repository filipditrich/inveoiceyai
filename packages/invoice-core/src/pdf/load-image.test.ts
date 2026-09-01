import { afterEach, describe, expect, it, vi } from "vitest";

import { loadImageForPdf } from "./load-image";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x48, 0x44,
  0x52, 0, 0, 0, 8, 0, 0, 0, 8, 8, 6, 0, 0, 0,
]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadImageForPdf", () => {
  it("accepts supported inline images without network access", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadImageForPdf(`data:image/png;base64,${PNG.toString("base64")}`),
    ).resolves.toEqual(PNG);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "file:///etc/passwd",
    "http://127.0.0.1:3000/private",
    "https://example.com/logo.png",
    "https://ufs.sh.example.com/logo.png",
  ])("rejects untrusted image source %s", async (source) => {
    await expect(loadImageForPdf(source)).rejects.toThrow("trusted asset host");
  });

  it("rejects redirects away from trusted hosts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data" },
        }),
      ),
    );

    await expect(loadImageForPdf("https://ufs.sh/f/logo.png")).rejects.toThrow(
      "trusted asset host",
    );
  });

  it("enforces the response size before buffering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(PNG, {
          headers: {
            "content-length": String(2 * 1024 * 1024 + 1),
            "content-type": "image/png",
          },
        }),
      ),
    );

    await expect(loadImageForPdf("https://ufs.sh/f/logo.png")).rejects.toThrow(
      "2 MB",
    );
  });

  it("rejects images with excessive decoded dimensions", async () => {
    const oversized = Buffer.from(PNG);
    oversized.writeUInt32BE(5_000, 16);

    await expect(
      loadImageForPdf(`data:image/png;base64,${oversized.toString("base64")}`),
    ).rejects.toThrow("dimensions");
  });
});

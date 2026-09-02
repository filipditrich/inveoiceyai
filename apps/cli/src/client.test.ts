import { describe, expect, it } from "vitest";

import { filenameFromDisposition } from "./client";

describe("filenameFromDisposition", () => {
  it("prefers rfc5987", () => {
    expect(
      filenameFromDisposition(
        "attachment; filename=plain.pdf; filename*=UTF-8''faktura_2026001.pdf",
      ),
    ).toBe("faktura_2026001.pdf");
  });
});

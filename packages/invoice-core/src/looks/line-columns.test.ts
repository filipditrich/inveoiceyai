import { describe, expect, it } from "vitest";

import {
  LINE_COLS_NO_VAT,
  LINE_COLS_WITH_VAT,
  lineGridTemplate,
} from "./line-columns";

describe("lineGridTemplate", () => {
  it("uses the same VAT tracks as the PDF column percents", () => {
    expect(lineGridTemplate(LINE_COLS_WITH_VAT)).toBe(
      "minmax(0, 42%) minmax(0, 15%) minmax(0, 18%) minmax(0, 6%) minmax(0, 19%)",
    );
  });

  it("drops the VAT track when the invoice hides that column", () => {
    expect(lineGridTemplate(LINE_COLS_NO_VAT)).toBe(
      "minmax(0, 46%) minmax(0, 17%) minmax(0, 18%) minmax(0, 19%)",
    );
  });
});

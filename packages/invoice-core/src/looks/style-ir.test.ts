import { describe, expect, it } from "vitest";

import { CLASSIC_LOOK_1_0_0 } from "./classic";
import { MINIMAL_LOOK_1_0_0 } from "./minimal";
import { createLookStyleIr } from "./style-ir";

describe("createLookStyleIr", () => {
  it("derives Classic comfortable/md spacing and title size once for both interpreters", () => {
    const ir = createLookStyleIr(CLASSIC_LOOK_1_0_0.theme);
    expect(ir.page.paddingTop).toBe(32);
    expect(ir.page.paddingHorizontal).toBe(42);
    expect(ir.page.paddingBottom).toBe(52);
    expect(ir.page.backgroundColor).toBe("#ffffff");
    expect(ir.page.color).toBe("#0a0a0a");
    expect(ir.invoiceTitle.fontSize).toBe(15);
    expect(ir.titleColRule.borderBottomColor).toBe("#0a0a0a");
    expect(ir.logoImg.maxHeight).toBe(52);
    expect(ir.stampSig.height).toBe(154);
  });

  it("scales type and density from theme tokens, not interpreter-private constants", () => {
    const compact = createLookStyleIr(MINIMAL_LOOK_1_0_0.theme);
    expect(compact.page.paddingTop).toBe(24);
    expect(compact.page.paddingHorizontal).toBe(32);
    expect(compact.invoiceTitle.fontSize).toBe(13.2);
    expect(compact.titleColRule.borderBottomColor).toBe("#2563eb");
    expect(compact.bandStack.marginTop).toBe(6);
  });
});

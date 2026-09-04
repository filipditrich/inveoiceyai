import { describe, expect, it } from "vitest";

import { DOM_LOOK_BLOCK_HANDLERS } from "../look-dom";
import { lookBlockHandlerIds } from "../looks/block-coverage";
import { LOOK_BLOCKS } from "../looks/schema";
import { PDF_LOOK_BLOCK_HANDLERS } from "../pdf/InvoicePdfDocument";

describe("look block coverage", () => {
  it("implements every closed block in both interpreters", () => {
    expect(lookBlockHandlerIds(PDF_LOOK_BLOCK_HANDLERS)).toEqual([
      ...LOOK_BLOCKS,
    ]);
    expect(lookBlockHandlerIds(DOM_LOOK_BLOCK_HANDLERS)).toEqual([
      ...LOOK_BLOCKS,
    ]);
  });
});

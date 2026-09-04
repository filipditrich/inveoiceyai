import { describe, expect, it } from "vitest";

import { generatorIssueKeys } from "./issue-hints";

describe("generatorIssueKeys", () => {
  it("maps reverse-charge client DIČ to a single friendly key", () => {
    expect(
      generatorIssueKeys(
        "client.dic: reverse_charge requires client DIČ / VAT ID",
      ),
    ).toEqual(["issueClientDic"]);
  });

  it("maps a missing line description", () => {
    expect(generatorIssueKeys("line description required")).toEqual([
      "issueLine",
    ]);
  });

  it("falls back when the path is unknown", () => {
    expect(generatorIssueKeys("invoice build failed")).toEqual([
      "issueGeneric",
    ]);
  });
});

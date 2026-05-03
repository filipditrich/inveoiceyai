import { describe, expect, it } from "vitest";

import { stripLeadingSlackMentions } from "@/lib/slack/strip-leading-slack-mentions";

describe("stripLeadingSlackMentions", () => {
  it("removes a single leading mention", () => {
    expect(
      stripLeadingSlackMentions("<@UABC123> issue to nfctron 1500 Kč"),
    ).toBe("issue to nfctron 1500 Kč");
  });

  it("removes multiple leading mentions", () => {
    expect(
      stripLeadingSlackMentions(
        "<@UA> <@UB>   nfctron 1500 Kč for Management",
      ),
    ).toBe("nfctron 1500 Kč for Management");
  });

  it("does not strip mentions after text starts", () => {
    expect(stripLeadingSlackMentions("payment <@UB> note")).toBe(
      "payment <@UB> note",
    );
  });

  it("trims whitespace after stripping", () => {
    expect(stripLeadingSlackMentions("  <@UX>  hello  ")).toBe("hello");
  });

  it("returns empty when only mentions", () => {
    expect(stripLeadingSlackMentions("<@UX>")).toBe("");
  });
});

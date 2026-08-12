import { describe, expect, it, vi } from "vitest";

import { handleSlackInbound } from "./slack-inbound";

describe("handleSlackInbound", () => {
  it("drops bot authors without starting a turn", async () => {
    const ctx = {
      cancel: vi.fn(),
      isBotMentioned: () => true,
      isSubscribed: async () => true,
      thread: {
        post: vi.fn(),
        postDirectMessage: vi.fn(),
        postEphemeral: vi.fn(),
      },
    };
    const result = await handleSlackInbound(
      ctx as never,
      { author: { isBot: true }, raw: { channel_type: "channel" } } as never,
      { alwaysHandle: true },
    );
    expect(result).toBeNull();
    expect(ctx.cancel).not.toHaveBeenCalled();
  });

  it("ignores ambient channel messages unless alwaysHandle", async () => {
    const ctx = {
      cancel: vi.fn(),
      isBotMentioned: () => false,
      isSubscribed: async () => false,
      thread: {
        post: vi.fn(),
        postDirectMessage: vi.fn(),
        postEphemeral: vi.fn(),
      },
    };
    const result = await handleSlackInbound(
      ctx as never,
      { author: { isBot: false }, raw: { channel_type: "channel" } } as never,
      { alwaysHandle: false },
    );
    expect(result).toBeNull();
    expect(ctx.cancel).not.toHaveBeenCalled();
  });
});

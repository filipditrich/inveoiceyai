import { createHmac, timingSafeEqual } from "node:crypto";

const SLACK_MAX_AGE_SEC = 60 * 5;

export interface VerifySlackRequestOptions {
  signingSecret: string;
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  nowSec?: number;
}

/**
 * Verifies `X-Slack-Signature` for slash commands / events.
 * Rejects payloads older than 5 minutes (Slack recommendation).
 */
export function verifySlackRequest(
  options: VerifySlackRequestOptions,
): boolean {
  const {
    signingSecret,
    rawBody,
    timestamp: tsHeader,
    signature: sigHeader,
    nowSec = Math.floor(Date.now() / 1000),
  } = options;

  if (
    tsHeader == null ||
    tsHeader === "" ||
    sigHeader == null ||
    sigHeader === ""
  ) {
    return false;
  }

  const ts = Number(tsHeader);
  if (!Number.isFinite(ts)) {
    return false;
  }

  if (Math.abs(nowSec - ts) > SLACK_MAX_AGE_SEC) {
    return false;
  }

  const base = `v0:${tsHeader}:${rawBody}`;
  const hmac = createHmac("sha256", signingSecret)
    .update(base, "utf8")
    .digest("hex");
  const expected = `v0=${hmac}`;

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader));
  } catch {
    return false;
  }
}

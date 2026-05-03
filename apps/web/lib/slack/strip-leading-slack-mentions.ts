const LEADING_MENTIONS_RE = /^(\s*<@[^>]+>\s*)+/u;

/**
 * Removes one or more Slack user/group mention tokens at the start of the
 * message (e.g. `<@U123>`) so the remainder can be passed to the invoice AI.
 */
export function stripLeadingSlackMentions(text: string): string {
  return text.replace(LEADING_MENTIONS_RE, "").trim();
}

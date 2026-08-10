import type { ToolContext } from "eve/tools";

export interface SlackThreadTarget {
  channelId: string;
  threadTs: string;
}

export function slackThreadFromCtx(ctx: ToolContext): SlackThreadTarget | null {
  const attrs =
    ctx.session.auth.current?.attributes ??
    ctx.session.auth.initiator?.attributes;
  if (!attrs) return null;
  const channelId = attrs.channel_id;
  const threadTs = attrs.thread_ts;
  if (typeof channelId !== "string" || channelId.length === 0) return null;
  if (typeof threadTs !== "string" || threadTs.length === 0) return null;
  return { channelId, threadTs };
}

export function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

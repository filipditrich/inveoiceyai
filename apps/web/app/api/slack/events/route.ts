import type { NextRequest } from "next/server";
import { after, NextResponse } from "next/server";

import {
  runSlackInvoiceJobFromAppMention,
} from "@/lib/slack/run-slack-invoice-job";
import { stripLeadingSlackMentions } from "@/lib/slack/strip-leading-slack-mentions";
import { verifySlackRequest } from "@/lib/slack/verify-slack-request";

export const runtime = "nodejs";

export const maxDuration = 120;

function readStringProp(
  value: unknown,
): value is string {
  return typeof value === "string" && value !== "";
}

/**
 * Slack Events API: URL verification + `app_mention` → same AI invoice pipeline as `/invoice`.
 */
export async function POST(request: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const botToken = process.env.SLACK_BOT_TOKEN;

  if (
    signingSecret == null ||
    signingSecret.trim() === "" ||
    botToken == null ||
    botToken.trim() === ""
  ) {
    return NextResponse.json(
      { error: "Slack env not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");

  const okSig = verifySlackRequest({
    signingSecret,
    rawBody,
    timestamp,
    signature,
  });

  if (!okSig) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload === null || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;

  if (body.type === "url_verification" && readStringProp(body.challenge)) {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (body.type !== "event_callback") {
    return new NextResponse(null, { status: 200 });
  }

  const event = body.event;
  if (event === null || typeof event !== "object") {
    return new NextResponse(null, { status: 200 });
  }

  const ev = event as Record<string, unknown>;

  if (ev.bot_id != null) {
    return new NextResponse(null, { status: 200 });
  }

  if (ev.type !== "app_mention") {
    return new NextResponse(null, { status: 200 });
  }

  const user = ev.user;
  const channel = ev.channel;
  const text = typeof ev.text === "string" ? ev.text : "";
  const ts = ev.ts;

  if (!readStringProp(user) || !readStringProp(channel) || !readStringProp(ts)) {
    return new NextResponse(null, { status: 200 });
  }

  const threadParent =
    readStringProp(ev.thread_ts) ? ev.thread_ts : ts;
  const commandText = stripLeadingSlackMentions(text);

  after(async () => {
    try {
      await runSlackInvoiceJobFromAppMention({
        commandText,
        channelId: channel,
        userId: user,
        threadTs: threadParent,
        botToken,
      });
    } catch (cause) {
      console.error("[slack] runSlackInvoiceJobFromAppMention", cause);
    }
  });

  return new NextResponse(null, { status: 200 });
}

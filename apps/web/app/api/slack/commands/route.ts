import type { NextRequest } from "next/server";
import { after, NextResponse } from "next/server";

import { runSlackInvoiceJob } from "@/lib/slack/run-slack-invoice-job";
import { verifySlackRequest } from "@/lib/slack/verify-slack-request";

export const runtime = "nodejs";

/** AI + PDF render can exceed default Vercel hobby limits; adjust per plan. */
export const maxDuration = 120;

/**
 * Slack slash command `/invoice`. Expects `application/x-www-form-urlencoded` body.
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

  const params = new URLSearchParams(rawBody);
  const command = params.get("command");
  if (command !== "/invoice") {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Neznámý příkaz.",
    });
  }

  const text = params.get("text") ?? "";
  const responseUrl = params.get("response_url");
  const channelId = params.get("channel_id");

  if (responseUrl == null || responseUrl === "") {
    return NextResponse.json(
      { error: "missing response_url" },
      { status: 400 },
    );
  }

  if (channelId == null || channelId === "") {
    return NextResponse.json({ error: "missing channel_id" }, { status: 400 });
  }

  after(async () => {
    try {
      await runSlackInvoiceJob({
        commandText: text,
        responseUrl,
        channelId,
        botToken,
      });
    } catch (cause) {
      console.error("[slack] runSlackInvoiceJob", cause);
      try {
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response_type: "ephemeral",
            text: "Interní chyba při generování faktury.",
          }),
        });
      } catch (inner) {
        console.error("[slack] response_url notify failed", inner);
      }
    }
  });

  return NextResponse.json({
    response_type: "ephemeral",
    text: "Generuji fakturu…",
  });
}

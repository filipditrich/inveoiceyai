import { WebClient } from "@slack/web-api";

import { getDemoIssuer } from "@/lib/demo-issuer";
import {
  runAiInvoiceGeneration,
  type NormalizedIssue,
} from "@/lib/slack/run-ai-invoice";
import type { Invoice } from "@invoicey/invoice-core/schema";

export async function postSlackResponseUrl(
  responseUrl: string,
  body: Record<string, unknown>,
): Promise<void> {
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type AiPipelineResult =
  | { kind: "missing_gateway" }
  | { kind: "empty_text" }
  | {
      kind: "gen_failed";
      message: string;
      issues?: NormalizedIssue[];
    }
  | { kind: "ok"; invoice: Invoice; pdfBytes: Uint8Array; isdocXml: string };

async function runSlackInvoiceAiPipeline(
  commandText: string,
): Promise<AiPipelineResult> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (apiKey == null || apiKey.trim() === "") {
    return { kind: "missing_gateway" };
  }

  const text = commandText.trim();
  if (text === "") {
    return { kind: "empty_text" };
  }

  const issuer = getDemoIssuer();
  const primaryModel = process.env.INVOICEY_AI_MODEL ?? "openai/gpt-4o-mini";
  const fallbackModel =
    process.env.INVOICEY_AI_FALLBACK_MODEL ?? "anthropic/claude-3.5-haiku";

  const gen = await runAiInvoiceGeneration({
    userText: text,
    issuer,
    apiKey,
    primaryModel,
    fallbackModel: fallbackModel === primaryModel ? undefined : fallbackModel,
  });

  if (!gen.ok) {
    return {
      kind: "gen_failed",
      message: gen.message,
      issues: gen.issues,
    };
  }

  return {
    kind: "ok",
    invoice: gen.invoice,
    pdfBytes: gen.pdfBytes,
    isdocXml: gen.isdocXml,
  };
}

async function postSummaryAndUploadFiles(options: {
  client: WebClient;
  channelId: string;
  /** when set, reply in this thread (app_mention); omit for top-level (slash) */
  threadTs?: string;
  invoice: Invoice;
  pdfBytes: Uint8Array;
  isdocXml: string;
}): Promise<{ ok: true } | { ok: false; ephemeralText: string }> {
  const { client, channelId, threadTs, invoice, pdfBytes, isdocXml } = options;

  let posted;
  try {
    posted = await client.chat.postMessage({
      channel: channelId,
      ...(threadTs != null ? { thread_ts: threadTs } : {}),
      text: `Faktura \`${invoice.meta.number}\` — *${invoice.totals.total.toFixed(2)} Kč* (demo, bez uložení do DB)`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[slack] chat.postMessage failed", { msg, channelId });
    return {
      ok: false,
      ephemeralText: `Slack chyba při odeslání zprávy: ${msg}`,
    };
  }

  const summaryTs = posted.ts;
  if (summaryTs == null) {
    return {
      ok: false,
      ephemeralText: "Slack nevrátil `ts` zprávy; přílohy nelze navázat.",
    };
  }

  const safeName = invoice.meta.number.replace(/[^\w.-]+/g, "_");
  const pdfBuf = Buffer.from(pdfBytes);
  const xmlBuf = Buffer.from(isdocXml, "utf8");

  try {
    await client.filesUploadV2({
      channel_id: channelId,
      thread_ts: summaryTs,
      file: pdfBuf,
      filename: `faktura-${safeName}-isdoc.pdf`,
      title: "PDF (ISDOC)",
      initial_comment: "PDF faktura s vloženým ISDOC",
    });
    await client.filesUploadV2({
      channel_id: channelId,
      thread_ts: summaryTs,
      file: xmlBuf,
      filename: `faktura-${safeName}.isdoc`,
      title: "ISDOC",
      initial_comment: "ISDOC 6.0.2 XML",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[slack] filesUploadV2 failed", { msg, channelId });
    return {
      ok: false,
      ephemeralText: `Faktura vygenerovaná, ale nahrání souborů selhalo: ${msg}`,
    };
  }

  return { ok: true };
}

export async function runSlackInvoiceJob(params: {
  commandText: string;
  responseUrl: string;
  channelId: string;
  botToken: string;
}): Promise<void> {
  const { commandText, responseUrl, channelId, botToken } = params;

  const ai = await runSlackInvoiceAiPipeline(commandText);

  if (ai.kind === "missing_gateway") {
    await postSlackResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: "Chybí `AI_GATEWAY_API_KEY` na serveru.",
    });
    return;
  }

  if (ai.kind === "empty_text") {
    await postSlackResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: "Zadej popis faktury, např. `28288390 konzultace 10 000 Kč splatnost 14 dní`.",
    });
    return;
  }

  if (ai.kind === "gen_failed") {
    const detail = ai.issues?.length
      ? ai.issues.map((i) => `• ${i.path}: ${i.message}`).join("\n")
      : ai.message;
    await postSlackResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: `Faktura se nepodařila.\n${detail}`,
    });
    return;
  }

  const { invoice, pdfBytes, isdocXml } = ai;
  const client = new WebClient(botToken);

  const uploaded = await postSummaryAndUploadFiles({
    client,
    channelId,
    invoice,
    pdfBytes,
    isdocXml,
  });

  if (!uploaded.ok) {
    await postSlackResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: uploaded.ephemeralText,
    });
    return;
  }

  await postSlackResponseUrl(responseUrl, {
    response_type: "ephemeral",
    text: "Hotovo — PDF a ISDOC jsou v navázaném vlákně.",
  });
}

export async function runSlackInvoiceJobFromAppMention(params: {
  commandText: string;
  channelId: string;
  userId: string;
  /** parent thread for replies: `thread_ts ?? ts` from Slack */
  threadTs: string;
  botToken: string;
}): Promise<void> {
  const { commandText, channelId, userId, threadTs, botToken } = params;
  const client = new WebClient(botToken);

  const postEphemeral = async (text: string): Promise<void> => {
    try {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[slack] chat.postEphemeral failed", { msg, channelId, userId });
    }
  };

  await postEphemeral("Generuji fakturu…");

  const ai = await runSlackInvoiceAiPipeline(commandText);

  if (ai.kind === "missing_gateway") {
    await postEphemeral("Chybí `AI_GATEWAY_API_KEY` na serveru.");
    return;
  }

  if (ai.kind === "empty_text") {
    await postEphemeral(
      "Zadej popis faktury za zmínku, např. `@Invoicey 28288390 konzultace 10 000 Kč splatnost 14 dní`.",
    );
    return;
  }

  if (ai.kind === "gen_failed") {
    const detail = ai.issues?.length
      ? ai.issues.map((i) => `• ${i.path}: ${i.message}`).join("\n")
      : ai.message;
    await postEphemeral(`Faktura se nepodařila.\n${detail}`);
    return;
  }

  const { invoice, pdfBytes, isdocXml } = ai;
  const uploaded = await postSummaryAndUploadFiles({
    client,
    channelId,
    threadTs,
    invoice,
    pdfBytes,
    isdocXml,
  });

  if (!uploaded.ok) {
    await postEphemeral(uploaded.ephemeralText);
    return;
  }

  await postEphemeral("Hotovo — PDF a ISDOC jsou v navázaném vlákně.");
}

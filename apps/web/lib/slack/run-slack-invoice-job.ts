import { WebClient } from "@slack/web-api";

import { getDemoIssuer } from "@/lib/demo-issuer";
import { runAiInvoiceGeneration } from "@/lib/slack/run-ai-invoice";

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

export async function runSlackInvoiceJob(params: {
  commandText: string;
  responseUrl: string;
  channelId: string;
  botToken: string;
}): Promise<void> {
  const { commandText, responseUrl, channelId, botToken } = params;

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (apiKey == null || apiKey.trim() === "") {
    await postSlackResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: "Chybí `AI_GATEWAY_API_KEY` na serveru.",
    });
    return;
  }

  const text = commandText.trim();
  if (text === "") {
    await postSlackResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: "Zadej popis faktury, např. `28288390 konzultace 10 000 Kč splatnost 14 dní`.",
    });
    return;
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
    const detail = gen.issues?.length
      ? gen.issues.map((i) => `• ${i.path}: ${i.message}`).join("\n")
      : gen.message;
    await postSlackResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: `Faktura se nepodařila.\n${detail}`,
    });
    return;
  }

  const { invoice, pdfBytes, isdocXml } = gen;
  const client = new WebClient(botToken);

  let posted;
  try {
    posted = await client.chat.postMessage({
      channel: channelId,
      text: `Faktura \`${invoice.meta.number}\` — *${invoice.totals.total.toFixed(2)} Kč* (demo, bez uložení do DB)`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[slack] chat.postMessage failed", { msg, channelId });
    await postSlackResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: `Slack chyba při odeslání zprávy: ${msg}`,
    });
    return;
  }

  const threadTs = posted.ts;
  if (threadTs == null) {
    await postSlackResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: "Slack nevrátil `ts` zprávy; přílohy nelze navázat.",
    });
    return;
  }

  const safeName = invoice.meta.number.replace(/[^\w.-]+/g, "_");
  const pdfBuf = Buffer.from(pdfBytes);
  const xmlBuf = Buffer.from(isdocXml, "utf8");

  try {
    await client.filesUploadV2({
      channel_id: channelId,
      thread_ts: threadTs,
      file: pdfBuf,
      filename: `faktura-${safeName}.pdf`,
      title: "PDF",
      initial_comment: "PDF faktura",
    });
    await client.filesUploadV2({
      channel_id: channelId,
      thread_ts: threadTs,
      file: xmlBuf,
      filename: `faktura-${safeName}.isdoc.xml`,
      title: "ISDOC",
      initial_comment: "ISDOC 6.0.2 XML",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[slack] filesUploadV2 failed", { msg, channelId });
    await postSlackResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: `Faktura vygenerovaná, ale nahrání souborů selhalo: ${msg}`,
    });
    return;
  }

  await postSlackResponseUrl(responseUrl, {
    response_type: "ephemeral",
    text: "Hotovo — PDF a ISDOC jsou v navázaném vlákně.",
  });
}

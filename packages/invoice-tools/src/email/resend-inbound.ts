import type {
  InboundCaptureAdapter,
  InboundReceivedEmail,
  NormalizedInboundNotification,
} from "./types";

type ResendReceivedEmailJson = {
  html?: string | null;
  text?: string | null;
  headers?: Record<string, string>;
  attachments?: Array<{
    id?: string;
    filename?: string;
    content_type?: string;
    download_url?: string;
    size?: number;
  }>;
};

function firstRecipient(data: Record<string, unknown>): string | null {
  const receivedFor = data.received_for ?? data.to;
  if (typeof receivedFor === "string") return receivedFor;
  if (Array.isArray(receivedFor) && typeof receivedFor[0] === "string") {
    return receivedFor[0];
  }
  return null;
}

/**
 * Map a verified Resend `email.received` payload to the inbound notification
 * contract. Signature checks stay in the webhook route (Svix).
 */
export function parseResendInboundEvent(input: {
  type?: string;
  data?: Record<string, unknown>;
  emailIdFallback?: string;
}):
  | { ok: true; notification: NormalizedInboundNotification }
  | { ok: true; ignored: string } {
  if (input.type !== "email.received") {
    return { ok: true, ignored: "unhandled_type" };
  }

  const data = input.data ?? {};
  const recipient = firstRecipient(data);
  const emailId =
    typeof data.email_id === "string"
      ? data.email_id
      : (input.emailIdFallback ?? null);
  if (!emailId) {
    return { ok: true, ignored: "missing_email_id" };
  }

  return {
    ok: true,
    notification: {
      providerMessageId: emailId,
      recipient,
      fromAddress: typeof data.from === "string" ? data.from : null,
      subject: typeof data.subject === "string" ? data.subject : null,
    },
  };
}

export function createResendInboundCaptureAdapter(opts?: {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): InboundCaptureAdapter {
  const apiKey = opts?.apiKey ?? process.env.RESEND_API_KEY?.trim() ?? "";
  const defaultFetch = opts?.fetchImpl ?? fetch;

  return {
    provider: "resend",
    async fetchReceivedEmail(
      providerMessageId: string,
      fetchImpl: typeof fetch = defaultFetch,
    ): Promise<InboundReceivedEmail> {
      if (!apiKey) {
        throw new Error("RESEND_API_KEY is not configured");
      }
      const res = await fetchImpl(
        `https://api.resend.com/emails/receiving/${providerMessageId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );
      if (!res.ok) {
        throw new Error(`resend_fetch_${res.status}`);
      }
      const raw = (await res.json()) as ResendReceivedEmailJson;
      return {
        html: raw.html,
        text: raw.text,
        headers: raw.headers,
        attachments: (raw.attachments ?? []).map((a) => ({
          filename: a.filename ?? "attachment",
          contentType: a.content_type ?? "application/octet-stream",
          size: a.size,
          downloadUrl: a.download_url,
        })),
      };
    },
  };
}

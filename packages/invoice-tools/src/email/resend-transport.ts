import { Resend } from "resend";

import type {
  EmailTransport,
  EmailTransportSendInput,
  EmailTransportSendResult,
} from "./types";

export function createResendEmailTransport(opts?: {
  apiKey?: string;
}): EmailTransport {
  const apiKey = opts?.apiKey ?? process.env.RESEND_API_KEY?.trim() ?? "";

  return {
    provider: "resend",
    async send(
      input: EmailTransportSendInput,
    ): Promise<EmailTransportSendResult> {
      if (!apiKey) {
        throw new Error("RESEND_API_KEY is not configured");
      }

      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: input.from,
        to: input.to,
        cc: input.cc && input.cc.length > 0 ? input.cc : undefined,
        replyTo: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: Object.entries(input.tags).map(([name, value]) => ({
          name,
          value,
        })),
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      if (error || !data?.id) {
        throw new Error(error?.message ?? "Resend send failed");
      }

      return { provider: "resend", providerMessageId: data.id };
    },
  };
}

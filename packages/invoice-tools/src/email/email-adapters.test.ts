import { afterEach, describe, expect, it } from "vitest";

import { parseResendDeliveryEvent } from "./resend-delivery";
import {
  createResendInboundCaptureAdapter,
  parseResendInboundEvent,
} from "./resend-inbound";
import {
  getEmailTransport,
  getInboundCaptureAdapter,
  isEmailTransportConfigured,
  resolveEmailProviderId,
} from "./resolve";

const previousProvider = process.env.EMAIL_PROVIDER;
const previousKey = process.env.RESEND_API_KEY;

afterEach(() => {
  if (previousProvider === undefined) {
    delete process.env.EMAIL_PROVIDER;
  } else {
    process.env.EMAIL_PROVIDER = previousProvider;
  }
  if (previousKey === undefined) {
    delete process.env.RESEND_API_KEY;
  } else {
    process.env.RESEND_API_KEY = previousKey;
  }
});

describe("email provider factory", () => {
  it("defaults to resend", () => {
    delete process.env.EMAIL_PROVIDER;
    expect(resolveEmailProviderId()).toBe("resend");
    expect(getEmailTransport().provider).toBe("resend");
    expect(getInboundCaptureAdapter().provider).toBe("resend");
  });

  it("rejects an unknown provider", () => {
    expect(() => resolveEmailProviderId("ses")).toThrow(
      /Unsupported EMAIL_PROVIDER/,
    );
  });

  it("treats a missing Resend key as unconfigured", () => {
    delete process.env.RESEND_API_KEY;
    expect(isEmailTransportConfigured("resend")).toBe(false);
  });
});

describe("Resend inbound parse", () => {
  it("maps email.received metadata", () => {
    const parsed = parseResendInboundEvent({
      type: "email.received",
      data: {
        email_id: "re_123",
        received_for: "in-abc@inbox.invoicey.ditrich.me",
        from: "supplier@example.com",
        subject: "Faktura 2026-001",
      },
    });
    expect(parsed).toEqual({
      ok: true,
      notification: {
        providerMessageId: "re_123",
        recipient: "in-abc@inbox.invoicey.ditrich.me",
        fromAddress: "supplier@example.com",
        subject: "Faktura 2026-001",
      },
    });
  });

  it("ignores non-received events", () => {
    expect(
      parseResendInboundEvent({ type: "email.delivered", data: {} }),
    ).toEqual({ ok: true, ignored: "unhandled_type" });
  });

  it("normalizes Resend attachment fields on fetch", async () => {
    const capture = createResendInboundCaptureAdapter({
      apiKey: "re_test",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            text: "body",
            attachments: [
              {
                filename: "invoice.pdf",
                content_type: "application/pdf",
                download_url: "https://example.com/a.pdf",
                size: 12,
              },
            ],
          }),
        ),
    });
    const email = await capture.fetchReceivedEmail("re_123");
    expect(email.text).toBe("body");
    expect(email.attachments).toEqual([
      {
        filename: "invoice.pdf",
        contentType: "application/pdf",
        downloadUrl: "https://example.com/a.pdf",
        size: 12,
      },
    ]);
  });
});

describe("Resend delivery parse", () => {
  it("maps tags and strips the email. prefix", () => {
    const event = parseResendDeliveryEvent({
      providerEventId: "svix_1",
      payload: {
        type: "email.delivered",
        created_at: "2026-08-17T08:00:00.000Z",
        data: {
          email_id: "re_abc",
          tags: [
            { name: "message_id", value: "msg-1" },
            { name: "workspace_id", value: "ws-1" },
          ],
        },
      },
    });
    expect(event).toMatchObject({
      kind: "delivered",
      providerEventId: "svix_1",
      providerMessageId: "re_abc",
      messageId: "msg-1",
    });
    expect(event?.occurredAt.toISOString()).toBe("2026-08-17T08:00:00.000Z");
  });

  it("returns null for unknown types", () => {
    expect(
      parseResendDeliveryEvent({
        providerEventId: "svix_2",
        payload: { type: "email.unknown" },
      }),
    ).toBeNull();
  });
});

import { createResendInboundCaptureAdapter } from "./resend-inbound";
import { createResendEmailTransport } from "./resend-transport";
import {
  EMAIL_PROVIDERS,
  type EmailProviderId,
  type EmailTransport,
  type InboundCaptureAdapter,
} from "./types";

function isEmailProviderId(value: string): value is EmailProviderId {
  return (EMAIL_PROVIDERS as readonly string[]).includes(value);
}

export function resolveEmailProviderId(
  raw = process.env.EMAIL_PROVIDER,
): EmailProviderId {
  const value = raw?.trim().toLowerCase();
  if (!value) return "resend";
  if (isEmailProviderId(value)) return value;
  throw new Error(`Unsupported EMAIL_PROVIDER: ${value}`);
}

export function isEmailTransportConfigured(
  provider: EmailProviderId = resolveEmailProviderId(),
): boolean {
  if (provider === "resend") {
    return Boolean(process.env.RESEND_API_KEY?.trim());
  }
  return false;
}

export function getEmailTransport(opts?: {
  provider?: EmailProviderId;
  apiKey?: string;
}): EmailTransport {
  const provider = opts?.provider ?? resolveEmailProviderId();
  if (provider === "resend") {
    return createResendEmailTransport({ apiKey: opts?.apiKey });
  }
  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
}

export function getInboundCaptureAdapter(opts?: {
  provider?: EmailProviderId;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): InboundCaptureAdapter {
  const provider = opts?.provider ?? resolveEmailProviderId();
  if (provider === "resend") {
    return createResendInboundCaptureAdapter({
      apiKey: opts?.apiKey,
      fetchImpl: opts?.fetchImpl,
    });
  }
  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
}
